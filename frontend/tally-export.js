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

    // ==================== Preview ====================

    function previewXML(xmlString) {
        const win = window.open('', '_blank');
        if (win) {
            win.document.write('<pre style="font-family:monospace;font-size:13px;padding:20px;background:#1a1a2e;color:#e0e0ff;">' +
                xmlString.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
                '</pre>');
            win.document.title = 'Tally XML Preview';
        }
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
