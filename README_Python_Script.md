# Python Template Filler Script

This Python script fills your exact "Expenses Report Format.xlsx" template while preserving all formatting, formulas, and styles.

## Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Required files:**
   - Your template: `Expenses Report Format.xlsx`
   - Data in JSON format (see `sample_data.json`)

## Usage

### Basic Usage
```bash
python fill_expenses_template.py \
  --template "Expenses Report Format.xlsx" \
  --input-json "sample_data.json" \
  --out-dir "./filled"
```

### Export from Web App
You can modify the web application to export JSON data that works with this script:

```javascript
// Add this method to your ExpenseTracker class
exportToJSON() {
    const data = {
        EmployeeName: "[Employee Name]",
        ExpensePeriod: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        EmployeeCode: "[Employee Code]",
        FromDate: this.expenses.length > 0 ? this.expenses[0].date : new Date().toISOString().split('T')[0],
        ToDate: this.expenses.length > 0 ? this.expenses[this.expenses.length - 1].date : new Date().toISOString().split('T')[0],
        BusinessPurpose: "[Business Purpose]",
        CashAdvance: 0,
        items: this.expenses.map(expense => ({
            Date: expense.date,
            VendorName_Description: `${expense.vendor} - ${expense.description}`,
            Category: expense.category,
            Cost: expense.amount
        }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}
```

## JSON Format

The script expects this exact JSON structure:

```json
{
  "EmployeeName": "Y Chaithanya Reddy",
  "ExpensePeriod": "Oct 2025",
  "EmployeeCode": "EMP-0234",
  "FromDate": "2025-09-01",
  "ToDate": "2025-09-30",
  "BusinessPurpose": "Client visit - Bangalore",
  "CashAdvance": 5000.00,
  "items": [
    {
      "Date": "2025-09-02",
      "VendorName_Description": "Hotel ABC - accommodation",
      "Category": "Accommodation",
      "Cost": 2400.50
    }
  ]
}
```

## Cell Mappings

The script fills these exact cells:
- **D4:** Employee Name
- **G4:** Expense Period
- **D5:** Employee Code
- **F5:** From Date
- **F6:** To Date
- **E8:** Business Purpose
- **F68:** Cash Advance
- **A14:F66:** Expense items (max 53 items)

## Features

- ✅ Preserves all Excel formatting and styles
- ✅ Keeps formulas intact (F67: SUM, F69: F67-F68)
- ✅ Handles date parsing in multiple formats
- ✅ Validates numeric fields
- ✅ Reports any issues in validation summary
- ✅ Protects against overwriting formulas
- ✅ Generates timestamped output files

## Output

Files are saved as: `Expenses Report Format-filled-YYYYMMDD-HHMMSS.xlsx`

The script provides a detailed validation summary showing:
- Successfully filled fields
- Any parsing errors
- Items ignored due to capacity limits
- Protected cells that couldn't be written