/**
 * Submit Wizard - One-Click Submit All
 * Walks users through selecting expenses and submitting reimbursements
 * to multiple destinations in a step-by-step flow.
 */
const submitWizard = (() => {
    // ── State ──
    let currentStep = 1;
    let selectedExpenseIds = new Set();
    let selectedDestinations = new Set();
    let results = [];

    // ── DOM refs (resolved lazily) ──
    const el = (id) => document.getElementById(id);
    const modal = () => el('submitWizardModal');
    const body = () => el('wizardBody');
    const footer = () => el('wizardFooter');
    const stepIndicator = () => el('wizardStepIndicator');

    // ── Destinations config ──
    const isCompany = typeof isCompanyMode === 'function' && isCompanyMode();
    let managers = [];
    let accountants = [];

    const DESTINATIONS = [
        {
            id: 'google-sheets',
            label: 'Export to Google Sheets',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
            description: 'Add selected expenses to your Google Sheet',
            checked: true,
            show: true
        },
        {
            id: 'pdf-package',
            label: 'Generate PDF Package',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
            description: 'Generate reimbursement PDF with bills attached',
            checked: true,
            show: true
        },
        {
            id: 'email',
            label: 'Email to Accounts',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
            description: 'Send reimbursement package via email',
            checked: false,
            show: true
        },
        {
            id: 'approval',
            label: 'Submit for Approval',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            description: 'Send to manager for approval, then accountant for verification',
            checked: true,
            show: isCompany
        }
    ];

    const STEP_LABELS = ['Select', 'Destinations', 'Processing', 'Done'];

    // ── Helpers ──
    function sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return '\u20B9' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    function getExpenses() {
        return (window.expenseTracker && window.expenseTracker.expenses) || [];
    }

    function getSelectedExpenses() {
        const all = getExpenses();
        return all.filter(e => selectedExpenseIds.has(e.id));
    }

    // ── Scroll lock ──
    let wasBodyLocked = false;
    function lockScroll() {
        wasBodyLocked = document.body.style.overflow === 'hidden';
        document.body.style.overflow = 'hidden';
    }
    function unlockScroll() {
        if (!wasBodyLocked) {
            document.body.style.overflow = '';
        }
    }

    // ── Render step indicator ──
    function renderStepIndicator() {
        const container = stepIndicator();
        if (!container) return;

        container.innerHTML = STEP_LABELS.map((label, i) => {
            const stepNum = i + 1;
            let cls = 'wizard-step-dot';
            if (stepNum < currentStep) cls += ' completed';
            else if (stepNum === currentStep) cls += ' active';

            return `<div class="${cls}">
                <span class="wizard-step-num">${stepNum < currentStep ? '&#10003;' : stepNum}</span>
                <span class="wizard-step-label">${label}</span>
            </div>`;
        }).join('<div class="wizard-step-line"></div>');
    }

    // ── Step 1: Select Expenses ──
    function renderStep1() {
        const expenses = getExpenses();
        const b = body();
        const f = footer();
        if (!b || !f) return;

        const allChecked = expenses.length > 0 && expenses.every(e => selectedExpenseIds.has(e.id));

        let listHTML = '';
        if (expenses.length === 0) {
            listHTML = `<div class="wizard-empty">No expenses found. Add some expenses first.</div>`;
        } else {
            listHTML = `
                <label class="wizard-select-all">
                    <input type="checkbox" id="wizardSelectAll" ${allChecked ? 'checked' : ''}>
                    <span>Select All (${expenses.length})</span>
                </label>
                <div class="wizard-expense-list">
                    ${expenses.map(exp => {
                        const checked = selectedExpenseIds.has(exp.id) ? 'checked' : '';
                        return `<label class="wizard-expense-row" data-id="${sanitize(exp.id)}">
                            <input type="checkbox" class="wizard-exp-cb" data-id="${sanitize(exp.id)}" ${checked}>
                            <span class="wizard-exp-date">${formatDate(exp.date)}</span>
                            <span class="wizard-exp-vendor">${sanitize(exp.vendor) || 'N/A'}</span>
                            <span class="wizard-exp-amount">${formatCurrency(exp.amount)}</span>
                            <span class="wizard-exp-category">${sanitize(exp.category) || ''}</span>
                        </label>`;
                    }).join('')}
                </div>`;
        }

        b.innerHTML = listHTML;
        updateStep1Summary();

        // Footer
        f.innerHTML = `
            <div class="wizard-summary" id="wizardSummary"></div>
            <div class="wizard-actions">
                <button class="wizard-btn wizard-btn-secondary" onclick="submitWizard.close()">Cancel</button>
                <button class="wizard-btn wizard-btn-primary" id="wizardNextBtn" disabled>Next</button>
            </div>`;

        updateStep1Summary();

        // Events
        const selectAll = el('wizardSelectAll');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                if (e.target.checked) {
                    expenses.forEach(exp => selectedExpenseIds.add(exp.id));
                } else {
                    selectedExpenseIds.clear();
                }
                b.querySelectorAll('.wizard-exp-cb').forEach(cb => {
                    cb.checked = e.target.checked;
                });
                updateStep1Summary();
            });
        }

        b.querySelectorAll('.wizard-exp-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                if (e.target.checked) {
                    selectedExpenseIds.add(id);
                } else {
                    selectedExpenseIds.delete(id);
                }
                // Update select-all state
                if (selectAll) {
                    selectAll.checked = expenses.length > 0 && expenses.every(exp => selectedExpenseIds.has(exp.id));
                }
                updateStep1Summary();
            });
        });

        const nextBtn = el('wizardNextBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (selectedExpenseIds.size > 0) {
                    currentStep = 2;
                    renderCurrentStep();
                }
            });
        }
    }

    function updateStep1Summary() {
        const summaryEl = el('wizardSummary');
        const nextBtn = el('wizardNextBtn');
        if (!summaryEl) return;

        const count = selectedExpenseIds.size;
        const total = getSelectedExpenses().reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        if (count === 0) {
            summaryEl.textContent = 'No expenses selected';
        } else {
            summaryEl.textContent = `Selected: ${count} expense${count !== 1 ? 's' : ''} totaling ${formatCurrency(total)}`;
        }

        if (nextBtn) {
            nextBtn.disabled = count === 0;
        }
    }

    // ── Step 2: Choose Destinations ──
    async function renderStep2() {
        const b = body();
        const f = footer();
        if (!b || !f) return;

        // Load managers/accountants for approval dropdown (company mode)
        if (isCompany && managers.length === 0) {
            try {
                const orgId = typeof getOrganizationId === 'function' ? getOrganizationId() : null;
                if (orgId) {
                    [managers, accountants] = await Promise.all([
                        api.getOrgMembersByRole(orgId, 'manager'),
                        api.getOrgMembersByRole(orgId, 'accountant')
                    ]);
                }
            } catch (e) { console.warn('Failed to load managers/accountants:', e); }
        }

        // Reset destinations to defaults
        selectedDestinations.clear();
        DESTINATIONS.forEach(d => { if (d.checked && d.show) selectedDestinations.add(d.id); });

        const visibleDests = DESTINATIONS.filter(d => d.show);

        // Build manager/accountant dropdowns HTML
        const managerOptions = managers.map(m => `<option value="${m.id}">${sanitize(m.name)} (${sanitize(m.email)})</option>`).join('');
        const accountantOptions = accountants.map(a => `<option value="${a.id}">${sanitize(a.name)} (${sanitize(a.email)})</option>`).join('');

        const approvalFields = isCompany ? `
            <div class="wizard-approval-fields" id="wizardApprovalFields" style="display:${selectedDestinations.has('approval') ? 'block' : 'none'};">
                <div class="wizard-approval-field">
                    <label>Approving Manager *</label>
                    <select id="wizardManagerSelect">
                        <option value="">Select manager...</option>
                        ${managerOptions}
                    </select>
                </div>
                <div class="wizard-approval-field">
                    <label>Verifying Accountant *</label>
                    <select id="wizardAccountantSelect">
                        <option value="">Select accountant...</option>
                        ${accountantOptions}
                    </select>
                </div>
                <div class="wizard-approval-field">
                    <label>Purpose / Notes</label>
                    <textarea id="wizardPurpose" rows="2" placeholder="Brief description (e.g., Site visit to Hyderabad, Jan 15-18)"></textarea>
                </div>
            </div>` : '';

        b.innerHTML = `
            <div class="wizard-dest-intro">Choose where to submit your ${selectedExpenseIds.size} selected expenses:</div>
            <div class="wizard-dest-list">
                ${visibleDests.map(dest => {
                    const checked = selectedDestinations.has(dest.id) ? 'checked' : '';
                    return `<label class="wizard-dest-row">
                        <input type="checkbox" class="wizard-dest-cb" data-id="${dest.id}" ${checked}>
                        <span class="wizard-dest-icon">${dest.icon}</span>
                        <div class="wizard-dest-info">
                            <span class="wizard-dest-label">${dest.label}</span>
                            <span class="wizard-dest-desc">${dest.description}</span>
                        </div>
                    </label>`;
                }).join('')}
            </div>
            ${approvalFields}`;

        f.innerHTML = `
            <div class="wizard-summary" id="wizardDestSummary"></div>
            <div class="wizard-actions">
                <button class="wizard-btn wizard-btn-secondary" id="wizardBackBtn">Back</button>
                <button class="wizard-btn wizard-btn-primary" id="wizardSubmitBtn">Submit</button>
            </div>`;

        updateStep2Summary();

        // Events
        b.querySelectorAll('.wizard-dest-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                if (e.target.checked) {
                    selectedDestinations.add(id);
                } else {
                    selectedDestinations.delete(id);
                }
                // Show/hide approval fields
                const approvalFieldsEl = el('wizardApprovalFields');
                if (approvalFieldsEl) {
                    approvalFieldsEl.style.display = selectedDestinations.has('approval') ? 'block' : 'none';
                }
                updateStep2Summary();
            });
        });

        el('wizardBackBtn').addEventListener('click', () => {
            currentStep = 1;
            renderCurrentStep();
        });

        el('wizardSubmitBtn').addEventListener('click', () => {
            // Validate approval fields if approval selected
            if (selectedDestinations.has('approval')) {
                const mgr = el('wizardManagerSelect')?.value;
                const acct = el('wizardAccountantSelect')?.value;
                if (!mgr) {
                    window.expenseTracker?.showNotification('Please select a manager for approval');
                    return;
                }
                if (!acct) {
                    window.expenseTracker?.showNotification('Please select an accountant for verification');
                    return;
                }
            }
            if (selectedDestinations.size > 0) {
                currentStep = 3;
                renderCurrentStep();
            }
        });
    }

    function updateStep2Summary() {
        const summaryEl = el('wizardDestSummary');
        const submitBtn = el('wizardSubmitBtn');
        const count = selectedDestinations.size;

        if (summaryEl) {
            summaryEl.textContent = count === 0
                ? 'Select at least one destination'
                : `${count} destination${count !== 1 ? 's' : ''} selected`;
        }
        if (submitBtn) {
            submitBtn.disabled = count === 0;
        }
    }

    // ── Step 3: Processing ──
    async function renderStep3() {
        const b = body();
        const f = footer();
        if (!b || !f) return;

        results = [];
        const destinations = Array.from(selectedDestinations);
        const selected = getSelectedExpenses();

        // Build progress list
        const destLabels = {
            'google-sheets': 'Exporting to Google Sheets',
            'pdf-package': 'Generating PDF Package',
            'email': 'Sending email',
            'approval': 'Submitting for Approval'
        };

        b.innerHTML = `
            <div class="wizard-processing-list">
                ${destinations.map(id => `
                    <div class="wizard-proc-row" id="wizardProc-${id}">
                        <span class="wizard-proc-icon wizard-proc-pending">
                            <span class="wizard-spinner"></span>
                        </span>
                        <span class="wizard-proc-text">${destLabels[id] || id}...</span>
                    </div>
                `).join('')}
            </div>`;

        f.innerHTML = `
            <div class="wizard-summary">Processing... please wait</div>
            <div class="wizard-actions">
                <button class="wizard-btn wizard-btn-secondary" disabled>Back</button>
                <button class="wizard-btn wizard-btn-primary" disabled>Please wait...</button>
            </div>`;

        // Process each destination sequentially
        for (const destId of destinations) {
            const row = el(`wizardProc-${destId}`);
            if (!row) continue;

            // Mark as in-progress
            row.classList.add('in-progress');

            try {
                let resultText = '';

                switch (destId) {
                    case 'google-sheets': {
                        const svc = window.googleSheetsService;
                        if (!svc) throw new Error('Google Sheets service not available');
                        await svc.initialize();
                        const res = await svc.exportExpenses(selected);
                        if (res && res.success) {
                            resultText = `Exported ${selected.length} expenses to Google Sheets`;
                        } else {
                            throw new Error((res && res.message) || 'Export failed');
                        }
                        break;
                    }
                    case 'pdf-package': {
                        const tracker = window.expenseTracker;
                        if (!tracker) throw new Error('Expense tracker not available');
                        await tracker.generateCombinedReimbursementPDFWithEmployeeInfo();
                        resultText = `PDF package generated (${selected.length} expenses)`;
                        break;
                    }
                    case 'email': {
                        resultText = 'Open Email from PDF Library to send';
                        break;
                    }
                    case 'approval': {
                        const managerId = el('wizardManagerSelect')?.value;
                        const accountantId = el('wizardAccountantSelect')?.value;
                        const purpose = el('wizardPurpose')?.value?.trim() || '';
                        const orgId = typeof getOrganizationId === 'function' ? getOrganizationId() : null;

                        if (!managerId || !accountantId || !orgId) {
                            throw new Error('Manager, accountant, and organization are required');
                        }

                        const expenseIds = selected.map(e => e.id);
                        const voucherResult = await api.createVoucher(orgId, managerId, accountantId, expenseIds, purpose);

                        if (voucherResult?.success) {
                            resultText = `Voucher ${voucherResult.data.voucher_number} submitted for approval`;

                            // Send email to manager
                            const mgr = managers.find(m => m.id === managerId);
                            if (mgr?.email) {
                                const user = JSON.parse(localStorage.getItem('user') || '{}');
                                const amt = formatCurrency(voucherResult.data.total_amount);
                                api.sendNotificationEmail(
                                    mgr.email,
                                    'New voucher for your approval',
                                    `${user.name || 'An employee'} submitted voucher ${voucherResult.data.voucher_number} (${amt}) for your approval. Please log in to review.`,
                                    voucherResult.data.voucher_number
                                ).catch(() => {});
                            }

                            // Log activity
                            api.logActivity?.('voucher_submitted', `Submitted voucher ${voucherResult.data.voucher_number}`);
                        } else {
                            throw new Error('Failed to create voucher');
                        }
                        break;
                    }
                    default:
                        resultText = 'Unknown destination';
                }

                // Mark success
                row.classList.remove('in-progress');
                row.classList.add('success');
                row.querySelector('.wizard-proc-icon').innerHTML = '<span class="wizard-check">&#10003;</span>';
                row.querySelector('.wizard-proc-text').textContent = resultText;
                results.push({ id: destId, success: true, message: resultText });

            } catch (err) {
                // Mark failure
                row.classList.remove('in-progress');
                row.classList.add('error');
                row.querySelector('.wizard-proc-icon').innerHTML = '<span class="wizard-cross">&#10007;</span>';
                row.querySelector('.wizard-proc-text').textContent = `Failed: ${err.message || 'Unknown error'}`;
                results.push({ id: destId, success: false, message: err.message || 'Unknown error' });
            }
        }

        // All done, move to step 4
        currentStep = 4;
        renderCurrentStep();
    }

    // ── Step 4: Done ──
    function renderStep4() {
        const b = body();
        const f = footer();
        if (!b || !f) return;

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        let statusIcon, statusText;
        if (failCount === 0) {
            statusIcon = '<span class="wizard-done-icon success">&#10003;</span>';
            statusText = 'All submissions completed successfully!';
        } else if (successCount === 0) {
            statusIcon = '<span class="wizard-done-icon error">&#10007;</span>';
            statusText = 'All submissions failed. Please try again.';
        } else {
            statusIcon = '<span class="wizard-done-icon partial">!</span>';
            statusText = `${successCount} succeeded, ${failCount} failed.`;
        }

        b.innerHTML = `
            <div class="wizard-done-header">
                ${statusIcon}
                <div class="wizard-done-text">${statusText}</div>
            </div>
            <div class="wizard-done-results">
                ${results.map(r => `
                    <div class="wizard-done-row ${r.success ? 'success' : 'error'}">
                        <span class="wizard-done-marker">${r.success ? '&#10003;' : '&#10007;'}</span>
                        <span>${sanitize(r.message)}</span>
                    </div>
                `).join('')}
            </div>`;

        f.innerHTML = `
            <div class="wizard-summary">${selectedExpenseIds.size} expenses processed</div>
            <div class="wizard-actions">
                <button class="wizard-btn wizard-btn-primary" id="wizardCloseBtn">Close</button>
            </div>`;

        el('wizardCloseBtn').addEventListener('click', close);
    }

    // ── Router ──
    function renderCurrentStep() {
        renderStepIndicator();
        switch (currentStep) {
            case 1: renderStep1(); break;
            case 2: renderStep2(); break;
            case 3: renderStep3(); break;
            case 4: renderStep4(); break;
        }
    }

    // ── Public API ──
    function open() {
        const m = modal();
        if (!m) {
            console.error('Submit wizard modal (#submitWizardModal) not found in DOM');
            return;
        }

        // Reset state
        currentStep = 1;
        selectedExpenseIds.clear();
        selectedDestinations.clear();
        results = [];

        m.classList.add('active');
        lockScroll();
        renderCurrentStep();
    }

    function close() {
        const m = modal();
        if (m) {
            m.classList.remove('active');
        }
        unlockScroll();

        // Reset
        currentStep = 1;
        selectedExpenseIds.clear();
        selectedDestinations.clear();
        results = [];
    }

    // ── Escape key ──
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const m = modal();
            if (m && m.classList.contains('active')) {
                // Don't close during processing
                if (currentStep !== 3) {
                    close();
                }
            }
        }
    });

    return { open, close };
})();
