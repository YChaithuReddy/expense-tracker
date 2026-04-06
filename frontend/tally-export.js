/**
 * Tally XML Export Module
 * Generates Tally-compatible XML vouchers from approved expenses
 * Pure XML generation — no UI logic
 */
const tallyExport = (() => {
    'use strict';

    const DEFAULT_COMPANY = 'FluxGen Technologies Pvt Ltd';
    const DEFAULT_PAYMENT_LEDGER = 'Cash';
    const VOUCHER_TYPE = 'Payment';

    // ==================== XML Helpers ====================

    function xmlEscape(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function formatTallyDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}${m}${day}`;
    }

    function resolveLedger(category, subcategory, mappings) {
        if (!mappings || !category) return 'Miscellaneous Expenses';
        // Try subcategory-specific first
        if (subcategory) {
            const subKey = `${category}:${subcategory}`;
            if (mappings[subKey]) return mappings[subKey];
        }
        // Fall back to category
        if (mappings[category]) return mappings[category];
        return 'Miscellaneous Expenses';
    }

    // ==================== Single Voucher XML ====================

    function generateVoucherXML(voucher, expenses, ledgerMappings) {
        const date = formatTallyDate(voucher.accountant_action_at || voucher.submitted_at || new Date().toISOString());
        const voucherNum = xmlEscape(voucher.voucher_number || '');
        const employeeName = xmlEscape(voucher.submitter?.name || 'Employee');
        const purpose = xmlEscape(voucher.purpose || 'Expense Reimbursement');
        const narration = `${voucherNum} | ${employeeName} | ${purpose}`;

        // Group expenses by their Tally ledger
        const ledgerTotals = {};
        for (const exp of (expenses || [])) {
            const cat = exp.category || 'Miscellaneous';
            // Extract subcategory if category has format "Main > Sub"
            let mainCat = cat, subCat = null;
            if (cat.includes('>')) {
                const parts = cat.split('>').map(s => s.trim());
                mainCat = parts[0];
                subCat = parts[1];
            }
            const ledger = resolveLedger(mainCat, subCat, ledgerMappings);
            ledgerTotals[ledger] = (ledgerTotals[ledger] || 0) + (parseFloat(exp.amount) || 0);
        }

        const totalAmount = Object.values(ledgerTotals).reduce((s, a) => s + a, 0);

        // Build debit entries (expenses — negative in Tally)
        let ledgerEntries = '';
        for (const [ledger, amount] of Object.entries(ledgerTotals)) {
            ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${xmlEscape(ledger)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
        }

        // Credit entry (payment source — positive in Tally)
        const paymentLedger = localStorage.getItem('tallyPaymentLedger') || DEFAULT_PAYMENT_LEDGER;
        ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${xmlEscape(paymentLedger)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${totalAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;

        return `
        <VOUCHER>
            <DATE>${date}</DATE>
            <NARRATION>${narration}</NARRATION>
            <VOUCHERTYPENAME>${VOUCHER_TYPE}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${voucherNum}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${employeeName}</PARTYLEDGERNAME>
            <EFFECTIVEDATE>${date}</EFFECTIVEDATE>
            <ISCANCELLED>No</ISCANCELLED>
            <ISOPTIONAL>No</ISOPTIONAL>${ledgerEntries}
        </VOUCHER>`;
    }

    // ==================== Batch Export ====================

    function generateBatchXML(vouchersWithExpenses, ledgerMappings, companyName) {
        const company = xmlEscape(companyName || localStorage.getItem('tallyCompanyName') || DEFAULT_COMPANY);

        let vouchersXML = '';
        for (const { voucher, expenses } of vouchersWithExpenses) {
            vouchersXML += generateVoucherXML(voucher, expenses, ledgerMappings);
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Import</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>Vouchers</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
            </STATICVARIABLES>
        </DESC>
        <DATA>
            <TALLYMESSAGE>${vouchersXML}
            </TALLYMESSAGE>
        </DATA>
    </BODY>
</ENVELOPE>`;
    }

    // ==================== Download ====================

    function downloadXML(xmlString, filename) {
        if (!filename) {
            const today = new Date().toISOString().split('T')[0];
            filename = `Tally_Export_${today}.xml`;
        }

        const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==================== Preview (Inline Modal) ====================

    function previewXML(xmlString) {
        // Remove existing preview if open
        const existing = document.getElementById('tallyPreviewOverlay');
        if (existing) existing.remove();

        // Simple, safe syntax highlighting using DOM text manipulation
        function highlightXML(xml) {
            // First escape everything
            let h = xml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            // Highlight tags: <TAGNAME> and </TAGNAME>
            h = h.replace(/&lt;(\/?)([\w.]+)/g, '<span class="xml-bracket">&lt;$1</span><span class="xml-tag">$2</span>');
            h = h.replace(/&gt;/g, '<span class="xml-bracket">&gt;</span>');
            // Highlight attribute values "..."
            h = h.replace(/&quot;([^&]*)&quot;/g, '<span class="xml-attr">"$1"</span>');
            h = h.replace(/"([^"<>]*)"/g, '<span class="xml-attr">"$1"</span>');
            // Highlight numbers (standalone)
            h = h.replace(/>(-?\d+\.?\d*)</g, '><span class="xml-num">$1</span><');
            return h;
        }

        const highlighted = highlightXML(xmlString);

        const overlay = document.createElement('div');
        overlay.id = 'tallyPreviewOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10002;display:flex;flex-direction:column;background:#f9fafb;';

        const voucherCount = (xmlString.match(/<VOUCHER>/g) || []).length;

        overlay.innerHTML = `
            <style>
                .xml-bracket { color: #64748b; }
                .xml-tag { color: #7c3aed; font-weight: 500; }
                .xml-attr { color: #059669; }
                .xml-num { color: #d97706; }
                .tally-preview-header { display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:1px solid #e2e8f0;background:#ffffff;flex-shrink:0; }
                .tally-preview-body { flex:1;overflow:auto;background:#f8fafc; }
                .tally-preview-code { margin:0;padding:20px 24px;font-family:'Fira Code','Courier New',monospace;font-size:13px;line-height:1.7;color:#334155;white-space:pre;tab-size:2;counter-reset:line; }
                .tally-preview-code .line { display:block; }
                .tally-preview-code .line::before { counter-increment:line;content:counter(line);display:inline-block;width:35px;margin-right:16px;text-align:right;color:#94a3b8;font-size:11px;user-select:none; }
                .tally-preview-btn { padding:8px 16px;border-radius:8px;font-size:0.82rem;font-weight:600;cursor:pointer;transition:all 0.2s; }
                .tally-preview-btn:hover { opacity:0.85; }
            </style>
            <div class="tally-preview-header">
                <div style="display:flex;align-items:center;gap:10px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style="color:#0f172a;font-weight:700;font-size:1.05rem;">Tally XML Preview</span>
                    <span style="background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;">${voucherCount} voucher${voucherCount !== 1 ? 's' : ''}</span>
                </div>
                <div style="display:flex;gap:10px;align-items:center;">
                    <button id="tallyPreviewCopy" class="tally-preview-btn" style="border:1px solid #e2e8f0;background:#ffffff;color:#374151;">Copy XML</button>
                    <button id="tallyPreviewDownload" class="tally-preview-btn" style="border:none;background:#111827;color:white;">Download XML</button>
                    <button id="tallyPreviewClose" style="width:36px;height:36px;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;color:#64748b;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center;">&times;</button>
                </div>
            </div>
            <div class="tally-preview-body">
                <pre class="tally-preview-code">${xmlString.split('\n').map(line => {
                    let h = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    h = h.replace(/&lt;(\/?)([\w.]+)/g, '<span class="xml-bracket">&lt;$1</span><span class="xml-tag">$2</span>');
                    h = h.replace(/&gt;/g, '<span class="xml-bracket">&gt;</span>');
                    h = h.replace(/"([^"]*)"/g, '<span class="xml-attr">"$1"</span>');
                    return '<span class="line">' + h + '</span>';
                }).join('')}</pre>
            </div>
        `;

        document.body.appendChild(overlay);

        // Events
        document.getElementById('tallyPreviewClose').onclick = () => overlay.remove();
        document.getElementById('tallyPreviewCopy').onclick = () => {
            navigator.clipboard.writeText(xmlString).then(() => {
                const btn = document.getElementById('tallyPreviewCopy');
                btn.textContent = 'Copied!';
                btn.style.color = '#10b981';
                setTimeout(() => { btn.textContent = 'Copy XML'; btn.style.color = '#a78bfa'; }, 2000);
            });
        };
        document.getElementById('tallyPreviewDownload').onclick = () => downloadXML(xmlString);

        // Escape to close
        const escHandler = (e) => {
            if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
        };
        document.addEventListener('keydown', escHandler);
    }

    return {
        generateVoucherXML,
        generateBatchXML,
        downloadXML,
        previewXML,
        resolveLedger,
        formatTallyDate,
        xmlEscape
    };
})();

window.tallyExport = tallyExport;
