# Report Generator Skill

## Purpose
Generate professional reimbursement reports in Excel and PDF formats with charts, formulas, and company branding.

## When to Activate
- User says: "generate report", "export", "reimbursement", "Excel", "PDF"
- Needs: "monthly report", "expense summary", "send to manager"

## What This Skill Does

Creates professional reports with:
- Company branding/header
- Employee details
- Expense breakdown by category
- Excel formulas (totals, subtotals, averages)
- Charts (pie, bar)
- GST summary
- Receipt attachments

## Excel Report Template

```javascript
async function generateExcelReport(expenses, metadata) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Expense Report');

    // Header
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'EXPENSE REIMBURSEMENT REPORT';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF2563EB' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F9FF' }
    };

    // Employee Info
    sheet.getCell('A3').value = 'Employee Name:';
    sheet.getCell('B3').value = metadata.employeeName;
    sheet.getCell('A4').value = 'Period:';
    sheet.getCell('B4').value = `${metadata.fromDate} to ${metadata.toDate}`;

    // Column Headers
    const headers = ['Date', 'Category', 'Description', 'Vendor', 'Amount (₹)', 'GST (₹)', 'Receipt'];
    const headerRow = sheet.getRow(6);
    headerRow.values = headers;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }
    };

    // Data Rows
    expenses.forEach((exp, i) => {
        const row = sheet.getRow(7 + i);
        row.values = [
            exp.date,
            exp.category,
            exp.description,
            exp.vendor || '-',
            exp.amount,
            exp.gst || 0,
            exp.receiptUrl ? 'Yes' : 'No'
        ];
    });

    // Total Row
    const totalRow = 7 + expenses.length + 1;
    sheet.getCell(`D${totalRow}`).value = 'TOTAL:';
    sheet.getCell(`D${totalRow}`).font = { bold: true };
    sheet.getCell(`E${totalRow}`).value = { formula: `SUM(E7:E${7 + expenses.length - 1})` };
    sheet.getCell(`E${totalRow}`).font = { bold: true, color: { argb: 'FF2563EB' } };

    // Format currency columns
    sheet.getColumn(5).numFmt = '₹#,##0.00';
    sheet.getColumn(6).numFmt = '₹#,##0.00';

    // Auto-width columns
    sheet.columns.forEach(column => column.width = 15);

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Expense_Report_${Date.now()}.xlsx`;
    a.click();
}
```

## PDF Report with jsPDF

```javascript
async function generatePDFReport(expenses, metadata) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235);
    doc.text('EXPENSE REIMBURSEMENT REPORT', 105, 20, { align: 'center' });

    // Employee Info
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Employee: ${metadata.employeeName}`, 20, 35);
    doc.text(`Period: ${metadata.fromDate} to ${metadata.toDate}`, 20, 42);

    // Table
    const tableData = expenses.map(exp => [
        exp.date,
        exp.category,
        exp.description,
        `₹${exp.amount.toFixed(2)}`
    ]);

    doc.autoTable({
        head: [['Date', 'Category', 'Description', 'Amount']],
        body: tableData,
        startY: 50,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] }
    });

    // Total
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL: ₹${total.toFixed(2)}`, 20, finalY);

    // Download
    doc.save(`Expense_Report_${Date.now()}.pdf`);
}
```

## Usage

```javascript
// Generate Excel Report
document.getElementById('exportExcel').addEventListener('click', async () => {
    const metadata = {
        employeeName: 'John Doe',
        fromDate: '2025-10-01',
        toDate: '2025-10-31'
    };

    await generateExcelReport(expenses, metadata);
});

// Generate PDF Report
document.getElementById('exportPDF').addEventListener('click', async () => {
    const metadata = {
        employeeName: 'John Doe',
        fromDate: '2025-10-01',
        toDate: '2025-10-31'
    };

    await generatePDFReport(expenses, metadata);
});
```

## Report Features

- Professional formatting
- Company branding
- Category breakdown
- Monthly/yearly summaries
- GST calculations
- Charts and graphs
- Multi-format (Excel, PDF, CSV)
- Email-ready
