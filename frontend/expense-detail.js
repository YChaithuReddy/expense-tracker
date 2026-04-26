// Expense Detail — two-column editable modal (redesigned to match the new spec).
// Public API kept stable so script.js / inline onclicks keep working:
//   open, close, edit, confirmDelete, openImage, selectThumb, unlinkFromAdvance, moveToAdvance
// Plus new actions used by the rebuilt UI: save, cancel, prevImage, nextImage, zoomIn, zoomOut, download.

const expenseDetail = (() => {
    'use strict';

    const CATEGORIES = ['Transportation', 'Accommodation', 'Meals', 'Fuel', 'Bill Payments', 'Food', 'Miscellaneous'];

    let currentExpenseId = null;
    let originalSnapshot = null;          // snapshot for cancel/diff
    let workingCopy = null;               // mutable copy bound to inputs
    let currentImageIndex = 0;
    let zoomLevel = 1;
    let stylesInjected = false;

    function sanitize(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function attr(str) {
        return String(str == null ? '' : str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatAmount(amount) {
        const num = parseFloat(amount);
        if (isNaN(num)) return '₹0';
        return '₹' + num.toLocaleString('en-IN', {
            minimumFractionDigits: num % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        });
    }

    function toIsoDate(dateStr) {
        if (!dateStr) return '';
        // Already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            return d.toISOString().slice(0, 10);
        } catch { return ''; }
    }

    function injectStyles() {
        if (stylesInjected) return;
        stylesInjected = true;
        const style = document.createElement('style');
        style.id = 'expense-detail-v2-styles';
        style.textContent = `
            .expense-detail-overlay { padding: 0 !important; }
            .expense-detail-overlay.active .expense-detail-panel {
                width: min(1280px, 96vw);
                max-height: 92vh;
                display: flex; flex-direction: column;
                border-radius: 18px;
                background: #ffffff;
                overflow: hidden;
            }
            .expense-detail-header {
                padding: 18px 24px;
                background: #ffffff;
                border-bottom: 1px solid #eef2f7;
            }
            .expense-detail-header-title {
                font-size: 1.02rem; font-weight: 700; color: #111827; letter-spacing: -0.01em;
                display: flex; align-items: center; gap: 10px;
            }
            .expense-detail-header-title::before {
                content: ''; width: 32px; height: 32px; border-radius: 8px;
                background: linear-gradient(135deg, #ede9fe, #e0e7ff);
                background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%237c3aed' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z'/><polyline points='14 2 14 8 20 8'/></svg>");
                background-repeat: no-repeat; background-position: center;
            }
            .expense-detail-close {
                width: 34px; height: 34px; border-radius: 10px;
                border: 1px solid #e5e7eb; background: #f9fafb; color: #475569;
                font-size: 1.2rem; line-height: 1; cursor: pointer;
                transition: background 0.15s, color 0.15s, border-color 0.15s;
            }
            .expense-detail-close:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }
            .expense-detail-content { flex: 1; min-height: 0; overflow-y: auto; padding: 0; }

            /* Two-column body */
            .exp-det2 {
                display: grid;
                grid-template-columns: minmax(0, 380px) minmax(0, 1fr);
                gap: 0;
                min-height: 100%;
            }
            .exp-det2__left {
                padding: 22px 24px;
                background: #fafbfc;
                border-right: 1px solid #eef2f7;
                display: flex; flex-direction: column; gap: 14px;
            }
            .exp-det2__right {
                padding: 22px 28px 26px;
                display: flex; flex-direction: column; gap: 14px;
            }

            /* Bill preview card */
            .exp-det2__bill-card {
                border: 1px solid #e5e7eb;
                border-radius: 14px;
                background: #ffffff;
                overflow: hidden;
                display: flex; flex-direction: column;
            }
            .exp-det2__bill-head {
                display: flex; align-items: center; justify-content: space-between;
                padding: 12px 14px; border-bottom: 1px solid #eef2f7;
            }
            .exp-det2__bill-title { font-size: 0.85rem; font-weight: 600; color: #475569; }
            .exp-det2__bill-actions { display: flex; gap: 6px; }
            .exp-det2__icon-btn {
                width: 32px; height: 32px; border-radius: 8px;
                border: 1px solid #e5e7eb; background: #f9fafb; color: #475569;
                display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
                transition: background 0.15s, border-color 0.15s, color 0.15s;
            }
            .exp-det2__icon-btn:hover { background: #ffffff; border-color: #cbd5e1; color: #0369a1; }
            .exp-det2__icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .exp-det2__bill-body {
                padding: 16px;
                display: flex; align-items: center; justify-content: center;
                background: #ffffff;
                min-height: 220px; max-height: 480px; overflow: auto;
            }
            .exp-det2__bill-img { max-width: 100%; max-height: 440px; border-radius: 8px; transition: transform 0.2s ease; }
            .exp-det2__bill-empty { color: #94a3b8; text-align: center; font-size: 0.85rem; padding: 30px 12px; }
            .exp-det2__bill-empty svg { display: block; margin: 0 auto 10px; color: #cbd5e1; }
            .exp-det2__bill-nav {
                display: flex; align-items: center; justify-content: center; gap: 14px;
                padding: 10px 14px; border-top: 1px solid #eef2f7; background: #fafbfc;
                font-size: 0.78rem; color: #475569;
            }

            /* Right column header (amount) */
            .exp-det2__amount-block { padding-bottom: 4px; }
            .exp-det2__amount {
                font-size: 1.85rem; font-weight: 700; color: #111827; letter-spacing: -0.02em; line-height: 1.1;
            }
            .exp-det2__amount-label {
                margin-top: 4px; font-size: 0.7rem; font-weight: 600; color: #6b7280;
                letter-spacing: 0.08em; text-transform: uppercase;
            }

            /* Editable info rows */
            .exp-det2__rows { display: flex; flex-direction: column; gap: 8px; }
            .exp-det2__row {
                display: grid;
                grid-template-columns: 24px 1fr auto;
                align-items: center;
                gap: 12px;
                padding: 10px 14px;
                background: #f8fafc;
                border: 1px solid #eef2f7;
                border-radius: 12px;
                transition: border-color 0.15s, background 0.15s;
            }
            .exp-det2__row:focus-within { border-color: #93c5fd; background: #ffffff; }
            .exp-det2__row svg { color: #64748b; }
            .exp-det2__row label {
                font-size: 0.85rem; color: #475569; font-weight: 500;
            }
            .exp-det2__row input[type="text"],
            .exp-det2__row input[type="date"],
            .exp-det2__row input[type="time"],
            .exp-det2__row select {
                justify-self: end;
                text-align: right;
                background: transparent;
                border: none;
                outline: none;
                font: inherit;
                font-weight: 600;
                color: #111827;
                font-size: 0.9rem;
                padding: 4px 6px;
                border-radius: 6px;
                max-width: 60%;
            }
            .exp-det2__row input[type="text"] { min-width: 180px; }
            .exp-det2__row input:hover,
            .exp-det2__row select:hover { background: #ffffff; box-shadow: inset 0 0 0 1px #e5e7eb; }
            .exp-det2__row input:focus,
            .exp-det2__row select:focus { background: #ffffff; box-shadow: inset 0 0 0 2px #3b82f6; }
            .exp-det2__row select { appearance: none; -webkit-appearance: none; padding-right: 22px; cursor: pointer; }
            .exp-det2__row select option { color: #111827; }

            .exp-det2__chip-cat {
                background: #ede9fe; color: #6d28d9; border-radius: 8px;
                padding: 4px 10px; font-size: 0.78rem; font-weight: 600;
            }
            .exp-det2__chip-pay {
                background: #d1fae5; color: #065f46; border-radius: 6px;
                padding: 3px 9px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em;
            }
            .exp-det2__chip-bill-yes {
                background: #d1fae5; color: #065f46; border-radius: 6px;
                padding: 3px 9px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em;
            }
            .exp-det2__chip-bill-no {
                background: #fee2e2; color: #991b1b; border-radius: 6px;
                padding: 3px 9px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em;
            }

            /* Advance link section */
            .exp-det2__advance-card {
                margin-top: 6px; padding: 14px 16px;
                border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;
            }
            .exp-det2__advance-head {
                display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
            }
            .exp-det2__advance-title {
                font-size: 0.88rem; color: #111827; font-weight: 600;
            }
            .exp-det2__advance-title small { color: #6b7280; font-weight: 400; margin-left: 4px; }
            .exp-det2__advance-info {
                width: 22px; height: 22px; border-radius: 50%;
                background: #f1f5f9; color: #475569;
                display: inline-flex; align-items: center; justify-content: center;
                font-size: 0.7rem; font-weight: 700;
            }
            .exp-det2__advance-row {
                display: flex; gap: 8px; align-items: center;
            }
            .exp-det2__advance-row select {
                flex: 1; padding: 9px 12px; border-radius: 10px;
                border: 1px solid #e5e7eb; background: #ffffff; color: #111827;
                font-size: 0.85rem;
            }
            .exp-det2__advance-link {
                padding: 9px 18px; border-radius: 10px; border: none;
                background: #059669; color: #ffffff; font-size: 0.85rem; font-weight: 600;
                cursor: pointer; transition: background 0.15s, transform 0.1s;
            }
            .exp-det2__advance-link:hover { background: #047857; }
            .exp-det2__advance-link:active { transform: scale(0.98); }
            .exp-det2__advance-linked {
                background: #f5f3ff; border-color: #ddd6fe;
            }

            /* Sticky footer */
            .exp-det2__footer {
                position: sticky; bottom: 0;
                padding: 14px 24px;
                background: #ffffff;
                border-top: 1px solid #eef2f7;
                display: flex; align-items: center; justify-content: space-between;
                gap: 12px;
            }
            .exp-det2__btn {
                padding: 10px 18px; border-radius: 10px; cursor: pointer;
                font-size: 0.88rem; font-weight: 600;
                border: 1px solid transparent;
                transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
                display: inline-flex; align-items: center; gap: 8px;
            }
            .exp-det2__btn:active { transform: scale(0.98); }
            .exp-det2__btn-delete {
                background: #ffffff; border-color: #fecaca; color: #dc2626;
            }
            .exp-det2__btn-delete:hover { background: #fef2f2; }
            .exp-det2__btn-cancel {
                background: #ffffff; border-color: #e5e7eb; color: #475569;
            }
            .exp-det2__btn-cancel:hover { background: #f9fafb; border-color: #cbd5e1; }
            .exp-det2__btn-save {
                background: #059669; color: #ffffff;
            }
            .exp-det2__btn-save:hover { background: #047857; }
            .exp-det2__btn-save:disabled { background: #9ca3af; cursor: not-allowed; }
            .exp-det2__footer-right { display: flex; gap: 10px; }

            @media (max-width: 900px) {
                .expense-detail-overlay.active .expense-detail-panel {
                    width: 100vw; max-height: 100vh; max-height: 100dvh;
                    border-radius: 0;
                }
                .exp-det2 { grid-template-columns: 1fr; }
                .exp-det2__left { border-right: none; border-bottom: 1px solid #eef2f7; }
                .exp-det2__right { padding: 18px 18px 22px; }
                .exp-det2__bill-body { max-height: 320px; }
                .exp-det2__row { grid-template-columns: 22px 1fr auto; padding: 9px 12px; }
                .exp-det2__row input[type="text"] { min-width: 0; max-width: 60%; }
                .exp-det2__amount { font-size: 1.5rem; }
            }
        `;
        document.head.appendChild(style);
    }

    function getModal() { return document.getElementById('expenseDetailModal'); }
    function getContent() { return document.getElementById('expenseDetailContent'); }

    function buildBillCard(expense) {
        const images = expense.images || [];
        const total = images.length;
        const idx = Math.min(currentImageIndex, Math.max(0, total - 1));

        let body;
        if (total === 0) {
            body = `
                <div class="exp-det2__bill-empty">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    No receipt attached
                </div>`;
        } else {
            const img = images[idx];
            const isPdf = img.isPdf || (img.name && String(img.name).toLowerCase().endsWith('.pdf'));
            if (isPdf) {
                body = `
                    <div onclick="expenseDetail.openImage(this)" data-expense-id="${attr(expense.id)}" data-image-index="${idx}" style="cursor:pointer;text-align:center;color:#475569;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <div style="margin-top:10px;font-size:0.85rem;font-weight:600;">${sanitize(img.name || 'PDF receipt')}</div>
                        <div style="margin-top:4px;font-size:0.75rem;color:#94a3b8;">Click to open</div>
                    </div>`;
            } else {
                body = `<img class="exp-det2__bill-img" id="exp-det2-bill-img" src="${attr(img.data)}" alt="${attr(img.name || 'Bill')}" onclick="expenseDetail.openImage(this)" data-expense-id="${attr(expense.id)}" data-image-index="${idx}" style="transform: scale(${zoomLevel});" />`;
            }
        }

        const nav = total > 1
            ? `<div class="exp-det2__bill-nav">
                    <button class="exp-det2__icon-btn" onclick="expenseDetail.prevImage()" aria-label="Previous bill" ${idx === 0 ? 'disabled' : ''}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <span><strong>${idx + 1}</strong> / ${total}</span>
                    <button class="exp-det2__icon-btn" onclick="expenseDetail.nextImage()" aria-label="Next bill" ${idx >= total - 1 ? 'disabled' : ''}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
               </div>`
            : '';

        const downloadDisabled = total === 0 ? 'disabled' : '';
        return `
            <div class="exp-det2__bill-card">
                <div class="exp-det2__bill-head">
                    <div class="exp-det2__bill-title">Bill Preview</div>
                    <div class="exp-det2__bill-actions">
                        <button class="exp-det2__icon-btn" onclick="expenseDetail.zoomOut()" aria-label="Zoom out" ${total === 0 ? 'disabled' : ''}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                        </button>
                        <button class="exp-det2__icon-btn" onclick="expenseDetail.zoomIn()" aria-label="Zoom in" ${total === 0 ? 'disabled' : ''}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                        </button>
                        <button class="exp-det2__icon-btn" onclick="expenseDetail.download()" aria-label="Download bill" ${downloadDisabled}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                    </div>
                </div>
                <div class="exp-det2__bill-body">${body}</div>
                ${nav}
            </div>`;
    }

    function buildRow(icon, labelText, fieldHtml) {
        return `<div class="exp-det2__row">${icon}<label>${labelText}</label>${fieldHtml}</div>`;
    }

    function iconSvg(d, viewBox) {
        return `<svg width="18" height="18" viewBox="${viewBox || '0 0 24 24'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    }

    function buildAdvanceCard() {
        const tracker = window.expenseTracker;
        const advances = (tracker && tracker.advances) || [];
        const linked = workingCopy.advance_id
            ? advances.find(a => String(a.id) === String(workingCopy.advance_id))
            : null;

        const activeOptions = advances
            .filter(a => a.status === 'active' && (!linked || String(a.id) !== String(linked.id)))
            .map(a => `<option value="${attr(a.id)}">${sanitize(a.project_name)} (₹${(a.remaining ?? 0).toLocaleString('en-IN')} left)</option>`)
            .join('');

        if (linked) {
            return `
                <div class="exp-det2__advance-card exp-det2__advance-linked">
                    <div class="exp-det2__advance-head">
                        <div class="exp-det2__advance-title">Linked to <strong>${sanitize(linked.project_name)}</strong> <small>· ₹${(linked.remaining ?? 0).toLocaleString('en-IN')} left of ₹${(linked.amount ?? 0).toLocaleString('en-IN')}</small></div>
                        <button class="exp-det2__btn exp-det2__btn-cancel" style="padding:6px 12px;font-size:0.78rem;" onclick="expenseDetail.unlinkFromAdvance()">Unlink</button>
                    </div>
                    ${activeOptions ? `
                        <div class="exp-det2__advance-row">
                            <select id="moveAdvanceSelect"><option value="">Move to another advance…</option>${activeOptions}</select>
                            <button class="exp-det2__advance-link" onclick="expenseDetail.moveToAdvance()">Move</button>
                        </div>` : ''}
                </div>`;
        }

        if (activeOptions) {
            return `
                <div class="exp-det2__advance-card">
                    <div class="exp-det2__advance-head">
                        <div class="exp-det2__advance-title">Link to Advance <small>(Optional)</small></div>
                        <span class="exp-det2__advance-info" title="Linking deducts this expense from the advance.">i</span>
                    </div>
                    <div class="exp-det2__advance-row">
                        <select id="moveAdvanceSelect"><option value="">Link to advance…</option>${activeOptions}</select>
                        <button class="exp-det2__advance-link" onclick="expenseDetail.moveToAdvance()">Link</button>
                    </div>
                </div>`;
        }

        return '';
    }

    function buildEditableData(expense) {
        const isCompany = typeof isCompanyMode === 'function' && isCompanyMode();
        const projectLabel = isCompany ? 'Project' : 'Vendor';
        const cat = expense.category || '';
        const knownCat = CATEGORIES.includes(cat);
        const catOptions = CATEGORIES.map(c => `<option value="${attr(c)}" ${c === cat ? 'selected' : ''}>${sanitize(c)}</option>`).join('') +
            (!knownCat && cat ? `<option value="${attr(cat)}" selected>${sanitize(cat)}</option>` : '');

        const pm = expense.paymentMode || 'cash';
        const ba = expense.billAttached || 'yes';

        const projectIcon = iconSvg('<circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0113 0"/>');
        const dateIcon = iconSvg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>');
        const timeIcon = iconSvg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>');
        const catIcon = iconSvg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>');
        const descIcon = iconSvg('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="14" y2="18"/>');
        const payIcon = iconSvg('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/>');
        const billIcon = iconSvg('<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>');

        const rows = [
            buildRow(projectIcon, projectLabel, `<input type="text" id="edInputVendor" value="${attr(expense.vendor)}" placeholder="Project name" />`),
            buildRow(dateIcon,    'Date',         `<input type="date" id="edInputDate" value="${attr(toIsoDate(expense.date))}" />`),
            buildRow(timeIcon,    'Time',         `<input type="time" id="edInputTime" value="${attr(expense.time || '')}" />`),
            buildRow(catIcon,     'Category',     `<select id="edInputCategory">${catOptions}</select>`),
            buildRow(descIcon,    'Description',  `<input type="text" id="edInputDescription" value="${attr(expense.description)}" placeholder="Add description" />`),
            buildRow(payIcon,     'Payment Mode', `<select id="edInputPaymentMode">
                <option value="cash"          ${pm === 'cash' ? 'selected' : ''}>Cash</option>
                <option value="upi"           ${pm === 'upi' ? 'selected' : ''}>UPI</option>
                <option value="bank_transfer" ${pm === 'bank_transfer' ? 'selected' : ''}>Bank Transfer</option>
            </select>`),
            buildRow(billIcon,    'Bill Attached', `<select id="edInputBillAttached">
                <option value="yes" ${ba === 'yes' ? 'selected' : ''}>Yes</option>
                <option value="no"  ${ba === 'no'  ? 'selected' : ''}>No</option>
            </select>`),
        ].join('');

        return `
            <div class="exp-det2__amount-block">
                <div class="exp-det2__amount" id="edAmountDisplay">${formatAmount(expense.amount)}</div>
                <div class="exp-det2__amount-label">Total Amount</div>
            </div>
            <div class="exp-det2__rows">${rows}</div>
            ${buildAdvanceCard()}`;
    }

    function buildFooter() {
        return `
            <div class="exp-det2__footer">
                <button class="exp-det2__btn exp-det2__btn-delete" onclick="expenseDetail.confirmDelete()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    Delete Expense
                </button>
                <div class="exp-det2__footer-right">
                    <button class="exp-det2__btn exp-det2__btn-cancel" onclick="expenseDetail.cancel()">Cancel</button>
                    <button class="exp-det2__btn exp-det2__btn-save" id="edSaveBtn" onclick="expenseDetail.save()">Save Changes</button>
                </div>
            </div>`;
    }

    function render(expense) {
        const content = getContent();
        if (!content) return;
        content.innerHTML = `
            <div class="exp-det2">
                <div class="exp-det2__left">${buildBillCard(expense)}</div>
                <div class="exp-det2__right">
                    ${buildEditableData(expense)}
                </div>
            </div>
            ${buildFooter()}`;
        bindInputs();
    }

    function bindInputs() {
        const map = {
            edInputVendor: 'vendor',
            edInputDate: 'date',
            edInputTime: 'time',
            edInputCategory: 'category',
            edInputDescription: 'description',
            edInputPaymentMode: 'paymentMode',
            edInputBillAttached: 'billAttached',
        };
        Object.entries(map).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => { workingCopy[key] = el.value; });
            el.addEventListener('change', () => { workingCopy[key] = el.value; });
        });
    }

    // --- Public API ---

    function open(expenseId) {
        const tracker = window.expenseTracker;
        if (!tracker || !tracker.expenses) return;
        const expense = tracker.expenses.find(e => String(e.id) === String(expenseId));
        if (!expense) return;

        injectStyles();

        currentExpenseId = expenseId;
        currentImageIndex = 0;
        zoomLevel = 1;
        // Snapshot is for cancel comparisons; working copy is what edits flow into.
        originalSnapshot = JSON.parse(JSON.stringify(expense));
        workingCopy = JSON.parse(JSON.stringify(expense));

        const m = getModal();
        if (!m) return;
        render(expense);
        m.classList.add('active');
        document.body.style.overflow = 'hidden';

        const closeBtn = m.querySelector('.expense-detail-close');
        if (closeBtn) closeBtn.focus();
    }

    function close() {
        const m = getModal();
        if (!m) return;
        m.classList.remove('active');
        document.body.style.overflow = '';
        currentExpenseId = null;
        originalSnapshot = null;
        workingCopy = null;
        currentImageIndex = 0;
        zoomLevel = 1;
    }

    function cancel() { close(); }

    function isDirty() {
        if (!originalSnapshot || !workingCopy) return false;
        const fields = ['vendor', 'date', 'time', 'category', 'description', 'paymentMode', 'billAttached'];
        return fields.some(f => (originalSnapshot[f] || '') !== (workingCopy[f] || ''));
    }

    async function save() {
        if (!workingCopy) return;
        const tracker = window.expenseTracker;
        if (!tracker) return;

        if (!isDirty()) { close(); return; }

        const btn = document.getElementById('edSaveBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

        try {
            // Pass through tracker.updateExpense which also reloads + re-renders the list.
            await tracker.updateExpense({
                id: workingCopy.id,
                date: workingCopy.date,
                time: workingCopy.time,
                category: workingCopy.category,
                amount: workingCopy.amount,
                vendor: workingCopy.vendor,
                description: workingCopy.description,
                paymentMode: workingCopy.paymentMode,
                billAttached: workingCopy.billAttached,
                images: originalSnapshot.images || []
            });
            close();
        } catch (err) {
            console.error('Save failed', err);
            tracker.showNotification?.('Failed to save: ' + (err.message || err));
            if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
        }
    }

    function edit() {
        // Legacy entry point — the modal is now editable in place, so just keep it open.
        // If anything still calls this expecting to jump to the form, fall back to that path.
        const id = currentExpenseId;
        if (id && window.expenseTracker && typeof window.expenseTracker.editExpense === 'function') {
            close();
            window.expenseTracker.editExpense(id);
        }
    }

    function confirmDelete() {
        if (!currentExpenseId) return;
        const ok = confirm('Are you sure you want to delete this expense?');
        if (!ok) return;
        const id = currentExpenseId;
        close();
        if (window.expenseTracker) {
            window.expenseTracker.deleteExpense(id);
        }
    }

    function openImage(el) {
        if (window.expenseTracker) window.expenseTracker.openImageFromCard(el);
    }

    function selectThumb(thumbEl, index) {
        currentImageIndex = index;
        const tracker = window.expenseTracker;
        if (!tracker) return;
        const expense = tracker.expenses.find(e => String(e.id) === String(currentExpenseId));
        if (!expense) return;
        const left = document.querySelector('.exp-det2__left');
        if (left) left.innerHTML = buildBillCard(expense);
    }

    function prevImage() {
        if (currentImageIndex > 0) {
            currentImageIndex -= 1;
            zoomLevel = 1;
            const expense = window.expenseTracker?.expenses.find(e => String(e.id) === String(currentExpenseId));
            if (expense) {
                const left = document.querySelector('.exp-det2__left');
                if (left) left.innerHTML = buildBillCard(expense);
            }
        }
    }

    function nextImage() {
        const expense = window.expenseTracker?.expenses.find(e => String(e.id) === String(currentExpenseId));
        if (!expense) return;
        const total = (expense.images || []).length;
        if (currentImageIndex < total - 1) {
            currentImageIndex += 1;
            zoomLevel = 1;
            const left = document.querySelector('.exp-det2__left');
            if (left) left.innerHTML = buildBillCard(expense);
        }
    }

    function zoomIn() {
        zoomLevel = Math.min(2.5, zoomLevel + 0.25);
        applyZoom();
    }

    function zoomOut() {
        zoomLevel = Math.max(1, zoomLevel - 0.25);
        applyZoom();
    }

    function applyZoom() {
        const img = document.getElementById('exp-det2-bill-img');
        if (img) img.style.transform = `scale(${zoomLevel})`;
    }

    function download() {
        const expense = window.expenseTracker?.expenses.find(e => String(e.id) === String(currentExpenseId));
        if (!expense) return;
        const img = (expense.images || [])[currentImageIndex];
        if (!img || !img.data) return;
        const a = document.createElement('a');
        a.href = img.data;
        a.download = img.name || `bill-${currentImageIndex + 1}.jpg`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async function unlinkFromAdvance() {
        if (!currentExpenseId) return;
        try {
            await api.unlinkExpenseFromAdvance(currentExpenseId);
            const tracker = window.expenseTracker;
            if (tracker) {
                const expense = tracker.expenses.find(e => String(e.id) === String(currentExpenseId));
                if (expense) {
                    expense.advance_id = null;
                    workingCopy.advance_id = null;
                    originalSnapshot.advance_id = null;
                }
                await tracker.loadAdvances();
                if (expense) render(expense);
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
        const targetAdvance = tracker?.advances?.find(a => String(a.id) === String(newAdvanceId) && a.status === 'active');
        if (!targetAdvance) {
            tracker?.showNotification('Selected advance no longer exists. Please refresh.');
            return;
        }
        try {
            await api.moveExpenseToAdvance(currentExpenseId, newAdvanceId);
            if (tracker) {
                const expense = tracker.expenses.find(e => String(e.id) === String(currentExpenseId));
                if (expense) {
                    expense.advance_id = newAdvanceId;
                    workingCopy.advance_id = newAdvanceId;
                    originalSnapshot.advance_id = newAdvanceId;
                }
                await tracker.loadAdvances();
                if (expense) render(expense);
                tracker.showNotification(`Expense linked to ${targetAdvance.project_name}`);
            }
        } catch (error) {
            window.expenseTracker?.showNotification('Failed to move: ' + error.message);
        }
    }

    // Keyboard handlers — close on Escape; arrow keys navigate bills.
    document.addEventListener('keydown', (e) => {
        const m = getModal();
        if (!m || !m.classList.contains('active')) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') prevImage();
        else if (e.key === 'ArrowRight') nextImage();
    });

    // Backdrop click closes the modal (the overlay element, not its panel).
    document.addEventListener('click', (e) => {
        const m = getModal();
        if (m && m.classList.contains('active') && e.target === m) close();
    });

    return {
        open,
        close,
        cancel,
        save,
        edit,
        confirmDelete,
        openImage,
        selectThumb,
        prevImage,
        nextImage,
        zoomIn,
        zoomOut,
        download,
        unlinkFromAdvance,
        moveToAdvance,
    };
})();
