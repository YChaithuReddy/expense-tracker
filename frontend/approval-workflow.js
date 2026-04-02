/**
 * Approval Workflow — Voucher submission and approval management
 * Handles: Submit for Approval modal, Voucher list, Approve/Reject actions
 */
const approvalWorkflow = (() => {
    'use strict';

    let currentTab = 'my-vouchers';
    let managers = [];
    let accountants = [];

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

        // Get selected expenses (or all if none selected)
        let expenses = tracker.getSelectedExpenses();
        if (expenses.length === 0) {
            window.expenseTracker?.showNotification('Please select expenses to submit for approval');
            return;
        }

        // Filter out already-submitted expenses
        const submittable = expenses.filter(e => !e.voucher_status || e.voucher_status === 'rejected');
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

                    <!-- Purpose -->
                    <div class="approval-form-group">
                        <label>Purpose / Notes</label>
                        <textarea id="approvalPurpose" placeholder="Brief description of expenses (e.g., Site visit to Hyderabad, Jan 15-18)" rows="3"></textarea>
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
        document.body.appendChild(overlay);
        document.body.classList.add('modal-open');

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
        const expenseIds = overlay._expenseIds;

        if (!managerId) { window.expenseTracker?.showNotification('Please select a manager'); return; }
        if (!accountantId) { window.expenseTracker?.showNotification('Please select an accountant'); return; }

        const btn = document.getElementById('approvalSubmitBtn');
        btn.disabled = true;
        btn.innerHTML = 'Submitting...';

        try {
            const orgId = getOrganizationId();
            const result = await api.createVoucher(orgId, managerId, accountantId, expenseIds, purpose);

            closeSubmitModal();
            window.expenseTracker?.showNotification(`Voucher ${result.data.voucher_number} submitted for approval!`);
            await api.logActivity?.('voucher_submitted', `Submitted voucher ${result.data.voucher_number} (${formatAmount(result.data.total_amount)}) for approval`);

            // Send email to manager
            const selectedManager = managers.find(m => m.id === managerId);
            if (selectedManager?.email) {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                sendEmailNotification(
                    selectedManager.email,
                    'New voucher for your approval',
                    `${user.name || 'An employee'} submitted voucher ${result.data.voucher_number} (${formatAmount(result.data.total_amount)}) for your approval. Please log in to review.`,
                    result.data.voucher_number
                );
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

        body.innerHTML = '<div style="text-align:center;padding:40px;color:#5a6180;">Loading vouchers...</div>';

        try {
            let vouchers;
            if (currentTab === 'my-vouchers') {
                vouchers = await api.getMyVouchers();
            } else {
                vouchers = await api.getVouchersForApproval();
            }
            renderVoucherList(vouchers);
        } catch (e) {
            body.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444;">Error: ${sanitize(e.message)}</div>`;
        }
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
        const overlay = document.createElement('div');
        overlay.id = 'voucherDetailOverlay';
        overlay.className = 'approval-overlay';

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const isManagerPending = v.status === 'pending_manager' && v.manager_id === user.id;
        const isAccountantPending = ['manager_approved', 'pending_accountant'].includes(v.status) && v.accountant_id === user.id;
        const canAct = isManagerPending || isAccountantPending;
        const isOwnerRejected = v.status === 'rejected' && v.submitted_by === user.id;

        // Expenses list
        const expensesHTML = (v.expenses || []).map(e => `
            <div class="approval-detail-expense">
                <div class="approval-detail-expense__info">
                    <span class="approval-detail-expense__date">${e.date || ''}</span>
                    <span class="approval-detail-expense__desc">${sanitize(e.vendor || e.description)}</span>
                    <span class="approval-detail-expense__cat">${sanitize(e.category)}</span>
                </div>
                <span class="approval-detail-expense__amount">${formatAmount(e.amount)}</span>
            </div>
        `).join('');

        // Timeline
        const timelineHTML = (v.history || []).map(h => {
            const actionLabels = {
                created: 'Created', submitted: 'Submitted', manager_approved: 'Manager Approved',
                manager_rejected: 'Manager Rejected', accountant_approved: 'Accountant Approved',
                accountant_rejected: 'Accountant Rejected', resubmitted: 'Resubmitted', reimbursed: 'Reimbursed'
            };
            const isReject = h.action.includes('rejected');
            const isApprove = h.action.includes('approved');
            const dotColor = isReject ? '#ef4444' : isApprove ? '#10b981' : '#a78bfa';

            return `
                <div class="approval-timeline-item">
                    <div class="approval-timeline-dot" style="background:${dotColor};"></div>
                    <div class="approval-timeline-content">
                        <div class="approval-timeline-action">${actionLabels[h.action] || h.action}</div>
                        <div class="approval-timeline-actor">${sanitize(h.actor?.name || 'System')}</div>
                        ${h.comments ? `<div class="approval-timeline-comment">${sanitize(h.comments)}</div>` : ''}
                        <div class="approval-timeline-time">${relativeTime(h.created_at)}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Action buttons
        let actionsHTML = '';
        if (canAct) {
            actionsHTML = `
                <div class="approval-detail-actions">
                    <button class="approval-btn approval-btn--reject" onclick="approvalWorkflow.showRejectForm('${v.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        Reject
                    </button>
                    <button class="approval-btn approval-btn--approve" onclick="approvalWorkflow.approve('${v.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        Approve
                    </button>
                </div>
            `;
        } else if (isOwnerRejected) {
            actionsHTML = `
                <div class="approval-detail-actions">
                    <button class="approval-btn approval-btn--resubmit" onclick="approvalWorkflow.resubmit('${v.id}')">Resubmit for Approval</button>
                </div>
            `;
        }

        overlay.innerHTML = `
            <div class="approval-detail-modal">
                <div class="approval-modal__header">
                    <div>
                        <h2>${sanitize(v.voucher_number)}</h2>
                        <div style="margin-top:4px;">${statusBadge(v.status)}</div>
                    </div>
                    <button class="approval-modal__close" onclick="approvalWorkflow.closeVoucherDetail()">&times;</button>
                </div>

                <div class="approval-detail-body">
                    <!-- Info Cards -->
                    <div class="approval-detail-info-grid">
                        <div class="approval-detail-info-card">
                            <span class="approval-detail-info-label">Submitted By</span>
                            <span class="approval-detail-info-value">${sanitize(v.submitter?.name)}</span>
                            <small>${sanitize(v.submitter?.department || '')}</small>
                        </div>
                        <div class="approval-detail-info-card">
                            <span class="approval-detail-info-label">Manager</span>
                            <span class="approval-detail-info-value">${sanitize(v.manager?.name)}</span>
                        </div>
                        <div class="approval-detail-info-card">
                            <span class="approval-detail-info-label">Accountant</span>
                            <span class="approval-detail-info-value">${sanitize(v.accountant?.name)}</span>
                        </div>
                        <div class="approval-detail-info-card">
                            <span class="approval-detail-info-label">Total Amount</span>
                            <span class="approval-detail-info-value" style="color:#10b981;font-size:1.1rem;">${formatAmount(v.total_amount)}</span>
                        </div>
                    </div>

                    ${v.purpose ? `<div class="approval-detail-purpose"><strong>Purpose:</strong> ${sanitize(v.purpose)}</div>` : ''}
                    ${v.rejection_reason ? `<div class="approval-detail-rejection"><strong>Rejection Reason:</strong> ${sanitize(v.rejection_reason)}</div>` : ''}

                    <!-- Expenses -->
                    <div class="approval-detail-section">
                        <h3>Expenses (${v.expenses?.length || 0})</h3>
                        <div class="approval-detail-expenses">${expensesHTML || '<p style="color:#5a6180;">No expenses</p>'}</div>
                    </div>

                    <!-- Timeline -->
                    <div class="approval-detail-section">
                        <h3>History</h3>
                        <div class="approval-timeline">${timelineHTML || '<p style="color:#5a6180;">No history</p>'}</div>
                    </div>

                    ${actionsHTML}

                    <!-- Reject form (hidden) -->
                    <div id="rejectFormContainer" style="display:none;"></div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.classList.add('modal-open');
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeVoucherDetail(); });
    }

    function closeVoucherDetail() {
        const overlay = document.getElementById('voucherDetailOverlay');
        if (overlay) {
            overlay.remove();
            document.body.classList.remove('modal-open');
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
            await api.logActivity?.('voucher_approved', `Approved voucher ${detail.voucher_number}`);

            // Email: notify next person in chain
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (result.newStatus === 'pending_accountant' && detail.accountant?.email) {
                sendEmailNotification(
                    detail.accountant.email,
                    'Voucher ready for verification',
                    `Voucher ${detail.voucher_number} (${formatAmount(detail.total_amount)}) was approved by ${user.name || 'Manager'}. Please log in to review and verify.`,
                    detail.voucher_number
                );
            } else if (result.newStatus === 'approved' && detail.submitter?.email) {
                sendEmailNotification(
                    detail.submitter.email,
                    'Your voucher has been approved!',
                    `Great news! Your voucher ${detail.voucher_number} (${formatAmount(detail.total_amount)}) has been approved by ${user.name || 'Accountant'}.`,
                    detail.voucher_number
                );
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

    return {
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
        resubmit
    };
})();

window.approvalWorkflow = approvalWorkflow;
