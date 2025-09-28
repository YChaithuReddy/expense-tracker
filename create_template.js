// Run this in browser console to create template.xlsx
// Make sure you're on the expense tracker page with XLSX library loaded

function createTemplate() {
    const workbook = XLSX.utils.book_new();
    const worksheet = {};

    // Create the exact template structure matching Python script expectations
    // Header section
    worksheet['A1'] = { v: 'EXPENSE REIMBURSEMENT FORM', t: 's' };

    // Row 4: Employee Name and Period
    worksheet['A4'] = { v: 'Employee Name:', t: 's' };
    worksheet['D4'] = { v: '', t: 's' }; // Empty for user to fill
    worksheet['F4'] = { v: 'Expense Period:', t: 's' };
    worksheet['G4'] = { v: '', t: 's' }; // Empty for user to fill

    // Row 5: Employee Code and From Date
    worksheet['A5'] = { v: 'Employee Code:', t: 's' };
    worksheet['D5'] = { v: '', t: 's' }; // Empty for user to fill
    worksheet['E5'] = { v: 'From Date:', t: 's' };
    worksheet['F5'] = { v: '', t: 's' }; // Empty for user to fill

    // Row 6: To Date
    worksheet['E6'] = { v: 'To Date:', t: 's' };
    worksheet['F6'] = { v: '', t: 's' }; // Empty for user to fill

    // Row 8: Business Purpose
    worksheet['A8'] = { v: 'Business Purpose:', t: 's' };
    worksheet['E8'] = { v: '', t: 's' }; // Empty for user to fill

    // Add some spacing
    worksheet['A10'] = { v: '', t: 's' };
    worksheet['A11'] = { v: '', t: 's' };
    worksheet['A12'] = { v: '', t: 's' };

    // Expense table headers - row 13
    worksheet['A13'] = { v: 'Sr.', t: 's' };
    worksheet['B13'] = { v: 'Date', t: 's' };
    worksheet['C13'] = { v: 'Vendor Name/ Description', t: 's' };
    worksheet['D13'] = { v: 'From', t: 's' };
    worksheet['E13'] = { v: 'Category', t: 's' };
    worksheet['F13'] = { v: 'Cost', t: 's' };

    // Empty rows 14-66 for expense items (53 rows)
    for (let row = 14; row <= 66; row++) {
        worksheet[`A${row}`] = { v: '', t: 's' };
        worksheet[`B${row}`] = { v: '', t: 's' };
        worksheet[`C${row}`] = { v: '', t: 's' };
        worksheet[`D${row}`] = { v: '', t: 's' };
        worksheet[`E${row}`] = { v: '', t: 's' };
        worksheet[`F${row}`] = { v: '', t: 's' };
    }

    // Total formulas and cash advance section
    worksheet['E67'] = { v: 'SUBTOTAL', t: 's' };
    worksheet['F67'] = { f: 'SUM(F14:F66)', t: 'n' }; // Formula

    worksheet['E68'] = { v: 'Less: Cash Advance', t: 's' };
    worksheet['F68'] = { v: 0, t: 'n' }; // Default cash advance

    worksheet['E69'] = { v: 'TOTAL REIMBURSEMENT', t: 's' };
    worksheet['F69'] = { f: 'F67-F68', t: 'n' }; // Formula

    // Set the range for the worksheet
    worksheet['!ref'] = 'A1:G69';

    // Set column widths
    worksheet['!cols'] = [
        { width: 6 },   // A - Sr.
        { width: 12 },  // B - Date
        { width: 40 },  // C - Vendor/Description
        { width: 15 },  // D - From
        { width: 15 },  // E - Category
        { width: 12 },  // F - Cost
        { width: 15 }   // G - Period
    ];

    // Add the worksheet to workbook with the expected sheet name
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ExpenseReport');

    // Generate filename
    const fileName = 'template.xlsx';

    // Download the file
    XLSX.writeFile(workbook, fileName);

    console.log('✅ Template created successfully: template.xlsx');
    console.log('This template can be used with the Python script fill_expenses_template.py');
}

// Call the function
createTemplate();