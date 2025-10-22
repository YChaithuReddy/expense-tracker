@echo off
echo ========================================
echo   EXPENSE TRACKER - TEMPLATE FILLER
echo ========================================
echo.
echo This will fill your exact Excel template with web app data
echo.
echo REQUIREMENTS:
echo 1. Your Excel template file (e.g., "Expenses Report Format.xlsx")
echo 2. JSON data file from web app (exported using "Export for Template")
echo 3. Python with required packages installed
echo.
echo ========================================
echo   SETUP (First time only):
echo ========================================
echo pip install openpyxl python-dateutil
echo.
echo ========================================
echo   USAGE:
echo ========================================
echo python fill_expenses_template.py --template "your_template.xlsx" --input-json "expense_data_2025-09-28.json"
echo.
echo Example:
echo python fill_expenses_template.py --template "Expenses Report Format.xlsx" --input-json "expense_data_2025-09-28.json"
echo.
echo ========================================
echo   WORKFLOW:
echo ========================================
echo 1. Add expenses in web app
echo 2. Click "Export for Template" button
echo 3. Download your template to this folder
echo 4. Run the command above
echo 5. Get perfectly filled template!
echo.
pause