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

        const escaped = xmlString
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Syntax highlight: tags in purple, attributes in cyan, values in green
        const highlighted = escaped
            .replace(/&lt;(\/?[\w.]+)/g, '&lt;<span style="color:#a78bfa;">$1</span>')
            .replace(/&gt;/g, '<span style="color:#a78bfa;">&gt;</span>')
            .replace(/&lt;/g, '<span style="color:#a78bfa;">&lt;</span>')
            .replace(/"([^"]*)"/g, '"<span style="color:#10b981;">$1</span>"')
            .replace(/(\b(?:Yes|No|Import|Data|Vouchers|Payment)\b)/g, '<span style="color:#f59e0b;">$1</span>');

        const overlay = document.createElement('div');
        overlay.id = 'tallyPreviewOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10002;display:flex;flex-direction:column;background:var(--bg-primary,#0a0a0f);';

        overlay.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:1px solid rgba(139,92,246,0.15);background:linear-gradient(135deg,rgba(26,26,46,0.98),rgba(15,15,35,0.98));flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style="color:#a78bfa;font-weight:700;font-size:1rem;">Tally XML Preview</span>
                    <span style="color:#5a6180;font-size:0.8rem;margin-left:8px;">${xmlString.split('<VOUCHER>').length - 1} voucher(s)</span>
                </div>
                <div style="display:flex;gap:10px;align-items:center;">
                    <button id="tallyPreviewCopy" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(139,92,246,0.2);background:rgba(139,92,246,0.08);color:#a78bfa;font-size:0.82rem;font-weight:600;cursor:pointer;">Copy XML</button>
                    <button id="tallyPreviewDownload" style="padding:8px 16px;border-radius:8px;border:none;background:#8b5cf6;color:white;font-size:0.82rem;font-weight:600;cursor:pointer;">Download XML</button>
                    <button id="tallyPreviewClose" style="width:36px;height:36px;border-radius:8px;border:1px solid rgba(139,92,246,0.15);background:transparent;color:#8892b0;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center;">&times;</button>
                </div>
            </div>
            <div style="flex:1;overflow:auto;padding:0;">
                <div style="display:flex;">
                    <div id="tallyPreviewLines" style="padding:16px 12px;text-align:right;color:#3a3f5c;font-size:12px;font-family:'Fira Code',monospace;line-height:1.6;user-select:none;border-right:1px solid rgba(255,255,255,0.04);min-width:45px;flex-shrink:0;"></div>
                    <pre id="tallyPreviewCode" style="flex:1;margin:0;padding:16px 20px;font-family:'Fira Code','Courier New',monospace;font-size:12.5px;line-height:1.6;color:#e0e0ff;overflow-x:auto;white-space:pre;tab-size:2;">${highlighted}</pre>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Line numbers
        const lines = xmlString.split('\n').length;
        const lineNums = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
        document.getElementById('tallyPreviewLines').textContent = lineNums;

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
