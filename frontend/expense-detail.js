// Expense Detail - Paired Receipt/Data View Modal
const expenseDetail = (() => {
    'use strict';

    let currentExpenseId = null;
    let modal = null;
    let contentEl = null;

    function sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatAmount(amount) {
        const num = parseFloat(amount);
        if (isNaN(num)) return '\u20B90';
        return '\u20B9' + num.toLocaleString('en-IN', {
            minimumFractionDigits: num % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return sanitize(dateStr);
            return date.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return sanitize(dateStr);
        }
    }

    function getModal() {
        if (!modal) {
            modal = document.getElementById('expenseDetailModal');
        }
        return modal;
    }

    function getContent() {
        if (!contentEl) {
            contentEl = document.getElementById('expenseDetailContent');
        }
        return contentEl;
    }

    function buildReceiptSection(expense) {
        const images = expense.images || [];

        if (images.length === 0) {
            return `
                <div class="expense-detail-receipt">
                    <div class="expense-detail-no-receipt">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <p>No receipt attached</p>
                    </div>
                </div>
            `;
        }

        const firstImage = images[0];
        const isPdf = firstImage.isPdf || (firstImage.name && firstImage.name.toLowerCase().endsWith('.pdf'));
        const safeName = sanitize(firstImage.name || 'Receipt');
        const safeId = sanitize(expense.id);

        let mainView = '';
        if (isPdf) {
            mainView = `
                <div class="expense-detail-pdf-preview" data-expense-id="${safeId}" data-image-index="0" onclick="expenseDetail.openImage(this)">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                    </svg>
                    <span class="expense-detail-pdf-name">${safeName}</span>
                    <span class="expense-detail-pdf-hint">Click to view</span>
                </div>
            `;
        } else {
            mainView = `
                <img
                    class="expense-detail-main-image"
                    src="${firstImage.data}"
                    alt="${safeName}"
                    data-expense-id="${safeId}"
                    data-image-index="0"
                    onclick="expenseDetail.openImage(this)"
                    title="Click to view full size"
                />
            `;
        }

        let thumbnails = '';
        if (images.length > 1) {
            const thumbItems = images.map((img, idx) => {
                const tName = sanitize(img.name || 'Receipt');
                const tIsPdf = img.isPdf || (img.name && img.name.toLowerCase().endsWith('.pdf'));
                if (tIsPdf) {
                    return `
                        <div class="expense-detail-thumb expense-detail-thumb-pdf ${idx === 0 ? 'active' : ''}"
                             data-expense-id="${safeId}" data-image-index="${idx}"
                             onclick="expenseDetail.selectThumb(this, ${idx})" title="${tName}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                        </div>
                    `;
                }
                return `
                    <img class="expense-detail-thumb ${idx === 0 ? 'active' : ''}"
                         src="${img.data}" alt="${tName}"
                         data-expense-id="${safeId}" data-image-index="${idx}"
                         onclick="expenseDetail.selectThumb(this, ${idx})" title="${tName}" />
                `;
            }).join('');

            thumbnails = `<div class="expense-detail-thumbs">${thumbItems}</div>`;
        }

        return `
            <div class="expense-detail-receipt">
                <div class="expense-detail-main-preview">${mainView}</div>
                ${thumbnails}
            </div>
        `;
    }

    function buildDataSection(expense) {
        const fields = [];

        if (expense.vendor) {
            const isCompany = typeof isCompanyMode === 'function' && isCompanyMode();
            fields.push({ label: isCompany ? 'Project' : 'Vendor', value: sanitize(expense.vendor) });
        }

        if (expense.date) {
            fields.push({ label: 'Date', value: formatDate(expense.date) });
        }

        if (expense.time) {
            fields.push({ label: 'Time', value: sanitize(expense.time) });
        }

        if (expense.category) {
            fields.push({
                label: 'Category',
                value: `<span class="category-badge">${sanitize(expense.category)}</span>`
            });
        }

        if (expense.description) {
            fields.push({ label: 'Description', value: sanitize(expense.description) });
        }

        if (expense.paymentMode) {
            const modeLabel = expense.paymentMode === 'bank_transfer' ? 'Bank Transfer' : expense.paymentMode === 'upi' ? 'UPI' : 'Cash';
            fields.push({ label: 'Payment Mode', value: `<span class="payment-mode-badge payment-mode-badge--${sanitize(expense.paymentMode)}">${modeLabel}</span>` });
        }

        if (expense.billAttached) {
            const billLabel = expense.billAttached === 'yes' ? 'Yes' : 'No';
            fields.push({ label: 'Bill Attached', value: `<span class="bill-badge bill-badge--${sanitize(expense.billAttached)}">${billLabel}</span>` });
        }

        if (expense.project) {
            fields.push({ label: 'Project', value: sanitize(expense.project) });
        }

        const fieldsHtml = fields.map(f => `
            <div class="expense-detail-field">
                <span class="field-label">${f.label}</span>
                <span class="field-value">${f.value}</span>
            </div>
        `).join('');

        // Advance section
        const tracker = window.expenseTracker;
        const advances = tracker?.advances || [];
        const linkedAdvance = expense.advance_id
            ? advances.find(a => a.id === expense.advance_id)
            : null;

        let advanceHtml = '';
        if (linkedAdvance) {
            const remaining = linkedAdvance.remaining ?? 0;
            const advanceName = sanitize(linkedAdvance.project_name);
            // Build move dropdown with other advances
            const otherAdvances = advances
                .filter(a => a.status === 'active' && a.id !== linkedAdvance.id)
                .map(a => `<option value="${a.id}">${sanitize(a.project_name)} (₹${a.remaining?.toLocaleString('en-IN') || 0} left)</option>`)
                .join('');
            const moveDropdown = otherAdvances
                ? `<select id="moveAdvanceSelect" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#e0e0ff;font-size:0.8rem;flex:1;">
                       <option value="">Move to...</option>
                       ${otherAdvances}
                   </select>
                   <button onclick="expenseDetail.moveToAdvance()" style="padding:6px 12px;border-radius:6px;border:none;background:#8b5cf6;color:white;cursor:pointer;font-size:0.8rem;font-weight:600;">Move</button>`
                : '';

            advanceHtml = `
                <div class="expense-detail-advance" style="margin:12px 0;padding:12px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:10px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                        <span style="color:#a78bfa;font-weight:600;font-size:0.85rem;">Linked to: ${advanceName}</span>
                        <button onclick="expenseDetail.unlinkFromAdvance()" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:transparent;color:#ef4444;cursor:pointer;font-size:0.75rem;">Unlink</button>
                    </div>
                    <div style="color:#8892b0;font-size:0.8rem;margin-bottom:8px;">₹${remaining.toLocaleString('en-IN')} remaining of ₹${(linkedAdvance.amount || 0).toLocaleString('en-IN')}</div>
                    ${moveDropdown ? `<div style="display:flex;gap:8px;align-items:center;">${moveDropdown}</div>` : ''}
                </div>`;
        } else if (advances.filter(a => a.status === 'active').length > 0) {
            const activeAdvances = advances
                .filter(a => a.status === 'active')
                .map(a => `<option value="${a.id}">${sanitize(a.project_name)} (₹${a.remaining?.toLocaleString('en-IN') || 0} left)</option>`)
                .join('');
            advanceHtml = `
                <div class="expense-detail-advance" style="margin:12px 0;padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
                    <div style="color:#8892b0;font-size:0.8rem;margin-bottom:8px;">Not linked to any advance</div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <select id="moveAdvanceSelect" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#e0e0ff;font-size:0.8rem;flex:1;">
                            <option value="">Link to advance...</option>
                            ${activeAdvances}
                        </select>
                        <button onclick="expenseDetail.moveToAdvance()" style="padding:6px 12px;border-radius:6px;border:none;background:#10b981;color:white;cursor:pointer;font-size:0.8rem;font-weight:600;">Link</button>
                    </div>
                </div>`;
        }

        // Status section
        const hasPdf = tracker && tracker.lastGeneratedPdf;
        const pdfStatus = hasPdf
            ? '<div class="status-item status-done">PDF package generated</div>'
            : '<div class="status-item status-pending">Not included in PDF package</div>';

        const safeId = sanitize(expense.id);

        return `
            <div class="expense-detail-data">
                <div class="expense-detail-amount">${formatAmount(expense.amount)}</div>
                <div class="expense-detail-amount-label">Total Amount</div>
                <div class="expense-detail-fields-grid">
                    ${fieldsHtml}
                </div>
                ${advanceHtml}
                <div class="expense-detail-status">
                    <h4>Submission Status</h4>
                    ${pdfStatus}
                </div>
                <div class="expense-detail-actions">
                    <button class="expense-detail-btn expense-detail-btn-edit" onclick="expenseDetail.edit()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
                    </button>
                    <button class="expense-detail-btn expense-detail-btn-delete" onclick="expenseDetail.confirmDelete()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    function render(expense) {
        const content = getContent();
        if (!content) return;

        content.innerHTML = `
            <div class="expense-detail-split">
                ${buildReceiptSection(expense)}
                ${buildDataSection(expense)}
            </div>
        `;
    }

    // --- Public API ---

    function open(expenseId) {
        const tracker = window.expenseTracker;
        if (!tracker || !tracker.expenses) return;

        const expense = tracker.expenses.find(e => e.id === expenseId);
        if (!expense) return;

        currentExpenseId = expenseId;

        const m = getModal();
        if (!m) return;

        render(expense);
        m.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Focus trap: focus the close button
        const closeBtn = m.querySelector('.expense-detail-close');
        if (closeBtn) closeBtn.focus();
    }

    function close() {
        const m = getModal();
        if (!m) return;

        m.classList.remove('active');
        document.body.style.overflow = '';
        currentExpenseId = null;
    }

    function edit() {
        const id = currentExpenseId;
        close();
        if (id && window.expenseTracker) {
            window.expenseTracker.editExpense(id);
        }
    }

    function confirmDelete() {
        if (!currentExpenseId) return;
        const ok = confirm('Are you sure you want to delete this expense?');
        if (!ok) return;
        deleteExpense();
    }

    async function deleteExpense() {
        const id = currentExpenseId;
        close();
        if (id && window.expenseTracker) {
            await window.expenseTracker.deleteExpense(id);
        }
    }

    function openImage(el) {
        if (window.expenseTracker) {
            window.expenseTracker.openImageFromCard(el);
        }
    }

    function selectThumb(thumbEl, index) {
        if (!currentExpenseId) return;
        const tracker = window.expenseTracker;
        if (!tracker) return;

        const expense = tracker.expenses.find(e => e.id === currentExpenseId);
        if (!expense || !expense.images || !expense.images[index]) return;

        const img = expense.images[index];
        const isPdf = img.isPdf || (img.name && img.name.toLowerCase().endsWith('.pdf'));
        const safeName = sanitize(img.name || 'Receipt');
        const safeId = sanitize(expense.id);

        // Update main preview
        const mainPreview = document.querySelector('.expense-detail-main-preview');
        if (!mainPreview) return;

        if (isPdf) {
            mainPreview.innerHTML = `
                <div class="expense-detail-pdf-preview" data-expense-id="${safeId}" data-image-index="${index}" onclick="expenseDetail.openImage(this)">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                    </svg>
                    <span class="expense-detail-pdf-name">${safeName}</span>
                    <span class="expense-detail-pdf-hint">Click to view</span>
                </div>
            `;
        } else {
            mainPreview.innerHTML = `
                <img
                    class="expense-detail-main-image"
                    src="${img.data}"
                    alt="${safeName}"
                    data-expense-id="${safeId}"
                    data-image-index="${index}"
                    onclick="expenseDetail.openImage(this)"
                    title="Click to view full size"
                />
            `;
        }

        // Update active thumbnail
        const thumbs = document.querySelectorAll('.expense-detail-thumb');
        thumbs.forEach(t => t.classList.remove('active'));
        thumbEl.classList.add('active');
    }

    // Keyboard handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const m = getModal();
            if (m && m.classList.contains('active')) {
                close();
            }
        }
    });

    // Backdrop click handler
    document.addEventListener('click', (e) => {
        const m = getModal();
        if (m && m.classList.contains('active') && e.target === m) {
            close();
        }
    });

    async function unlinkFromAdvance() {
        if (!currentExpenseId) return;
        try {
            await api.unlinkExpenseFromAdvance(currentExpenseId);
            // Update local data and re-render
            const tracker = window.expenseTracker;
            if (tracker) {
                const expense = tracker.expenses.find(e => e.id === currentExpenseId);
                if (expense) expense.advance_id = null;
                await tracker.loadAdvances();
                render(expense);
                tracker.showNotification('Expense unlinked from advance');
            }
        } catch (error) {
            window.expenseTracker?.showNotification('Failed to unlink: ' + error.message);
        }
    }

    async function moveToAdvance() {
        const select = document.getElementById('moveAdvanceSelect');
        if (!select || !select.value || !currentExpenseId) return;

        const newAdvanceId = select.value;
        const tracker = window.expenseTracker;

        // Validate advance still exists before calling API
        const targetAdvance = tracker?.advances?.find(a => a.id === newAdvanceId && a.status === 'active');
        if (!targetAdvance) {
            tracker?.showNotification('Selected advance no longer exists. Please refresh.');
            return;
        }

        try {
            await api.moveExpenseToAdvance(currentExpenseId, newAdvanceId);
            // Update local data and re-render only after API success
            if (tracker) {
                const expense = tracker.expenses.find(e => e.id === currentExpenseId);
                if (expense) expense.advance_id = newAdvanceId;
                await tracker.loadAdvances();
                render(expense);
                tracker.showNotification(`Expense moved to ${targetAdvance.project_name}`);
            }
        } catch (error) {
            window.expenseTracker?.showNotification('Failed to move: ' + error.message);
        }
    }

    return {
        open,
        close,
        edit,
        confirmDelete,
        openImage,
        selectThumb,
        unlinkFromAdvance,
        moveToAdvance
    };
})();
