/**
 * Approval Workflow — Voucher submission and approval management
 * Handles: Submit for Approval modal, Voucher list, Approve/Reject actions
 */
const approvalWorkflow = (() => {
    'use strict';

    let currentTab = 'my-vouchers';
    let managers = [];
    let accountants = [];
    let approvalChannel = null;

    // Realtime badge for pending approvals
    async function initApprovalBadge() {
        try {
            await refreshApprovalBadge();
            subscribeApprovalRealtime();
        } catch (e) { /* silent */ }
    }

    async function refreshApprovalBadge() {
        try {
            const [vouchers, advances] = await Promise.all([
                api.getVouchersForApproval().catch(() => []),
                api.getAdvancesForApproval().catch(() => [])
            ]);
            const count = (vouchers?.length || 0) + (advances?.length || 0);
            const badge = document.getElementById('approvalBadge');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'flex' : 'none';
            }
        } catch (e) { /* silent */ }
    }

    function subscribeApprovalRealtime() {
        const supabase = window.supabaseClient?.get();
        if (!supabase) return;
        if (approvalChannel) supabase.removeChannel(approvalChannel);

        approvalChannel = supabase.channel('approvals-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, () => refreshApprovalBadge())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'advances' }, () => refreshApprovalBadge())
            .subscribe();
    }

    // ==================== Helpers ====================

    function sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatAmount(amount) {
        const num = parseFloat(amount);
        if (isNaN(num)) return '₹0';
        return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: num % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
    }

    function relativeTime(dateStr) {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d ago`;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    // Send email notification (non-blocking — fire and forget)
    function sendEmailNotification(recipientEmail, subject, message, voucherNumber) {
        if (!recipientEmail) return;
        api.sendNotificationEmail(recipientEmail, subject, message, voucherNumber)
            .then(r => { if (r.success) console.log('Notification email sent to', recipientEmail); })
            .catch(e => console.warn('Email notification failed:', e));
    }

    const STATUS_CONFIG = {
        draft: { label: 'Draft', color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
        pending_manager: { label: 'Pending Manager', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        manager_approved: { label: 'Manager Approved', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        pending_accountant: { label: 'Pending Accountant', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
        approved: { label: 'Approved', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
        reimbursed: { label: 'Reimbursed', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' }
    };

    function statusBadge(status) {
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
        return `<span class="approval-status-badge" style="background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.color}22;">${cfg.label}</span>`;
    }

    // ==================== Submit for Approval Modal ====================

    async function openSubmitModal() {
        if (!isCompanyMode()) {
            window.expenseTracker?.showNotification('Approval workflow is available in company mode only');
            return;
        }

        const orgId = getOrganizationId();
        const tracker = window.expenseTracker;
        if (!tracker) return;

        // Get selected expenses — if none selected, use all expenses
        let expenses = tracker.getSelectedExpenses();
        if (expenses.length === 0) {
            // Auto-select all expenses if none checked
            expenses = tracker.expenses || [];
            if (expenses.length === 0) {
                window.expenseTracker?.showNotification('No expenses found. Add expenses first.');
                return;
            }
        }

        // Filter out already-submitted expenses
        const submittable = expenses.filter(e => !e.voucherStatus || e.voucherStatus === 'rejected');
        if (submittable.length === 0) {
            window.expenseTracker?.showNotification('All selected expenses are already in a voucher');
            return;
        }

        // Load managers and accountants
        try {
            [managers, accountants] = await Promise.all([
                api.getOrgMembersByRole(orgId, 'manager'),
                api.getOrgMembersByRole(orgId, 'accountant')
            ]);
        } catch (e) {
            window.expenseTracker?.showNotification('Failed to load team members: ' + e.message);
            return;
        }

        if (managers.length === 0) {
            window.expenseTracker?.showNotification('No managers found in your organization. Ask admin to assign manager roles.');
            return;
        }
        if (accountants.length === 0) {
            window.expenseTracker?.showNotification('No accountants found in your organization. Ask admin to assign accountant roles.');
            return;
        }

        renderSubmitModal(submittable);
    }

    function renderSubmitModal(expenses) {
        const totalAmount = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

        const overlay = document.createElement('div');
        overlay.id = 'approvalSubmitOverlay';
        overlay.className = 'approval-overlay';

        const managerOptions = managers.map(m =>
            `<option value="${m.id}">${sanitize(m.name)} (${sanitize(m.email)})</option>`
        ).join('');

        const accountantOptions = accountants.map(a =>
            `<option value="${a.id}">${sanitize(a.name)} (${sanitize(a.email)})</option>`
        ).join('');

        const expenseRows = expenses.map(e => `
            <div class="approval-expense-row">
                <span class="approval-expense-date">${e.date || ''}</span>
                <span class="approval-expense-vendor">${sanitize(e.vendor || e.description || '')}</span>
                <span class="approval-expense-amount">${formatAmount(e.amount)}</span>
            </div>
        `).join('');

        overlay.innerHTML = `
            <div class="approval-modal">
                <div class="approval-modal__header">
                    <h2>Submit for Approval</h2>
                    <button class="approval-modal__close" onclick="approvalWorkflow.closeSubmitModal()">&times;</button>
                </div>

                <div class="approval-modal__body">
                    <!-- Summary -->
                    <div class="approval-summary-card">
                        <div class="approval-summary-stat">
                            <span class="approval-summary-label">Expenses</span>
                            <span class="approval-summary-value">${expenses.length}</span>
                        </div>
                        <div class="approval-summary-stat">
                            <span class="approval-summary-label">Total Amount</span>
                            <span class="approval-summary-value approval-summary-value--amount">${formatAmount(totalAmount)}</span>
                        </div>
                    </div>

                    <!-- Expense List -->
                    <div class="approval-expense-list">
                        <h4>Expenses in this voucher</h4>
                        ${expenseRows}
                    </div>

                    <!-- Select Manager -->
                    <div class="approval-form-group">
                        <label>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            Approving Manager *
                        </label>
                        <select id="approvalManagerSelect" required>
                            <option value="">Select manager...</option>
                            ${managerOptions}
                        </select>
                    </div>

                    <!-- Select Accountant -->
                    <div class="approval-form-group">
                        <label>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
                            Verifying Accountant *
                        </label>
                        <select id="approvalAccountantSelect" required>
                            <option value="">Select accountant...</option>
                            ${accountantOptions}
                        </select>
                    </div>

                    <!-- Expense Period -->
                    <div class="approval-form-group">
                        <label>Expense Period</label>
                        <div style="display:flex;gap:12px;">
                            <div style="flex:1;">
                                <small style="color:#64748b;font-size:0.72rem;">From</small>
                                <input type="date" id="approvalPeriodFrom" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;color:#0f172a;font-size:0.85rem;box-sizing:border-box;">
                            </div>
                            <div style="flex:1;">
                                <small style="color:#64748b;font-size:0.72rem;">To</small>
                                <input type="date" id="approvalPeriodTo" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;color:#0f172a;font-size:0.85rem;box-sizing:border-box;">
                            </div>
                        </div>
                    </div>

                    <!-- Purpose -->
                    <div class="approval-form-group">
                        <label>Purpose / Notes</label>
                        <textarea id="approvalPurpose" placeholder="Brief description of expenses (e.g., Site visit to Hyderabad, Jan 15-18)" rows="3"></textarea>
                    </div>

                    <!-- Declaration -->
                    <div style="margin-top:16px;padding:14px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;">
                        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:0.82rem;color:#64748b;">
                            <input type="checkbox" id="approvalDeclaration" style="margin-top:2px;accent-color:#10b981;width:18px;height:18px;flex-shrink:0;">
                            <span>I hereby declare that the above expenses are incurred wholly and exclusively for official purposes and are supported by valid documents.</span>
                        </label>
                    </div>
                </div>

                <div class="approval-modal__footer">
                    <button class="approval-btn approval-btn--cancel" onclick="approvalWorkflow.closeSubmitModal()">Cancel</button>
                    <button class="approval-btn approval-btn--submit" id="approvalSubmitBtn" onclick="approvalWorkflow.submitVoucher()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        Submit Voucher
                    </button>
                </div>
            </div>
        `;

        // Store expense IDs for submission
        overlay._expenseIds = expenses.map(e => e.id);
        overlay._expenses = expenses;
        document.body.appendChild(overlay);
        document.body.classList.add('modal-open');

        // Auto-fill period dates from expense dates
        const dates = expenses.map(e => e.date).filter(Boolean).sort();
        if (dates.length > 0) {
            const fromInput = document.getElementById('approvalPeriodFrom');
            const toInput = document.getElementById('approvalPeriodTo');
            if (fromInput) fromInput.value = dates[0];
            if (toInput) toInput.value = dates[dates.length - 1];
        }

        // Close on backdrop click
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSubmitModal(); });
    }

    function closeSubmitModal() {
        const overlay = document.getElementById('approvalSubmitOverlay');
        if (overlay) {
            overlay.remove();
            document.body.classList.remove('modal-open');
        }
    }

    async function submitVoucher() {
        const overlay = document.getElementById('approvalSubmitOverlay');
        if (!overlay) return;

        const managerId = document.getElementById('approvalManagerSelect')?.value;
        const accountantId = document.getElementById('approvalAccountantSelect')?.value;
        const purpose = document.getElementById('approvalPurpose')?.value?.trim() || '';
        const periodFrom = document.getElementById('approvalPeriodFrom')?.value || '';
        const periodTo = document.getElementById('approvalPeriodTo')?.value || '';
        const declaration = document.getElementById('approvalDeclaration')?.checked || false;
        const expenseIds = overlay._expenseIds;
        const expenses = overlay._expenses || [];

        if (!managerId) { window.expenseTracker?.showNotification('Please select a manager'); return; }
        if (!accountantId) { window.expenseTracker?.showNotification('Please select an accountant'); return; }
        if (!declaration) { window.expenseTracker?.showNotification('Please accept the declaration to proceed'); return; }

        const btn = document.getElementById('approvalSubmitBtn');
        btn.disabled = true;

        const attachments = {};

        try {
            // Step 1: Auto-export to Google Sheets
            btn.innerHTML = 'Exporting to Sheets...';
            try {
                const sheetsService = window.googleSheetsService;
                if (sheetsService) {
                    await sheetsService.initialize();
                    const sheetsResult = await sheetsService.exportExpenses(expenses);
                    if (sheetsResult?.success) {
                        attachments.sheetUrl = sheetsService.getSheetUrl();
                        console.log('Sheets export done:', attachments.sheetUrl);
                    }
                }
            } catch (e) {
                console.warn('Sheets export failed (non-blocking):', e.message);
            }

            // Step 2: Auto-generate PDF with bill images
            btn.innerHTML = 'Generating PDF...';
            try {
                const tracker = window.expenseTracker;
                if (tracker && typeof tracker.generateCombinedReimbursementPDFWithEmployeeInfo === 'function') {
                    // Store PDF info if available (the function triggers download)
                    await tracker.generateCombinedReimbursementPDFWithEmployeeInfo();
                    attachments.pdfFilename = `Reimbursement_${new Date().toISOString().split('T')[0]}.pdf`;
                    console.log('PDF generated:', attachments.pdfFilename);
                }
            } catch (e) {
                console.warn('PDF generation failed (non-blocking):', e.message);
            }

            // Step 3: Create the voucher with attachments
            btn.innerHTML = 'Creating voucher...';
            const orgId = getOrganizationId();
            const result = await api.createVoucher(orgId, managerId, accountantId, expenseIds, purpose, null, null, attachments, { periodFrom, periodTo, declaration });

            closeSubmitModal();
            const amt = formatAmount(result.data.total_amount);
            const vNum = result.data.voucher_number;

            let successMsg = `Voucher ${vNum} submitted for approval!`;
            if (attachments.sheetUrl) successMsg += ' (Google Sheet synced)';
            if (attachments.pdfFilename) successMsg += ' (PDF generated)';
            window.expenseTracker?.showNotification(successMsg);

            await api.logActivity?.('voucher_submitted', `Submitted voucher ${vNum} (${amt}) for approval with attachments`);

            // Send email to manager with attachment links
            const selectedManager = managers.find(m => m.id === managerId);
            if (selectedManager?.email) {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                let emailBody = `${user.name || 'An employee'} submitted voucher ${vNum} (${amt}) for your approval.`;
                if (attachments.sheetUrl) emailBody += `\n\nGoogle Sheet: ${attachments.sheetUrl}`;
                emailBody += '\n\nPlease log in to review and approve.';
                sendEmailNotification(selectedManager.email, 'New voucher for your approval', emailBody, vNum);
            }

            // Uncheck checkboxes and refresh
            document.querySelectorAll('.expense-checkbox:checked').forEach(cb => cb.checked = false);
            window.expenseTracker?.updateExportButton?.();
            window.expenseTracker?.loadExpenses?.();
        } catch (error) {
            window.expenseTracker?.showNotification('Failed: ' + error.message);
            btn.disabled = false;
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> Submit Voucher';
        }
    }

    // ==================== Voucher List (Approvals Tab) ====================

    async function openApprovalsPanel() {
        const overlay = document.getElementById('approvalsPanelOverlay');
        if (!overlay) return;

        overlay.classList.add('active');
        document.body.classList.add('modal-open');
        await loadVoucherList();
    }

    function closeApprovalsPanel() {
        const overlay = document.getElementById('approvalsPanelOverlay');
        if (!overlay) return;
        overlay.classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    async function loadVoucherList() {
        const body = document.getElementById('approvalsBody');
        if (!body) return;

        body.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;">Loading...</div>';

        try {
            if (currentTab === 'my-vouchers') {
                // Show user's own vouchers AND advances
                const [vouchers, advances] = await Promise.all([
                    api.getMyVouchers(),
                    api.getAdvancesWithBalances?.().catch(() => []) || Promise.resolve([])
                ]);
                // Filter advances to only show ones with approval status
                const myAdvances = (advances || []).filter(a =>
                    ['pending_manager', 'pending_accountant', 'rejected', 'active'].includes(a.status));
                renderMySubmissions(vouchers, myAdvances);
            } else if (currentTab === 'pending-approval') {
                // Load both vouchers and advances for approval
                const [vouchers, advances] = await Promise.all([
                    api.getVouchersForApproval(),
                    api.getAdvancesForApproval().catch(() => [])
                ]);
                renderMixedApprovalList(vouchers, advances);
            } else {
                const vouchers = await api.getVouchersForApproval();
                renderVoucherList(vouchers);
            }
        } catch (e) {
            body.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444;">Error: ${sanitize(e.message)}</div>`;
        }
    }

    function renderMixedApprovalList(vouchers, advances) {
        const body = document.getElementById('approvalsBody');
        if (!body) return;

        if (vouchers.length === 0 && advances.length === 0) {
            body.innerHTML = '<div class="approval-empty"><p>No pending approvals.</p></div>';
            return;
        }

        let html = '';

        // Render advance requests
        if (advances.length > 0) {
            html += `<div style="margin-bottom:8px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#a78bfa;padding:0 4px;">Advance Requests (${advances.length})</div>`;
            html += advances.map(adv => `
                <div class="approval-voucher-card" onclick="approvalWorkflow.openAdvanceDetail('${adv.id}')" style="border-left:3px solid #a78bfa;">
                    <div class="approval-voucher-card__header">
                        <span class="approval-voucher-card__number" style="color:#a78bfa;">ADVANCE</span>
                        ${statusBadge(adv.status)}
                    </div>
                    <div class="approval-voucher-card__body">
                        <div class="approval-voucher-card__amount">${formatAmount(adv.amount)}</div>
                        <div class="approval-voucher-card__meta">
                            <span>From: ${sanitize(adv.submitter?.name || '')}</span>
                            <span class="visit-type-badge visit-type-badge--${adv.visit_type || 'project'}">${adv.visit_type || 'project'}</span>
                        </div>
                        <div class="approval-voucher-card__purpose">${sanitize(adv.project_name)}${adv.notes ? ' — ' + sanitize(adv.notes) : ''}</div>
                    </div>
                    <div class="approval-voucher-card__footer">
                        <span>${adv.submitted_at ? relativeTime(adv.submitted_at) : ''}</span>
                    </div>
                </div>
            `).join('');
        }

        // Render vouchers
        if (vouchers.length > 0) {
            html += `<div style="margin:16px 0 8px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;padding:0 4px;">Vouchers (${vouchers.length})</div>`;
            html += vouchers.map(v => {
                const person = `From: ${sanitize(v.submitter?.name || v.submitted_by)}`;
                const projectInfo = v.project ? `<span class="expense-project-badge">${sanitize(v.project.project_code)}</span>` : '';
                return `
                    <div class="approval-voucher-card" onclick="approvalWorkflow.openVoucherDetail('${v.id}')">
                        <div class="approval-voucher-card__header">
                            <span class="approval-voucher-card__number">${sanitize(v.voucher_number)}</span>
                            ${statusBadge(v.status)}
                        </div>
                        <div class="approval-voucher-card__body">
                            <div class="approval-voucher-card__amount">${formatAmount(v.total_amount)}</div>
                            <div class="approval-voucher-card__meta">
                                <span>${v.expense_count} expense${v.expense_count !== 1 ? 's' : ''}</span>
                                <span>${person}</span>
                                ${projectInfo}
                            </div>
                            ${v.purpose ? `<div class="approval-voucher-card__purpose">${sanitize(v.purpose)}</div>` : ''}
                        </div>
                        <div class="approval-voucher-card__footer">
                            <span>${v.submitted_at ? relativeTime(v.submitted_at) : ''}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        body.innerHTML = html;
    }

    function renderMySubmissions(vouchers, advances) {
        const body = document.getElementById('approvalsBody');
        if (!body) return;

        if (vouchers.length === 0 && advances.length === 0) {
            body.innerHTML = '<div class="approval-empty"><p>No submissions yet. Submit expenses or request advances to track them here.</p></div>';
            return;
        }

        let html = '';

        // My Advances
        if (advances.length > 0) {
            html += `<div style="margin-bottom:8px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#a78bfa;padding:0 4px;">My Advances (${advances.length})</div>`;
            html += advances.map(adv => {
                const remaining = adv.remaining ?? (adv.amount - (adv.totalSpent || 0));
                const percent = adv.percentUsed ?? 0;
                return `
                <div class="approval-voucher-card" style="border-left:3px solid #a78bfa;">
                    <div class="approval-voucher-card__header">
                        <span class="approval-voucher-card__number" style="color:#a78bfa;">${sanitize(adv.project_name)}</span>
                        ${statusBadge(adv.status)}
                    </div>
                    <div class="approval-voucher-card__body">
                        <div class="approval-voucher-card__amount">${formatAmount(adv.amount)}</div>
                        <div class="approval-voucher-card__meta">
                            <span>Spent: ₹${(adv.totalSpent || 0).toLocaleString('en-IN')}</span>
                            <span>Remaining: ₹${remaining.toLocaleString('en-IN')}</span>
                            <span>${Math.round(percent)}% used</span>
                        </div>
                        ${adv.rejection_reason ? `<div class="approval-voucher-card__rejection">Rejected: ${sanitize(adv.rejection_reason)}</div>` : ''}
                    </div>
                    <div class="approval-voucher-card__footer">
                        <span>${adv.created_at ? relativeTime(adv.created_at) : ''}</span>
                        ${adv.status === 'rejected' ? `<button class="approval-btn approval-btn--resubmit" onclick="event.stopPropagation();expenseTracker.openAdvanceModal(JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(adv))}')))">Edit & Resubmit</button>` : ''}
                    </div>
                </div>`;
            }).join('');
        }

        // My Vouchers
        if (vouchers.length > 0) {
            html += `<div style="margin:${advances.length > 0 ? '16px' : '0'} 0 8px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;padding:0 4px;">My Vouchers (${vouchers.length})</div>`;
            html += vouchers.map(v => `
                <div class="approval-voucher-card" onclick="approvalWorkflow.openVoucherDetail('${v.id}')">
                    <div class="approval-voucher-card__header">
                        <span class="approval-voucher-card__number">${sanitize(v.voucher_number)}</span>
                        ${statusBadge(v.status)}
                    </div>
                    <div class="approval-voucher-card__body">
                        <div class="approval-voucher-card__amount">${formatAmount(v.total_amount)}</div>
                        <div class="approval-voucher-card__meta">
                            <span>${v.expense_count} expense${v.expense_count !== 1 ? 's' : ''}</span>
                            <span>To: ${sanitize(v.manager?.name || 'Manager')}</span>
                        </div>
                        ${v.rejection_reason ? `<div class="approval-voucher-card__rejection">Rejected: ${sanitize(v.rejection_reason)}</div>` : ''}
                    </div>
                    <div class="approval-voucher-card__footer">
                        <span>${v.submitted_at ? relativeTime(v.submitted_at) : ''}</span>
                        ${v.status === 'rejected' ? `<button class="approval-btn approval-btn--resubmit" onclick="event.stopPropagation();approvalWorkflow.resubmit('${v.id}')">Resubmit</button>` : ''}
                    </div>
                </div>
            `).join('');
        }

        body.innerHTML = html;
    }

    async function openAdvanceDetail(advanceId) {
        try {
            const detail = await api.getAdvanceDetail(advanceId);
            renderAdvanceDetail(detail);
        } catch (e) {
            window.expenseTracker?.showNotification('Failed to load advance: ' + e.message);
        }
    }

    function renderAdvanceDetail(adv) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userRole = user.role || 'employee';
        const isAdmin = userRole === 'admin';
        const canApprove = (adv.manager_id === user.id && adv.status === 'pending_manager')
            || (adv.accountant_id === user.id && adv.status === 'pending_accountant')
            || (isAdmin && ['pending_manager', 'pending_accountant'].includes(adv.status));

        let existing = document.getElementById('voucherDetailOverlay');
        if (existing) existing.remove();

        const statusColors = { pending_manager: '#d97706', pending_accountant: '#d97706', active: '#059669', closed: '#64748b', rejected: '#dc2626' };
        const statusLabels = { pending_manager: 'Pending Manager', pending_accountant: 'Pending Accountant', active: 'Active', closed: 'Closed', rejected: 'Rejected' };
        const sc = statusColors[adv.status] || '#64748b';

        const overlay = document.createElement('div');
        overlay.id = 'voucherDetailOverlay';
        overlay.className = 'kodo-modal-overlay';
        overlay.style.display = 'flex';

        overlay.innerHTML = `
            <div class="kodo-confirm-modal" style="max-width:600px;">
                <!-- Header -->
                <div class="kodo-confirm-modal__header">
                    <div class="kodo-confirm-modal__header-accent"></div>
                    <div class="kodo-confirm-modal__header-content">
                        <div class="kodo-confirm-modal__icon-wrap">
                            <svg class="kodo-confirm-modal__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                            </svg>
                        </div>
                        <div class="kodo-confirm-modal__title-group">
                            <h3 class="kodo-confirm-modal__title">Advance Request</h3>
                            <span class="kodo-confirm-modal__subtitle">${sanitize(adv.project_name)}</span>
                        </div>
                    </div>
                    <div class="kodo-confirm-modal__header-actions">
                        <button class="kodo-confirm-modal__close" onclick="approvalWorkflow.closeVoucherDetail()" aria-label="Close">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Body -->
                <div class="kodo-confirm-modal__body">
                    <!-- Summary row -->
                    <div class="kodo-confirm-modal__summary">
                        <div class="kodo-summary-row">
                            <span class="kodo-summary-label">Amount</span>
                            <span class="kodo-summary-value" style="color:#059669;font-size:1.15rem;">₹${parseFloat(adv.amount).toLocaleString('en-IN')}</span>
                        </div>
                        <div class="kodo-summary-row">
                            <span class="kodo-summary-label">Type</span>
                            <span class="kodo-summary-value">${adv.visit_type || 'project'}</span>
                        </div>
                        <div class="kodo-summary-row">
                            <span class="kodo-summary-label">Status</span>
                            <span class="kodo-summary-value" style="color:${sc};">${statusLabels[adv.status] || adv.status}</span>
                        </div>
                    </div>

                    ${adv.notes ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:16px;font-size:0.85rem;color:#374151;"><strong style="color:#6b7280;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.04em;">Notes</strong><div style="margin-top:4px;">${sanitize(adv.notes)}</div></div>` : ''}

                    <!-- People -->
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
                        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                            <div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin-bottom:4px;">Requested By</div>
                            <div style="font-weight:600;font-size:0.88rem;color:#111827;">${sanitize(adv.submitter?.name || '-')}</div>
                            <div style="font-size:0.72rem;color:#6b7280;">${sanitize(adv.submitter?.email || '')}</div>
                        </div>
                        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                            <div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin-bottom:4px;">Manager</div>
                            <div style="font-weight:600;font-size:0.88rem;color:#111827;">${sanitize(adv.manager?.name || '-')}</div>
                        </div>
                        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                            <div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin-bottom:4px;">Accountant</div>
                            <div style="font-weight:600;font-size:0.88rem;color:#111827;">${sanitize(adv.accountant?.name || '-')}</div>
                        </div>
                        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                            <div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin-bottom:4px;">Submitted</div>
                            <div style="font-weight:600;font-size:0.88rem;color:#111827;">${adv.submitted_at ? new Date(adv.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</div>
                        </div>
                    </div>

                    ${adv.rejection_reason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:16px;"><div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;color:#dc2626;margin-bottom:4px;">Rejection Reason</div><div style="font-size:0.85rem;color:#991b1b;">${sanitize(adv.rejection_reason)}</div></div>` : ''}

                    <!-- History -->
                    ${adv.history && adv.history.length > 0 ? `
                        <div>
                            <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;margin-bottom:10px;">Activity</div>
                            ${adv.history.map(h => `
                                <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6;">
                                    <span style="width:8px;height:8px;border-radius:50%;background:#0ea5e9;margin-top:5px;flex-shrink:0;"></span>
                                    <div>
                                        <strong style="font-size:0.82rem;color:#111827;">${sanitize(h.action.replace(/_/g, ' '))}</strong>
                                        <div style="font-size:0.75rem;color:#6b7280;">${sanitize(h.actor?.name || '')}${h.comments ? ' — ' + sanitize(h.comments) : ''}</div>
                                        <div style="font-size:0.7rem;color:#9ca3af;">${h.created_at ? relativeTime(h.created_at) : ''}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                <!-- Actions -->
                ${canApprove ? `
                <div class="kodo-confirm-modal__actions" style="padding:0 28px 24px;">
                    <button class="kodo-confirm-modal__btn kodo-confirm-modal__btn--cancel" onclick="approvalWorkflow.rejectAdvance('${adv.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        Reject
                    </button>
                    <button class="kodo-confirm-modal__btn kodo-confirm-modal__btn--submit" onclick="approvalWorkflow.approveAdvance('${adv.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        Approve
                    </button>
                </div>` : ''}
            </div>
        `;

        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeVoucherDetail(); });
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
    }

    function renderVoucherList(vouchers) {
        const body = document.getElementById('approvalsBody');
        if (!body) return;

        if (vouchers.length === 0) {
            const msg = currentTab === 'my-vouchers'
                ? 'No vouchers submitted yet. Select expenses and click "Submit for Approval".'
                : 'No vouchers pending your approval.';
            body.innerHTML = `<div class="approval-empty"><p>${msg}</p></div>`;
            return;
        }

        body.innerHTML = vouchers.map(v => {
            const person = currentTab === 'my-vouchers'
                ? `To: ${sanitize(v.manager?.name || 'Manager')}`
                : `From: ${sanitize(v.submitter?.name || v.submitted_by)}`;

            const projectInfo = v.project
                ? `<span class="expense-project-badge">${sanitize(v.project.project_code)}</span>`
                : '';

            return `
                <div class="approval-voucher-card" onclick="approvalWorkflow.openVoucherDetail('${v.id}')">
                    <div class="approval-voucher-card__header">
                        <span class="approval-voucher-card__number">${sanitize(v.voucher_number)}</span>
                        ${statusBadge(v.status)}
                    </div>
                    <div class="approval-voucher-card__body">
                        <div class="approval-voucher-card__amount">${formatAmount(v.total_amount)}</div>
                        <div class="approval-voucher-card__meta">
                            <span>${v.expense_count} expense${v.expense_count !== 1 ? 's' : ''}</span>
                            <span>${person}</span>
                            ${projectInfo}
                        </div>
                        ${v.purpose ? `<div class="approval-voucher-card__purpose">${sanitize(v.purpose)}</div>` : ''}
                        ${v.rejection_reason ? `<div class="approval-voucher-card__rejection">Rejected: ${sanitize(v.rejection_reason)}</div>` : ''}
                    </div>
                    <div class="approval-voucher-card__footer">
                        <span>${v.submitted_at ? relativeTime(v.submitted_at) : ''}</span>
                        ${v.status === 'rejected' && currentTab === 'my-vouchers' ? `<button class="approval-btn approval-btn--resubmit" onclick="event.stopPropagation();approvalWorkflow.resubmit('${v.id}')">Resubmit</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.approval-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.approval-tab[data-tab="${tab}"]`)?.classList.add('active');
        loadVoucherList();
    }

    // ==================== Voucher Detail ====================

    async function openVoucherDetail(voucherId) {
        try {
            const detail = await api.getVoucherDetail(voucherId);
            renderVoucherDetail(detail);
        } catch (e) {
            window.expenseTracker?.showNotification('Failed to load voucher: ' + e.message);
        }
    }

    function renderVoucherDetail(v) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userRole = user.role || 'employee';
        const isAdmin = userRole === 'admin';
        const isManagerPending = v.status === 'pending_manager' && (v.manager_id === user.id || isAdmin);
        const isAccountantPending = ['manager_approved', 'pending_accountant'].includes(v.status) && (v.accountant_id === user.id || isAdmin);
        const canAct = isManagerPending || isAccountantPending;
        const isOwnerRejected = v.status === 'rejected' && v.submitted_by === user.id;

        const statusColors = { pending_manager: '#d97706', pending_accountant: '#d97706', manager_approved: '#0ea5e9', approved: '#059669', rejected: '#dc2626', reimbursed: '#06b6d4' };
        const statusLabels = { pending_manager: 'Pending Manager', pending_accountant: 'Pending Accountant', manager_approved: 'Manager Approved', approved: 'Approved', rejected: 'Rejected', reimbursed: 'Reimbursed' };
        const sc = statusColors[v.status] || '#64748b';

        let existing = document.getElementById('voucherDetailOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'voucherDetailOverlay';
        overlay.className = 'kodo-modal-overlay';
        overlay.style.display = 'flex';

        // Expenses table
        const expRows = (v.expenses || []).map(e => `
            <tr>
                <td style="font-size:0.78rem;color:#64748b;">${e.date || ''}</td>
                <td style="font-weight:500;">${sanitize(e.vendor || '-')}</td>
                <td><span style="font-size:0.72rem;background:#f3f4f6;padding:2px 8px;border-radius:4px;">${sanitize(e.category)}</span></td>
                <td style="font-weight:600;text-align:right;">${formatAmount(e.amount)}</td>
            </tr>
        `).join('');

        // Timeline
        const actionLabels = { created: 'Created', submitted: 'Submitted', manager_approved: 'Manager Approved', manager_rejected: 'Manager Rejected', accountant_approved: 'Accountant Approved', accountant_rejected: 'Accountant Rejected', resubmitted: 'Resubmitted', reimbursed: 'Reimbursed' };
        // Horizontal flow timeline
        const timelineHTML = (v.history || []).map((h, i) => {
            const isReject = h.action.includes('rejected');
            const isApprove = h.action.includes('approved');
            const dotColor = isReject ? '#ef4444' : isApprove ? '#10b981' : '#0ea5e9';
            const isLast = i === (v.history || []).length - 1;
            return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;position:relative;">
                <div style="width:28px;height:28px;border-radius:50%;background:${dotColor}15;border:2px solid ${dotColor};display:flex;align-items:center;justify-content:center;z-index:1;">
                    <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};"></span>
                </div>
                ${!isLast ? `<div style="position:absolute;top:14px;left:calc(50% + 14px);right:calc(-50% + 14px);height:2px;background:#e5e7eb;z-index:0;"></div>` : ''}
                <div style="text-align:center;margin-top:6px;">
                    <div style="font-size:0.72rem;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${actionLabels[h.action] || h.action}</div>
                    <div style="font-size:0.65rem;color:#6b7280;">${sanitize(h.actor?.name || '')}</div>
                    <div style="font-size:0.6rem;color:#9ca3af;">${h.created_at ? relativeTime(h.created_at) : ''}</div>
                </div>
            </div>`;
        }).join('');

        // Action buttons
        let actionsHTML = '';
        if (canAct) {
            actionsHTML = `<div class="kodo-confirm-modal__actions" style="padding:0 28px 24px;">
                <button class="kodo-confirm-modal__btn kodo-confirm-modal__btn--cancel" onclick="approvalWorkflow.showRejectForm('${v.id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Reject
                </button>
                <button class="kodo-confirm-modal__btn kodo-confirm-modal__btn--submit" onclick="approvalWorkflow.approve('${v.id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Approve
                </button>
            </div>`;
        } else if (isOwnerRejected) {
            actionsHTML = `<div class="kodo-confirm-modal__actions" style="padding:0 28px 24px;">
                <button class="kodo-confirm-modal__btn kodo-confirm-modal__btn--submit" onclick="approvalWorkflow.resubmit('${v.id}')">Resubmit for Approval</button>
            </div>`;
        }

        overlay.innerHTML = `
            <div class="kodo-confirm-modal" style="max-width:860px;">
                <div class="kodo-confirm-modal__header">
                    <div class="kodo-confirm-modal__header-accent"></div>
                    <div class="kodo-confirm-modal__header-content">
                        <div class="kodo-confirm-modal__icon-wrap">
                            <svg class="kodo-confirm-modal__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                        </div>
                        <div class="kodo-confirm-modal__title-group">
                            <h3 class="kodo-confirm-modal__title">${sanitize(v.voucher_number)}</h3>
                            <span class="kodo-confirm-modal__subtitle" style="color:${sc};">${statusLabels[v.status] || v.status}</span>
                        </div>
                    </div>
                    <div class="kodo-confirm-modal__header-actions">
                        <button class="kodo-confirm-modal__close" onclick="approvalWorkflow.closeVoucherDetail()" aria-label="Close">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>

                <div class="kodo-confirm-modal__body">
                    <!-- Summary -->
                    <div class="kodo-confirm-modal__summary">
                        <div class="kodo-summary-row">
                            <span class="kodo-summary-label">Amount</span>
                            <span class="kodo-summary-value" style="color:#059669;font-size:1.15rem;">${formatAmount(v.total_amount)}</span>
                        </div>
                        <div class="kodo-summary-row">
                            <span class="kodo-summary-label">Expenses</span>
                            <span class="kodo-summary-value">${v.expense_count || v.expenses?.length || 0}</span>
                        </div>
                        <div class="kodo-summary-row">
                            <span class="kodo-summary-label">Period</span>
                            <span class="kodo-summary-value" style="font-size:0.82rem;">${v.period_from || '—'} to ${v.period_to || '—'}</span>
                        </div>
                    </div>

                    <!-- People -->
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
                        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                            <div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin-bottom:4px;">Submitted By</div>
                            <div style="font-weight:600;font-size:0.88rem;color:#111827;">${sanitize(v.submitter?.name || '-')}</div>
                            <div style="font-size:0.72rem;color:#6b7280;">${sanitize(v.submitter?.department || v.submitter?.email || '')}</div>
                        </div>
                        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                            <div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin-bottom:4px;">Manager</div>
                            <div style="font-weight:600;font-size:0.88rem;color:#111827;">${sanitize(v.manager?.name || '-')}</div>
                        </div>
                        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                            <div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin-bottom:4px;">Accountant</div>
                            <div style="font-weight:600;font-size:0.88rem;color:#111827;">${sanitize(v.accountant?.name || '-')}</div>
                        </div>
                        ${v.project ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                            <div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin-bottom:4px;">Project</div>
                            <div style="font-weight:600;font-size:0.88rem;color:#111827;">${sanitize(v.project.project_code)} — ${sanitize(v.project.project_name)}</div>
                        </div>` : ''}
                    </div>

                    ${v.purpose ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:16px;"><div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Purpose</div><div style="font-size:0.85rem;color:#374151;">${sanitize(v.purpose)}</div></div>` : ''}

                    ${v.rejection_reason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:16px;"><div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;color:#dc2626;margin-bottom:4px;">Rejection Reason</div><div style="font-size:0.85rem;color:#991b1b;">${sanitize(v.rejection_reason)}</div></div>` : ''}

                    ${v.declaration_accepted ? `<div style="padding:10px 14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;margin-bottom:16px;font-size:0.78rem;color:#065f46;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" style="vertical-align:middle;margin-right:6px;"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Employee declared expenses are for official purposes</div>` : ''}

                    <!-- Attachments -->
                    ${(v.google_sheet_url || v.pdf_filename) ? `
                    <div style="margin-bottom:16px;">
                        <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;margin-bottom:8px;">Attachments</div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            ${v.google_sheet_url ? `<a href="${sanitize(v.google_sheet_url)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;background:#ecfdf5;border:1px solid #a7f3d0;color:#059669;font-size:0.82rem;font-weight:600;text-decoration:none;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Google Sheet</a>` : ''}
                            ${v.pdf_url ? `<a href="${sanitize(v.pdf_url)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;background:#f5f3ff;border:1px solid #ddd6fe;color:#7c3aed;font-size:0.82rem;font-weight:600;text-decoration:none;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${sanitize(v.pdf_filename || 'View PDF')}</a>` : (v.pdf_filename ? `<span style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;background:#f5f3ff;border:1px solid #ddd6fe;color:#7c3aed;font-size:0.82rem;font-weight:600;cursor:pointer;" onclick="if(typeof pdfLibrary!=='undefined')pdfLibrary.openLibrary()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${sanitize(v.pdf_filename)}</span>` : '')}
                        </div>
                    </div>` : ''}

                    <!-- Expenses Table -->
                    ${(v.expenses?.length > 0) ? `
                    <div style="margin-bottom:16px;">
                        <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;margin-bottom:8px;">Expenses (${v.expenses.length})</div>
                        <table style="width:100%;border-collapse:collapse;font-size:0.84rem;">
                            <thead><tr style="border-bottom:1px solid #e5e7eb;">
                                <th style="text-align:left;padding:6px 8px;font-size:0.7rem;text-transform:uppercase;color:#9ca3af;font-weight:600;">Date</th>
                                <th style="text-align:left;padding:6px 8px;font-size:0.7rem;text-transform:uppercase;color:#9ca3af;font-weight:600;">Vendor</th>
                                <th style="text-align:left;padding:6px 8px;font-size:0.7rem;text-transform:uppercase;color:#9ca3af;font-weight:600;">Category</th>
                                <th style="text-align:right;padding:6px 8px;font-size:0.7rem;text-transform:uppercase;color:#9ca3af;font-weight:600;">Amount</th>
                            </tr></thead>
                            <tbody>${expRows}</tbody>
                        </table>
                    </div>` : ''}

                    <!-- Advance Reconciliation -->
                    ${v.advance ? `
                    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:14px;margin-bottom:16px;">
                        <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;color:#7c3aed;margin-bottom:10px;">Advance Reconciliation</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:0.85rem;">
                            <div><span style="color:#6b7280;font-size:0.72rem;display:block;">Advance</span><strong style="color:#7c3aed;">${formatAmount(v.advance.amount)}</strong></div>
                            <div><span style="color:#6b7280;font-size:0.72rem;display:block;">Expenses</span><strong style="color:#059669;">${formatAmount(v.total_amount)}</strong></div>
                            <div><span style="color:#6b7280;font-size:0.72rem;display:block;">${parseFloat(v.advance.amount) > parseFloat(v.total_amount) ? 'Recoverable' : 'Payable'}</span><strong style="color:${parseFloat(v.advance.amount) > parseFloat(v.total_amount) ? '#d97706' : '#ef4444'};">${formatAmount(Math.abs(parseFloat(v.advance.amount) - parseFloat(v.total_amount)))}</strong></div>
                        </div>
                    </div>` : ''}

                    <!-- History (horizontal flow) -->
                    <div>
                        <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;margin-bottom:10px;">Activity</div>
                        <div style="display:flex;gap:0;align-items:flex-start;padding:8px 0;">
                            ${timelineHTML || '<p style="color:#9ca3af;font-size:0.85rem;">No history</p>'}
                        </div>
                    </div>

                    <!-- Reject form (hidden) -->
                    <div id="rejectFormContainer" style="display:none;margin-top:16px;"></div>
                </div>

                ${actionsHTML}
            </div>
        `;

        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeVoucherDetail(); });
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
    }

    function closeVoucherDetail() {
        const overlay = document.getElementById('voucherDetailOverlay');
        if (overlay) {
            overlay.remove();
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
        }
    }

    // ==================== Approve / Reject / Resubmit ====================

    async function approve(voucherId) {
        try {
            // Get voucher detail before approving (for email)
            const detail = await api.getVoucherDetail(voucherId);
            const result = await api.approveVoucher(voucherId);
            closeVoucherDetail();
            window.expenseTracker?.showNotification('Voucher approved!');
            refreshApprovalBadge();
            await api.logActivity?.('voucher_approved', `Approved voucher ${detail.voucher_number}`);

            // Email: notify next person in chain + always notify employee
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const amt = formatAmount(detail.total_amount);

            if (result.newStatus === 'pending_accountant') {
                // Manager approved → email accountant
                if (detail.accountant?.email) {
                    sendEmailNotification(
                        detail.accountant.email,
                        'Voucher ready for verification',
                        `Voucher ${detail.voucher_number} (${amt}) was approved by ${user.name || 'Manager'}. Please log in to review and verify.`,
                        detail.voucher_number
                    );
                }
                // Also email employee: manager approved, now with accountant
                if (detail.submitter?.email) {
                    sendEmailNotification(
                        detail.submitter.email,
                        'Manager approved your voucher',
                        `Your voucher ${detail.voucher_number} (${amt}) was approved by ${user.name || 'Manager'}. It is now pending accountant verification.`,
                        detail.voucher_number
                    );
                }
            } else if (result.newStatus === 'approved') {
                // Accountant approved → email employee
                if (detail.submitter?.email) {
                    sendEmailNotification(
                        detail.submitter.email,
                        'Your voucher has been approved!',
                        `Great news! Your voucher ${detail.voucher_number} (${amt}) has been fully approved by ${user.name || 'Accountant'}. Reimbursement will be processed.`,
                        detail.voucher_number
                    );
                }
            }

            await loadVoucherList();
        } catch (e) {
            window.expenseTracker?.showNotification('Failed: ' + e.message);
        }
    }

    function showRejectForm(voucherId) {
        const container = document.getElementById('rejectFormContainer');
        if (!container) return;

        container.style.display = 'block';
        container.innerHTML = `
            <div class="approval-reject-form">
                <h4>Rejection Reason *</h4>
                <textarea id="rejectReasonInput" placeholder="Explain what needs to be corrected..." rows="3" required></textarea>
                <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;">
                    <button class="approval-btn approval-btn--cancel" onclick="document.getElementById('rejectFormContainer').style.display='none'">Cancel</button>
                    <button class="approval-btn approval-btn--reject" onclick="approvalWorkflow.confirmReject('${voucherId}')">Confirm Rejection</button>
                </div>
            </div>
        `;
        document.getElementById('rejectReasonInput').focus();
    }

    async function confirmReject(voucherId) {
        const reason = document.getElementById('rejectReasonInput')?.value?.trim();
        if (!reason) {
            window.expenseTracker?.showNotification('Please provide a rejection reason');
            return;
        }

        try {
            // Get detail for email before rejecting
            const detail = await api.getVoucherDetail(voucherId);
            await api.rejectVoucher(voucherId, reason);
            closeVoucherDetail();
            window.expenseTracker?.showNotification('Voucher rejected and sent back to employee');
            await api.logActivity?.('voucher_rejected', `Rejected voucher ${detail.voucher_number}: ${reason}`);

            // Email the employee about rejection
            if (detail.submitter?.email) {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                sendEmailNotification(
                    detail.submitter.email,
                    'Voucher rejected — action needed',
                    `Your voucher ${detail.voucher_number} (${formatAmount(detail.total_amount)}) was rejected by ${user.name || 'Reviewer'}.\n\nReason: ${reason}\n\nPlease review the feedback and resubmit.`,
                    detail.voucher_number
                );
            }

            await loadVoucherList();
            refreshApprovalBadge();
        } catch (e) {
            window.expenseTracker?.showNotification('Failed: ' + e.message);
        }
    }

    async function resubmit(voucherId) {
        try {
            await api.resubmitVoucher(voucherId);
            closeVoucherDetail();
            window.expenseTracker?.showNotification('Voucher resubmitted for approval');
            await api.logActivity?.('voucher_resubmitted', 'Resubmitted voucher after corrections');
            await loadVoucherList();
            window.expenseTracker?.loadExpenses?.();
        } catch (e) {
            window.expenseTracker?.showNotification('Failed: ' + e.message);
        }
    }

    // ==================== Keyboard ====================

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (document.getElementById('voucherDetailOverlay')) closeVoucherDetail();
            else if (document.getElementById('approvalSubmitOverlay')) closeSubmitModal();
            else if (document.getElementById('approvalsPanelOverlay')?.classList.contains('active')) closeApprovalsPanel();
        }
    });

    // ==================== Advance Approval ====================

    async function openAdvanceSubmitModal(advanceData) {
        const orgId = getOrganizationId();
        if (!orgId) return;

        let mgrs, accts;
        try {
            [mgrs, accts] = await Promise.all([
                api.getOrgMembersByRole(orgId, 'manager'),
                api.getOrgMembersByRole(orgId, 'accountant')
            ]);
        } catch (e) {
            window.expenseTracker?.showNotification('Failed to load team: ' + e.message);
            return;
        }
        if (mgrs.length === 0) { window.expenseTracker?.showNotification('No managers found. Ask admin to assign manager roles.'); return; }
        if (accts.length === 0) { window.expenseTracker?.showNotification('No accountants found. Ask admin to assign accountant roles.'); return; }

        const mgrOpts = mgrs.map(m => `<option value="${m.id}">${sanitize(m.name)} (${sanitize(m.email)})</option>`).join('');
        const acctOpts = accts.map(a => `<option value="${a.id}">${sanitize(a.name)} (${sanitize(a.email)})</option>`).join('');

        const overlay = document.createElement('div');
        overlay.id = 'advanceSubmitOverlay';
        overlay.className = 'approval-overlay';
        overlay.innerHTML = `
            <div class="approval-modal" style="max-width:500px;">
                <div class="approval-modal__header">
                    <h2>Submit Advance for Approval</h2>
                    <button class="approval-close-btn" onclick="approvalWorkflow.closeAdvanceSubmitModal()">&times;</button>
                </div>
                <div class="approval-modal__body" style="padding:20px;">
                    <div style="background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.15);border-radius:10px;padding:16px;margin-bottom:20px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <span style="font-weight:700;font-size:1rem;">${sanitize(advanceData.projectName)}</span>
                            <span style="font-size:1.1rem;font-weight:700;color:#10b981;">₹${parseFloat(advanceData.amount).toLocaleString('en-IN')}</span>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <span class="visit-type-badge visit-type-badge--${advanceData.visitType || 'project'}">${advanceData.visitType || 'project'}</span>
                            ${advanceData.notes ? `<span style="font-size:0.78rem;color:#64748b;">${sanitize(advanceData.notes)}</span>` : ''}
                        </div>
                    </div>
                    <div class="approval-form-group">
                        <label>Approving Manager</label>
                        <select id="advanceManagerSelect" class="approval-select">${mgrOpts}</select>
                    </div>
                    <div class="approval-form-group">
                        <label>Approving Accountant</label>
                        <select id="advanceAccountantSelect" class="approval-select">${acctOpts}</select>
                    </div>
                </div>
                <div class="approval-modal__footer">
                    <button class="approval-btn approval-btn--cancel" onclick="approvalWorkflow.closeAdvanceSubmitModal()">Cancel</button>
                    <button class="approval-btn approval-btn--submit" id="advanceSubmitBtn" onclick="approvalWorkflow.submitAdvanceForApproval()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        Submit for Approval
                    </button>
                </div>
            </div>
        `;
        overlay._advanceData = advanceData;
        document.body.appendChild(overlay);
        document.body.classList.add('modal-open');
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAdvanceSubmitModal(); });
    }

    function closeAdvanceSubmitModal() {
        const overlay = document.getElementById('advanceSubmitOverlay');
        if (overlay) { overlay.remove(); document.body.classList.remove('modal-open'); }
    }

    async function submitAdvanceForApproval() {
        const overlay = document.getElementById('advanceSubmitOverlay');
        if (!overlay) return;

        const managerId = document.getElementById('advanceManagerSelect')?.value;
        const accountantId = document.getElementById('advanceAccountantSelect')?.value;
        const advData = overlay._advanceData;

        if (!managerId || !accountantId) {
            window.expenseTracker?.showNotification('Please select both manager and accountant');
            return;
        }

        const btn = document.getElementById('advanceSubmitBtn');
        btn.disabled = true;
        btn.innerHTML = 'Submitting...';

        try {
            const result = await api.createAdvance(advData.projectName, advData.amount, advData.notes, advData.visitType, managerId, accountantId);
            closeAdvanceSubmitModal();
            window.expenseTracker?.showNotification(`Advance of ₹${parseFloat(advData.amount).toLocaleString('en-IN')} submitted for approval!`);
            await api.logActivity?.('advance_submitted', `Submitted advance of ₹${advData.amount} for ${advData.projectName}`);

            // Notify manager (in-app)
            if (managerId) {
                api.createNotification(managerId, 'advance_submitted', 'New advance request',
                    `${JSON.parse(localStorage.getItem('user') || '{}').name || 'An employee'} requests ₹${parseFloat(advData.amount).toLocaleString('en-IN')} advance for ${advData.projectName}.`,
                    result?.id);
            }

            // Email manager
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const orgId = getOrganizationId();
            const [mgrs] = await Promise.all([api.getOrgMembersByRole(orgId, 'manager')]);
            const mgr = mgrs.find(m => m.id === managerId);
            if (mgr?.email && typeof sendEmailNotification === 'function') {
                sendEmailNotification(mgr.email, 'New advance request for approval',
                    `${user.name || 'An employee'} requests an advance of ₹${parseFloat(advData.amount).toLocaleString('en-IN')} for ${advData.projectName}. Please log in to review.`,
                    'Advance Request');
            }

            window.expenseTracker?.loadAdvances?.();
        } catch (e) {
            window.expenseTracker?.showNotification('Failed: ' + e.message);
            btn.disabled = false;
            btn.innerHTML = 'Submit for Approval';
        }
    }

    // Advance approve/reject (called from voucher detail or approvals panel)
    async function approveAdvance(advanceId) {
        try {
            const detail = await api.getAdvanceDetail(advanceId);

            // Check if employee has pending voucher submissions before approving
            const pendingAdvances = await api.getEmployeePendingVoucherAdvances(detail.user_id);
            if (pendingAdvances.length > 0) {
                const shouldProceed = await showPendingVoucherWarning(detail, pendingAdvances);
                if (!shouldProceed) return; // Accountant chose not to approve
            }

            const result = await api.approveAdvance(advanceId);
            window.expenseTracker?.showNotification('Advance approved!');

            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const amt = `₹${parseFloat(detail.amount).toLocaleString('en-IN')}`;

            // In-app notifications
            if (result.newStatus === 'pending_accountant' && detail.accountant_id) {
                api.createNotification(detail.accountant_id, 'advance_submitted', 'Advance ready for verification',
                    `Advance ${amt} for ${detail.project_name} approved by ${user.name || 'Manager'}. Please review.`, advanceId);
            }
            if (detail.user_id) {
                api.createNotification(detail.user_id, 'advance_approved',
                    result.newStatus === 'active' ? 'Advance approved!' : 'Manager approved your advance',
                    `Your advance ${amt} for ${detail.project_name} was approved by ${user.name || 'Approver'}.${result.newStatus === 'pending_accountant' ? ' Pending accountant verification.' : ' Funds will be transferred.'}`,
                    advanceId);
            }

            // Email notifications
            if (result.newStatus === 'pending_accountant' && detail.accountant?.email && typeof sendEmailNotification === 'function') {
                sendEmailNotification(detail.accountant.email, 'Advance request ready for verification',
                    `Advance ${amt} for ${detail.project_name} was approved by ${user.name || 'Manager'}. Please review and process.`, 'Advance Approval');
            }
            if (result.newStatus === 'active' && detail.submitter?.email && typeof sendEmailNotification === 'function') {
                sendEmailNotification(detail.submitter.email, 'Your advance has been approved!',
                    `Your advance ${amt} for ${detail.project_name} has been fully approved. Funds will be transferred.`, 'Advance Approved');
            }
            if (detail.submitter?.email && result.newStatus === 'pending_accountant' && typeof sendEmailNotification === 'function') {
                sendEmailNotification(detail.submitter.email, 'Manager approved your advance',
                    `Your advance ${amt} for ${detail.project_name} was approved by ${user.name || 'Manager'}. Pending accountant verification.`, 'Advance Update');
            }

            closeVoucherDetail();
            await loadVoucherList();
            refreshApprovalBadge();
        } catch (e) {
            window.expenseTracker?.showNotification('Failed: ' + e.message);
        }
    }

    /**
     * Show warning popup when employee has pending voucher submissions.
     * Returns a Promise that resolves to true (proceed) or false (cancel).
     */
    function showPendingVoucherWarning(currentAdvance, pendingAdvances) {
        return new Promise((resolve) => {
            document.getElementById('pendingVoucherWarningOverlay')?.remove();

            const empName = currentAdvance.submitter?.name || 'This employee';
            const totalPending = pendingAdvances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

            const rows = pendingAdvances.map(adv => {
                const isOverdue = adv.daysRemaining <= 0;
                const isCritical = adv.daysRemaining <= 3 && !isOverdue;
                const urgencyClass = isOverdue ? 'pvw--overdue' : isCritical ? 'pvw--critical' : 'pvw--warning';
                const statusText = isOverdue
                    ? `OVERDUE by ${Math.abs(adv.daysRemaining)} day${Math.abs(adv.daysRemaining) !== 1 ? 's' : ''}`
                    : `${adv.daysRemaining} day${adv.daysRemaining !== 1 ? 's' : ''} remaining`;

                return `
                    <div class="pvw__row ${urgencyClass}">
                        <div class="pvw__project">${adv.project_name || 'Untitled'}</div>
                        <div class="pvw__amount">\u20B9${Number(adv.amount).toLocaleString('en-IN')}</div>
                        <div class="pvw__status">${statusText}</div>
                        <div class="pvw__elapsed">${adv.daysPassed} day${adv.daysPassed !== 1 ? 's' : ''} since disbursement</div>
                    </div>
                `;
            }).join('');

            const overlay = document.createElement('div');
            overlay.id = 'pendingVoucherWarningOverlay';
            overlay.innerHTML = `
                <div class="pvw__backdrop"></div>
                <div class="pvw__modal">
                    <div class="pvw__header">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <div>
                            <h3 class="pvw__title">Pending Voucher Submissions</h3>
                            <p class="pvw__subtitle">${empName} has ${pendingAdvances.length} active advance${pendingAdvances.length > 1 ? 's' : ''} with pending voucher submissions</p>
                        </div>
                    </div>
                    <div class="pvw__body">
                        <div class="pvw__summary">
                            <div class="pvw__summary-item">
                                <span class="pvw__summary-label">Active Advances</span>
                                <span class="pvw__summary-value">${pendingAdvances.length}</span>
                            </div>
                            <div class="pvw__summary-item">
                                <span class="pvw__summary-label">Total Outstanding</span>
                                <span class="pvw__summary-value">\u20B9${totalPending.toLocaleString('en-IN')}</span>
                            </div>
                            <div class="pvw__summary-item">
                                <span class="pvw__summary-label">New Request</span>
                                <span class="pvw__summary-value">\u20B9${Number(currentAdvance.amount).toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                        <div class="pvw__list">${rows}</div>
                    </div>
                    <div class="pvw__footer">
                        <p class="pvw__notice">Approving this advance while previous vouchers are pending may increase financial risk.</p>
                        <div class="pvw__actions">
                            <button type="button" class="pvw__btn pvw__btn--cancel" id="pvwCancel">Hold Approval</button>
                            <button type="button" class="pvw__btn pvw__btn--approve" id="pvwProceed">Approve Anyway</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            document.getElementById('pvwCancel').addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });
            document.getElementById('pvwProceed').addEventListener('click', () => {
                overlay.remove();
                resolve(true);
            });
            overlay.querySelector('.pvw__backdrop').addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });
        });
    }

    async function rejectAdvance(advanceId) {
        const reason = prompt('Reason for rejection (optional):') || '';
        try {
            const detail = await api.getAdvanceDetail(advanceId);
            await api.rejectAdvance(advanceId, reason);
            window.expenseTracker?.showNotification('Advance rejected');

            // In-app notification to employee
            if (detail.user_id) {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                api.createNotification(detail.user_id, 'advance_rejected', 'Advance rejected',
                    `Your advance of ₹${parseFloat(detail.amount).toLocaleString('en-IN')} for ${detail.project_name} was rejected by ${user.name || 'Approver'}.${reason ? ' Reason: ' + reason : ' You can edit and resubmit.'}`,
                    advanceId);
            }

            if (detail.submitter?.email && typeof sendEmailNotification === 'function') {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                sendEmailNotification(detail.submitter.email, 'Your advance was rejected',
                    `Your advance of ₹${parseFloat(detail.amount).toLocaleString('en-IN')} for ${detail.project_name} was rejected by ${user.name}. ${reason ? 'Reason: ' + reason : 'You can edit and resubmit.'}`,
                    'Advance Rejected');
            }

            closeVoucherDetail();
            await loadVoucherList();
            refreshApprovalBadge();
        } catch (e) {
            window.expenseTracker?.showNotification('Failed: ' + e.message);
        }
    }

    return {
        initApprovalBadge,
        openSubmitModal,
        closeSubmitModal,
        submitVoucher,
        openApprovalsPanel,
        closeApprovalsPanel,
        switchTab,
        openVoucherDetail,
        closeVoucherDetail,
        approve,
        showRejectForm,
        confirmReject,
        resubmit,
        // Advance approval
        openAdvanceSubmitModal,
        closeAdvanceSubmitModal,
        submitAdvanceForApproval,
        approveAdvance,
        rejectAdvance,
        openAdvanceDetail
    };
})();

window.approvalWorkflow = approvalWorkflow;
