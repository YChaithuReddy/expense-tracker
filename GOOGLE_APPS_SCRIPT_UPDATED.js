/**
 * Google Apps Script for Expense Tracker Auto-Copy Template
 *
 * This script handles:
 * 1. Creating a new copy of the master template for each user
 * 2. Sharing the copy with the user's email
 * 3. Accepting data exports from the frontend (via GET with ?data= parameter)
 * 4. Maintaining a permanent Project_Expenses_Log tab
 * 5. Creating per-project tabs with running subtotals
 * 6. Updating employee information on the sheet
 * 7. Exporting sheet as PDF
 * 8. Resetting sheet from master template
 *
 * Deploy this as a Web App with "Execute as: Me" and "Access: Anyone"
 *
 * FRONTEND CALLS THIS VIA GET:
 *   fetch(`${APPS_SCRIPT_URL}?data=${encodeURIComponent(JSON.stringify(data))}`, { method: 'GET', redirect: 'follow' })
 */

var MASTER_TEMPLATE_ID = '1dcq8HKP1j4NocCMgAY9YSXlwCrzHwIiRCd0t4mun25E';
var TAB_NAME = 'ExpenseReport';
var LOG_TAB_NAME = 'Project_Expenses_Log';

// ============================================================================
// ROUTING: doGet and doPost
// ============================================================================

/**
 * HTTP GET handler - the frontend sends data as a URL parameter
 * URL format: ?data={"action":"exportExpenses","sheetId":"...","expenses":[...]}
 *
 * CRITICAL ARCHITECTURE NOTE:
 * For 'exportExpenses', we call addToLogSheet and addToProjectSheets SEPARATELY
 * from the router level — NOT from inside exportExpensesToSheet. This avoids
 * an Apps Script V8 runtime issue where parameters passed to nested functions
 * become undefined inside the GET handler context.
 */
function doGet(e) {
  try {
    // If no data parameter, return status message
    if (!e || !e.parameter || !e.parameter.data) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Expense Tracker Google Apps Script is running',
        info: 'Send data as ?data={JSON} parameter',
        version: '2.0',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.parameter.data);
    var action = data.action;

    Logger.log('doGet action: ' + action);
    Logger.log('doGet data keys: ' + Object.keys(data).join(', '));

    switch (action) {
      case 'createSheet':
        return createSheetForUser(data);

      case 'exportExpenses':
        // Main export to ExpenseReport tab only
        return exportExpensesToSheet(data);

      // These are called as SEPARATE GET requests from the frontend
      // to avoid V8 scope issues with function chaining in doGet
      case 'addToLogSheet':
        addToLogSheet(data);
        return createResponse(true, 'Log sheet updated');

      case 'addToProjectSheets':
        addToProjectSheets(data);
        return createResponse(true, 'By Project tab updated');

      case 'addToIndividualProjectTabs':
        addToIndividualProjectTabs(data);
        return createResponse(true, 'Individual project tabs updated');

      case 'verifySheet':
        return verifySheetAccess(data);

      case 'exportPdf':
        return exportSheetAsPdf(data);

      case 'resetSheet':
        return resetSheetFromMaster(data);

      case 'updateEmployeeInfo':
        return updateEmployeeInformation(data);

      default:
        return createResponse(false, 'Unknown action: ' + action);
    }
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'no stack'));
    return createResponse(false, 'Server error: ' + error.toString());
  }
}

/**
 * HTTP POST handler - called by backend or direct POST requests
 *
 * Same routing logic as doGet. For 'exportExpenses', log and project sheet
 * functions are called at the router level to avoid scope issues.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;

    Logger.log('doPost action: ' + action);

    switch (action) {
      case 'createSheet':
        return createSheetForUser(data);

      case 'exportExpenses':
        return exportExpensesToSheet(data);

      case 'addToLogSheet':
        addToLogSheet(data);
        return createResponse(true, 'Log sheet updated');

      case 'addToProjectSheets':
        addToProjectSheets(data);
        return createResponse(true, 'By Project tab updated');

      case 'addToIndividualProjectTabs':
        addToIndividualProjectTabs(data);
        return createResponse(true, 'Individual project tabs updated');

      case 'verifySheet':
        return verifySheetAccess(data);

      case 'exportPdf':
        return exportSheetAsPdf(data);

      case 'resetSheet':
        return resetSheetFromMaster(data);

      case 'updateEmployeeInfo':
        return updateEmployeeInformation(data);

      default:
        return createResponse(false, 'Unknown action: ' + action);
    }
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return createResponse(false, 'Server error: ' + error.toString());
  }
}

// ============================================================================
// EXISTING FUNCTIONS (unchanged)
// ============================================================================

/**
 * Create a new sheet for a user by copying the master template
 */
function createSheetForUser(data) {
  try {
    const { userId, userEmail, userName } = data;

    if (!userEmail || !userName) {
      return createResponse(false, 'Missing required fields: userEmail, userName');
    }

    Logger.log('Creating sheet for user: ' + userName + ' (' + userEmail + ')');

    // Copy the master template
    const masterFile = DriveApp.getFileById(MASTER_TEMPLATE_ID);
    const newSheetName = userName + ' - Expense Report';
    const copiedFile = masterFile.makeCopy(newSheetName);
    const newSheetId = copiedFile.getId();

    Logger.log('Sheet copied successfully: ' + newSheetId);

    // Share the new sheet with the user
    copiedFile.addEditor(userEmail);
    copiedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);

    Logger.log('Sheet shared with: ' + userEmail);

    return createResponse(true, 'Sheet created successfully', {
      sheetId: newSheetId,
      sheetUrl: 'https://docs.google.com/spreadsheets/d/' + newSheetId,
      sheetName: newSheetName
    });
  } catch (error) {
    Logger.log('Error creating sheet: ' + error.toString());
    return createResponse(false, 'Failed to create sheet: ' + error.toString());
  }
}

/**
 * Export expenses to an existing sheet
 * Data section is dynamic - always starts at row 14
 * Summary section (17 rows) always follows data immediately
 */
function exportExpensesToSheet(data) {
  try {
    const { sheetId, expenses } = data;

    if (!sheetId || !expenses || !Array.isArray(expenses)) {
      return createResponse(false, 'Missing required fields: sheetId, expenses');
    }

    Logger.log('Exporting ' + expenses.length + ' expenses to sheet: ' + sheetId);

    // Open the spreadsheet
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(TAB_NAME);

    if (!sheet) {
      return createResponse(false, 'Tab "' + TAB_NAME + '" not found in sheet');
    }

    // Constants
    const DATA_START_ROW = 14; // Data always starts at row 14
    const SUMMARY_ROW_COUNT = 17; // Summary section is always 17 rows (A67:F83 in master)

    // Find next empty row in data section (starting from row 14)
    const lastRow = sheet.getLastRow();
    let nextRow = DATA_START_ROW;

    // Check existing data to find first empty row
    if (lastRow >= DATA_START_ROW) {
      const dataRange = sheet.getRange(DATA_START_ROW, 2, lastRow - DATA_START_ROW + 1, 1);
      const values = dataRange.getValues();

      for (let i = 0; i < values.length; i++) {
        if (!values[i][0] || values[i][0] === '') {
          nextRow = DATA_START_ROW + i;
          break;
        } else if (i === values.length - 1) {
          // All rows have data, start after the last row
          nextRow = lastRow + 1;
        }
      }
    }

    Logger.log('Starting export at row: ' + nextRow);

    // Prepare data arrays for batch update.
    //
    // Fluxgen Expense Reimbursement Form layout (row 13 headers):
    //   A  SL NO
    //   B  DATE
    //   C+D (merged)  VENDOR NAME
    //   E  Mode of Expense
    //   F  From Location
    //   G  To Location
    //   H  Kilo Mtr
    //   I  Bills        (Yes/No from billAttached)
    //   J  CATEGORY
    //   K  COST
    const serialNumbers = [];
    const dates = [];
    const vendors = [];
    const modes = [];
    const fromLocs = [];
    const toLocs = [];
    const kms = [];
    const bills = [];
    const categories = [];
    const costs = [];

    expenses.forEach((expense, index) => {
      // Column A: SL NO (1, 2, 3, ...)
      serialNumbers.push([nextRow + index - 13]);

      // Column B: DATE (format: dd-MMM-yyyy)
      const date = new Date(expense.date);
      const formattedDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
      dates.push([formattedDate]);

      // Columns C+D (merged): VENDOR NAME
      vendors.push([expense.vendor || 'Unknown Vendor']);

      // Columns E/F/G/H: travel fields (empty for non-travel expenses).
      modes.push([expense.modeOfExpense || '']);
      fromLocs.push([expense.fromLocation || '']);
      toLocs.push([expense.toLocation || '']);
      const kmVal = parseFloat(expense.kilometers);
      kms.push([isNaN(kmVal) || kmVal === 0 ? '' : kmVal]);

      // Column I: Bills (Yes/No) — billAttached arrives already normalised
      // to 'Yes'/'No' by the frontend, but handle raw truthy/falsy too.
      const billRaw = expense.billAttached;
      let billCell = '';
      if (billRaw === 'Yes' || billRaw === 'yes' || billRaw === true) billCell = 'Yes';
      else if (billRaw === 'No' || billRaw === 'no' || billRaw === false) billCell = 'No';
      else if (billRaw) billCell = String(billRaw);
      bills.push([billCell]);

      // Column J: CATEGORY
      categories.push([expense.category || 'Miscellaneous']);

      // Column K: COST
      costs.push([parseFloat(expense.amount) || 0]);
    });

    // Batch update all columns
    const numExpenses = expenses.length;

    // Template row A14:K14 — new layout is 11 columns (A–K) with vendor merged
    // across C+D (still counts as 2 cells for width purposes).
    const templateRange = sheet.getRange('A14:K14');
    const templateBackgrounds = templateRange.getBackgrounds();
    const templateFontColors = templateRange.getFontColors();
    const templateFontFamilies = templateRange.getFontFamilies();
    const templateFontSizes = templateRange.getFontSizes();
    const templateFontWeights = templateRange.getFontWeights();
    const templateHorizontalAlignments = templateRange.getHorizontalAlignments();
    const templateVerticalAlignments = templateRange.getVerticalAlignments();
    const templateNumberFormats = templateRange.getNumberFormats();

    // Apply formatting to all data rows being inserted (A–K = 11 cols).
    for (let i = 0; i < numExpenses; i++) {
      const targetRow = sheet.getRange(nextRow + i, 1, 1, 11);
      targetRow.setBackgrounds(templateBackgrounds);
      targetRow.setFontColors(templateFontColors);
      targetRow.setFontFamilies(templateFontFamilies);
      targetRow.setFontSizes(templateFontSizes);
      targetRow.setFontWeights(templateFontWeights);
      targetRow.setHorizontalAlignments(templateHorizontalAlignments);
      targetRow.setVerticalAlignments(templateVerticalAlignments);
      targetRow.setNumberFormats(templateNumberFormats);

      // Apply borders to data row
      targetRow.setBorder(true, true, true, true, true, true);
    }

    // Set data values — columns per layout above.
    sheet.getRange(nextRow, 1,  numExpenses, 1).setValues(serialNumbers);  // A  SL NO
    sheet.getRange(nextRow, 2,  numExpenses, 1).setValues(dates);          // B  DATE
    sheet.getRange(nextRow, 3,  numExpenses, 1).setValues(vendors);        // C  VENDOR (merged with D)
    sheet.getRange(nextRow, 5,  numExpenses, 1).setValues(modes);          // E  Mode of Expense
    sheet.getRange(nextRow, 6,  numExpenses, 1).setValues(fromLocs);       // F  From Location
    sheet.getRange(nextRow, 7,  numExpenses, 1).setValues(toLocs);         // G  To Location
    sheet.getRange(nextRow, 8,  numExpenses, 1).setValues(kms);            // H  Kilo Mtr
    sheet.getRange(nextRow, 9,  numExpenses, 1).setValues(bills);          // I  Bills
    sheet.getRange(nextRow, 10, numExpenses, 1).setValues(categories);     // J  CATEGORY
    sheet.getRange(nextRow, 11, numExpenses, 1).setValues(costs);          // K  COST

    // Merge vendor cells (columns C and D) for each row
    for (let i = 0; i < numExpenses; i++) {
      const vendorRange = sheet.getRange(nextRow + i, 3, 1, 2);
      vendorRange.merge();
    }

    // Calculate where data now ends
    const dataEndRow = nextRow + numExpenses - 1;
    const summaryStartRow = dataEndRow + 1;

    Logger.log('Data ends at row ' + dataEndRow + ', moving summary to row ' + summaryStartRow);

    // Now position the summary section immediately after data
    // Open master template to copy summary section
    const masterSpreadsheet = SpreadsheetApp.openById(MASTER_TEMPLATE_ID);
    const masterSheet = masterSpreadsheet.getSheetByName(TAB_NAME);

    if (masterSheet) {
      // Clear any existing summary section first (might be at old position)
      // Find and clear everything from dataEndRow + 1 onwards
      const currentLastRow = sheet.getLastRow();
      if (currentLastRow > dataEndRow) {
        // Clear all 11 cols (A–K) so leftover data from a previous export
        // doesn't bleed into where the summary is about to land.
        const clearRange = sheet.getRange(dataEndRow + 1, 1, currentLastRow - dataEndRow, 11);
        clearRange.clear();
      }

      // Get the summary section from master (rows 67-83 = 17 rows, A–K = 11 cols)
      const masterSummaryRange = masterSheet.getRange('A67:K83');

      // Get all properties from master summary section
      const summaryValues = masterSummaryRange.getValues();
      const summaryFormulas = masterSummaryRange.getFormulas();
      const summaryBackgrounds = masterSummaryRange.getBackgrounds();
      const summaryFontColors = masterSummaryRange.getFontColors();
      const summaryFontFamilies = masterSummaryRange.getFontFamilies();
      const summaryFontSizes = masterSummaryRange.getFontSizes();
      const summaryFontWeights = masterSummaryRange.getFontWeights();
      const summaryHorizontalAlignments = masterSummaryRange.getHorizontalAlignments();
      const summaryVerticalAlignments = masterSummaryRange.getVerticalAlignments();
      const summaryNumberFormats = masterSummaryRange.getNumberFormats();

      // Get target range in user sheet (11 cols A–K)
      const userSummaryRange = sheet.getRange(summaryStartRow, 1, SUMMARY_ROW_COUNT, 11);

      // Apply formulas/values (formulas take priority)
      for (let i = 0; i < summaryFormulas.length; i++) {
        for (let j = 0; j < summaryFormulas[i].length; j++) {
          if (summaryFormulas[i][j]) {
            // Has formula - update row references for SUBTOTAL
            let formula = summaryFormulas[i][j];

            // Update SUBTOTAL formula to reference actual data range (14 to dataEndRow).
            // Cost column moved from F to K in the new 11-col layout; keep the old
            // F→F replacement for backwards compat with any stale masters.
            if (formula.includes('=SUM(K14:K66)')) {
              formula = '=SUM(K14:K' + dataEndRow + ')';
            } else if (formula.includes('=SUM(F14:F66)')) {
              formula = '=SUM(F14:F' + dataEndRow + ')';
            }

            userSummaryRange.getCell(i + 1, j + 1).setFormula(formula);
          } else if (summaryValues[i][j]) {
            // No formula, just value
            userSummaryRange.getCell(i + 1, j + 1).setValue(summaryValues[i][j]);
          }
        }
      }

      // Apply all formatting (NO BORDERS - summary should be border-free)
      userSummaryRange.setBackgrounds(summaryBackgrounds);
      userSummaryRange.setFontColors(summaryFontColors);
      userSummaryRange.setFontFamilies(summaryFontFamilies);
      userSummaryRange.setFontSizes(summaryFontSizes);
      userSummaryRange.setFontWeights(summaryFontWeights);
      userSummaryRange.setHorizontalAlignments(summaryHorizontalAlignments);
      userSummaryRange.setVerticalAlignments(summaryVerticalAlignments);
      userSummaryRange.setNumberFormats(summaryNumberFormats);

      // Copy merged cells from master
      const masterMergedRanges = masterSummaryRange.getMergedRanges();
      for (let i = 0; i < masterMergedRanges.length; i++) {
        const mergedRange = masterMergedRanges[i];
        const rowOffset = mergedRange.getRow() - 67; // Offset from row 67 in master
        const numRows = mergedRange.getNumRows();
        const numCols = mergedRange.getNumColumns();
        const col = mergedRange.getColumn();

        // Apply same merge pattern in user sheet at new position
        const userMergeRange = sheet.getRange(summaryStartRow + rowOffset, col, numRows, numCols);
        userMergeRange.merge();
      }

      Logger.log('Summary section copied successfully to row ' + summaryStartRow + ' (no borders applied)');
    }

    Logger.log('Export completed successfully');

    return createResponse(true, 'Successfully exported ' + numExpenses + ' expenses', {
      exportedCount: numExpenses,
      startRow: nextRow,
      endRow: dataEndRow,
      summaryStartRow: summaryStartRow
    });
  } catch (error) {
    Logger.log('Error exporting expenses: ' + error.toString());
    return createResponse(false, 'Failed to export: ' + error.toString());
  }
}

/**
 * Verify that a sheet exists and is accessible
 */
function verifySheetAccess(data) {
  try {
    const { sheetId } = data;

    if (!sheetId) {
      return createResponse(false, 'Missing required field: sheetId');
    }

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(TAB_NAME);

    if (!sheet) {
      return createResponse(false, 'Tab "' + TAB_NAME + '" not found');
    }

    return createResponse(true, 'Sheet is accessible', {
      sheetName: spreadsheet.getName(),
      tabName: sheet.getName()
    });
  } catch (error) {
    Logger.log('Error verifying sheet: ' + error.toString());
    return createResponse(false, 'Failed to verify sheet: ' + error.toString());
  }
}

/**
 * Reset user's sheet by copying from master template
 * Clears all data and restores original structure:
 * - Data section (rows 14-66) with borders
 * - Summary section (rows 67-83) without borders
 *
 * NOTE: This does NOT clear the Project_Expenses_Log tab or any
 * project-specific tabs (e.g., "Ace", "Biocon"). Those are permanent
 * and must be manually deleted if needed.
 */
function resetSheetFromMaster(data) {
  try {
    const { sheetId } = data;

    if (!sheetId) {
      return createResponse(false, 'Missing required field: sheetId');
    }

    Logger.log('Resetting sheet from master template: ' + sheetId);

    // Open the user's spreadsheet
    const userSpreadsheet = SpreadsheetApp.openById(sheetId);
    const userSheet = userSpreadsheet.getSheetByName(TAB_NAME);

    if (!userSheet) {
      return createResponse(false, 'Tab "' + TAB_NAME + '" not found in user sheet');
    }

    // Open the master template
    const masterSpreadsheet = SpreadsheetApp.openById(MASTER_TEMPLATE_ID);
    const masterSheet = masterSpreadsheet.getSheetByName(TAB_NAME);

    if (!masterSheet) {
      return createResponse(false, 'Tab "' + TAB_NAME + '" not found in master template');
    }

    Logger.log('Clearing all data and restoring master template formatting...');

    // Step 1: Clear everything from row 14 onwards
    const lastRow = userSheet.getLastRow();
    if (lastRow >= 14) {
      const clearRange = userSheet.getRange('A14:F' + lastRow);
      clearRange.clear();
    }

    // Step 2: Restore DATA section formatting from master (A14:F66) with borders
    Logger.log('Restoring data section (rows 14-66) with borders...');

    const masterDataRange = masterSheet.getRange('A14:F66');
    const masterBackgrounds = masterDataRange.getBackgrounds();
    const masterFontColors = masterDataRange.getFontColors();
    const masterFontFamilies = masterDataRange.getFontFamilies();
    const masterFontSizes = masterDataRange.getFontSizes();
    const masterFontWeights = masterDataRange.getFontWeights();
    const masterHorizontalAlignments = masterDataRange.getHorizontalAlignments();
    const masterVerticalAlignments = masterDataRange.getVerticalAlignments();
    const masterNumberFormats = masterDataRange.getNumberFormats();

    // Apply all formatting to user sheet data section (rows 14-66)
    const userDataRange = userSheet.getRange('A14:F66');
    userDataRange.setBackgrounds(masterBackgrounds);
    userDataRange.setFontColors(masterFontColors);
    userDataRange.setFontFamilies(masterFontFamilies);
    userDataRange.setFontSizes(masterFontSizes);
    userDataRange.setFontWeights(masterFontWeights);
    userDataRange.setHorizontalAlignments(masterHorizontalAlignments);
    userDataRange.setVerticalAlignments(masterVerticalAlignments);
    userDataRange.setNumberFormats(masterNumberFormats);

    // Apply borders to data section ONLY
    userDataRange.setBorder(true, true, true, true, true, true);

    // Merge vendor cells (C14:D66) to match template
    for (let row = 14; row <= 66; row++) {
      const vendorCellRange = userSheet.getRange(row, 3, 1, 2);
      vendorCellRange.merge();
    }

    // Step 3: Restore SUMMARY section from master (A67:F83) WITHOUT borders
    Logger.log('Restoring summary section (rows 67-83) without borders...');

    const masterSummaryRange = masterSheet.getRange('A67:F83');

    // Get all properties from master summary section
    const summaryValues = masterSummaryRange.getValues();
    const summaryFormulas = masterSummaryRange.getFormulas();
    const summaryBackgrounds = masterSummaryRange.getBackgrounds();
    const summaryFontColors = masterSummaryRange.getFontColors();
    const summaryFontFamilies = masterSummaryRange.getFontFamilies();
    const summaryFontSizes = masterSummaryRange.getFontSizes();
    const summaryFontWeights = masterSummaryRange.getFontWeights();
    const summaryHorizontalAlignments = masterSummaryRange.getHorizontalAlignments();
    const summaryVerticalAlignments = masterSummaryRange.getVerticalAlignments();
    const summaryNumberFormats = masterSummaryRange.getNumberFormats();

    // Get target range in user sheet (rows 67-83)
    const userSummaryRange = userSheet.getRange('A67:F83');

    // Apply formulas and values
    for (let i = 0; i < summaryFormulas.length; i++) {
      for (let j = 0; j < summaryFormulas[i].length; j++) {
        if (summaryFormulas[i][j]) {
          // Has formula - copy it as is (will be updated during export)
          userSummaryRange.getCell(i + 1, j + 1).setFormula(summaryFormulas[i][j]);
        } else if (summaryValues[i][j]) {
          // No formula, just value
          userSummaryRange.getCell(i + 1, j + 1).setValue(summaryValues[i][j]);
        }
      }
    }

    // Apply all formatting to summary section (NO BORDERS)
    userSummaryRange.setBackgrounds(summaryBackgrounds);
    userSummaryRange.setFontColors(summaryFontColors);
    userSummaryRange.setFontFamilies(summaryFontFamilies);
    userSummaryRange.setFontSizes(summaryFontSizes);
    userSummaryRange.setFontWeights(summaryFontWeights);
    userSummaryRange.setHorizontalAlignments(summaryHorizontalAlignments);
    userSummaryRange.setVerticalAlignments(summaryVerticalAlignments);
    userSummaryRange.setNumberFormats(summaryNumberFormats);

    // Copy merged cells from master summary section
    const masterMergedRanges = masterSummaryRange.getMergedRanges();
    for (let i = 0; i < masterMergedRanges.length; i++) {
      const mergedRange = masterMergedRanges[i];
      const rowOffset = mergedRange.getRow() - 67; // Offset from row 67
      const numRows = mergedRange.getNumRows();
      const numCols = mergedRange.getNumColumns();
      const col = mergedRange.getColumn();

      // Apply same merge pattern in user sheet
      const userMergeRange = userSheet.getRange(67 + rowOffset, col, numRows, numCols);
      userMergeRange.merge();
    }

    // DO NOT apply borders to summary section - leave it border-free

    Logger.log('Sheet reset completed:');
    Logger.log('- Data section (rows 14-66): Formatted with borders');
    Logger.log('- Summary section (rows 67-83): Formatted without borders');
    Logger.log('- Project_Expenses_Log and project tabs: NOT cleared (permanent)');

    return createResponse(true, 'Sheet reset successfully - all data cleared, template restored', {
      sheetId: sheetId,
      sheetName: userSpreadsheet.getName()
    });

  } catch (error) {
    Logger.log('Error resetting sheet: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return createResponse(false, 'Failed to reset sheet: ' + error.toString());
  }
}

/**
 * Export sheet as PDF and return as base64
 */
function exportSheetAsPdf(data) {
  try {
    const { sheetId } = data;

    if (!sheetId) {
      return createResponse(false, 'Missing required field: sheetId');
    }

    Logger.log('Exporting sheet as PDF: ' + sheetId);

    // Open the spreadsheet
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(TAB_NAME);

    if (!sheet) {
      return createResponse(false, 'Tab "' + TAB_NAME + '" not found');
    }

    // Create PDF blob from sheet
    const url = 'https://docs.google.com/spreadsheets/d/' + sheetId + '/export?';
    const params = {
      format: 'pdf',
      size: 'A4',                // Paper size
      portrait: true,            // Orientation
      fitw: true,                // Fit to page width
      fith: true,                // Fit to page height - FIT IN SINGLE PAGE
      scale: 4,                  // Scale down content (1=normal, 2=50%, 3=33%, 4=25%)
      sheetnames: false,         // Don't show sheet names
      printtitle: false,         // Don't show title
      pagenumbers: false,        // Don't show page numbers
      gridlines: false,          // Don't show gridlines
      fzr: false,                // Don't repeat frozen rows
      horizontal_alignment: 'CENTER',  // Center the content horizontally
      vertical_alignment: 'TOP',       // Align to top vertically
      gid: sheet.getSheetId()    // Specific sheet/tab ID
    };

    // Build URL with parameters
    const queryString = Object.keys(params).map(function(key) {
      return key + '=' + params[key];
    }).join('&');

    const pdfUrl = url + queryString;

    // Fetch PDF using UrlFetchApp
    const token = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(pdfUrl, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });

    // Get PDF blob
    const pdfBlob = response.getBlob();

    // Convert to base64
    const base64Pdf = Utilities.base64Encode(pdfBlob.getBytes());

    Logger.log('PDF export completed successfully, size: ' + pdfBlob.getBytes().length + ' bytes');

    return createResponse(true, 'PDF exported successfully', {
      pdfBase64: base64Pdf,
      fileName: spreadsheet.getName() + '.pdf',
      size: pdfBlob.getBytes().length
    });

  } catch (error) {
    Logger.log('Error exporting PDF: ' + error.toString());
    return createResponse(false, 'Failed to export PDF: ' + error.toString());
  }
}

/**
 * Create a standardized JSON response
 */
function createResponse(success, message, data) {
  var response = {
    status: success ? 'success' : 'error',
    message: message
  };

  if (data) {
    response.data = data;
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// NEW FUNCTIONS
// ============================================================================

/**
 * Update employee information on the ExpenseReport tab
 * Updates:
 *   D4  = Employee Name
 *   D5  = Employee Code
 *   F5  = From Date
 *   F6  = To Date
 *   D9  = Business Purpose
 */
function updateEmployeeInformation(data) {
  try {
    var sheetId = data.sheetId;
    var employeeName = data.employeeName || '';
    var employeeCode = data.employeeCode || '';
    var fromDate = data.fromDate || '';
    var toDate = data.toDate || '';
    var businessPurpose = data.businessPurpose || '';

    if (!sheetId) {
      return createResponse(false, 'Missing required field: sheetId');
    }

    Logger.log('Updating employee information for sheet: ' + sheetId);

    var spreadsheet = SpreadsheetApp.openById(String(sheetId));
    var sheet = spreadsheet.getSheetByName(TAB_NAME);

    if (!sheet) {
      return createResponse(false, 'Tab "' + TAB_NAME + '" not found in sheet');
    }

    // Update cells
    if (employeeName) {
      sheet.getRange('D4').setValue(employeeName);
      Logger.log('Set D4 (Employee Name): ' + employeeName);
    }
    if (employeeCode) {
      sheet.getRange('D5').setValue(employeeCode);
      Logger.log('Set D5 (Employee Code): ' + employeeCode);
    }
    if (fromDate) {
      sheet.getRange('F5').setValue(fromDate);
      Logger.log('Set F5 (From Date): ' + fromDate);
    }
    if (toDate) {
      sheet.getRange('F6').setValue(toDate);
      Logger.log('Set F6 (To Date): ' + toDate);
    }
    if (businessPurpose) {
      sheet.getRange('D9').setValue(businessPurpose);
      Logger.log('Set D9 (Business Purpose): ' + businessPurpose);
    }

    Logger.log('Employee information updated successfully');

    return createResponse(true, 'Employee information updated successfully', {
      sheetId: sheetId,
      updated: {
        employeeName: employeeName,
        employeeCode: employeeCode,
        fromDate: fromDate,
        toDate: toDate,
        businessPurpose: businessPurpose
      }
    });

  } catch (error) {
    Logger.log('Error updating employee information: ' + error.toString());
    return createResponse(false, 'Failed to update employee information: ' + error.toString());
  }
}

/**
 * Add expenses to the permanent Project_Expenses_Log tab
 *
 * This tab is NEVER cleared by resetSheetFromMaster — it is a permanent
 * append-only log of all expenses ever exported.
 *
 * Header row: Date | Project | Amount | Category | Notes
 * Each expense from data.expenses is appended as a new row.
 *
 * IMPORTANT: This function opens the spreadsheet fresh via data.sheetId.
 * It must be called from the doGet/doPost router level, NOT from inside
 * exportExpensesToSheet, to avoid V8 scope issues.
 */
function addToLogSheet(data) {
  var sheetId = data.sheetId;
  var expenses = data.expenses;
  var NUM_COLS = 9; // Date | Project | Category | Description | Amount | Visit Type | Payment Mode | Bill | Running Total

  if (!sheetId || !expenses || !Array.isArray(expenses) || expenses.length === 0) {
    Logger.log('addToLogSheet: skipping — missing sheetId or empty expenses');
    return;
  }

  Logger.log('addToLogSheet: opening spreadsheet ' + sheetId + ' with ' + expenses.length + ' expenses');

  var spreadsheet = SpreadsheetApp.openById(String(sheetId));
  var logSheet = spreadsheet.getSheetByName(LOG_TAB_NAME);

  // Create the tab if it doesn't exist
  if (!logSheet) {
    Logger.log('addToLogSheet: creating new "' + LOG_TAB_NAME + '" tab');
    logSheet = spreadsheet.insertSheet(LOG_TAB_NAME);

    // Set up header row
    var headers = [['Date', 'Project', 'Category', 'Description', 'Amount', 'Visit Type', 'Payment Mode', 'Bill', 'Running Total']];
    logSheet.getRange(1, 1, 1, NUM_COLS).setValues(headers);

    // Professional header styling: dark teal bg, white bold text
    logSheet.getRange(1, 1, 1, NUM_COLS)
      .setFontWeight('bold')
      .setFontColor('#ffffff')
      .setBackground('#0f766e')
      .setFontSize(10)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    logSheet.setRowHeight(1, 32);

    // Set amount & running total column format
    logSheet.getRange('E:E').setNumberFormat('\u20B9#,##0.00');
    logSheet.getRange('I:I').setNumberFormat('\u20B9#,##0.00');

    // Freeze header row
    logSheet.setFrozenRows(1);

    // Set column widths for readability
    logSheet.setColumnWidth(1, 110); // Date
    logSheet.setColumnWidth(2, 160); // Project
    logSheet.setColumnWidth(3, 140); // Category
    logSheet.setColumnWidth(4, 250); // Description
    logSheet.setColumnWidth(5, 110); // Amount
    logSheet.setColumnWidth(6, 90);  // Visit Type
    logSheet.setColumnWidth(7, 110); // Payment Mode
    logSheet.setColumnWidth(8, 60);  // Bill
    logSheet.setColumnWidth(9, 120); // Running Total

    // Auto-filter on headers
    logSheet.getRange(1, 1, 1, NUM_COLS).createFilter();

    Logger.log('addToLogSheet: header row created and formatted');
  }

  // Find the next empty row (after header)
  var lastRow = logSheet.getLastRow();
  var nextRow = lastRow + 1;

  // Read existing data for duplicate detection
  // Key = date + project + amount + description (columns 1, 2, 5, 4 in new layout)
  var existingKeys = [];
  if (lastRow > 1) {
    var existingRange = logSheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
    for (var e = 0; e < existingRange.length; e++) {
      existingKeys.push(String(existingRange[e][0]) + '|' + String(existingRange[e][1]) + '|' + Number(existingRange[e][4]) + '|' + String(existingRange[e][3]));
    }
  }

  // Build rows to append (skip duplicates)
  var rows = [];
  var skipped = 0;
  for (var i = 0; i < expenses.length; i++) {
    var expense = expenses[i];
    var formattedDate = formatDateSafe(expense.date);
    var vendor = expense.vendor || 'Unknown';
    var amount = parseFloat(expense.amount) || 0;
    var desc = expense.description || expense.notes || '';
    var visitType = expense.visitType ? expense.visitType.charAt(0).toUpperCase() + expense.visitType.slice(1) : '';
    var paymentMode = expense.paymentMode || 'Cash';
    var billAttached = (expense.billAttached === 'No' || expense.billAttached === 'no') ? '\u2715' : '\u2713';

    var key = formattedDate + '|' + vendor + '|' + amount + '|' + desc;
    var isDup = false;
    for (var d = 0; d < existingKeys.length; d++) {
      if (existingKeys[d] === key) { isDup = true; break; }
    }

    if (isDup) {
      skipped++;
      continue;
    }

    rows.push([formattedDate, vendor, expense.category || 'Miscellaneous', desc, amount, visitType, paymentMode, billAttached, 0]);
  }

  if (rows.length === 0) {
    Logger.log('addToLogSheet: no new rows (all ' + skipped + ' duplicates skipped)');
    return;
  }

  // Batch write all rows at once
  logSheet.getRange(nextRow, 1, rows.length, NUM_COLS).setValues(rows);

  // Format the amount column for the new rows
  logSheet.getRange(nextRow, 5, rows.length, 1).setNumberFormat('\u20B9#,##0.00');

  // Apply alternating row colors for new rows
  for (var i = 0; i < rows.length; i++) {
    var rowNum = nextRow + i;
    var bgColor = (rowNum % 2 === 0) ? '#f8fafc' : '#ffffff';
    logSheet.getRange(rowNum, 1, 1, NUM_COLS).setBackground(bgColor);
  }

  // Center-align Bill column
  logSheet.getRange(nextRow, 8, rows.length, 1).setHorizontalAlignment('center');

  // Set Running Total formulas for ALL data rows (recalculate from row 2)
  var totalLastRow = logSheet.getLastRow();
  if (totalLastRow >= 2) {
    // Row 2: first data row, running total = just the amount
    logSheet.getRange(2, 9).setFormula('=E2');
    logSheet.getRange(2, 9).setNumberFormat('\u20B9#,##0.00');
    // Row 3+: cumulative sum
    for (var r = 3; r <= totalLastRow; r++) {
      logSheet.getRange(r, 9).setFormula('=I' + (r - 1) + '+E' + r);
      logSheet.getRange(r, 9).setNumberFormat('\u20B9#,##0.00');
    }
  }

  Logger.log('addToLogSheet: appended ' + rows.length + ' rows, skipped ' + skipped + ' duplicates');
}

/**
 * Add expenses to ONE "By Project" tab with grouped sections
 *
 * Layout (single tab, all projects in sections):
 *   Row 1: "Project-wise Expense Ledger"    |    | Last Updated: dd-MMM-yyyy
 *   Row 2: (blank)
 *   Row 3: [PROJECT HEADER - cyan bg] "▸ Ace Constructions"
 *   Row 4: Date | Category | Amount | Description  (column headers)
 *   Row 5: 01-Mar | Transportation | ₹1,500 | Cab to site
 *   Row 6: Subtotal | | ₹1,500 |
 *   Row 7: (blank)
 *   Row 8: [PROJECT HEADER] "▸ Biocon Pharma"
 *   ...
 *   Last: GRAND TOTAL | | ₹X,XXX |
 *
 * Uses hidden markers in column E to identify sections:
 *   PROJECT:{name}, SUBTOTAL:{name}, GRAND_TOTAL
 *
 * Skips duplicates (date + amount + description match within project section).
 * This tab is PERMANENT — never cleared on reset.
 *
 * IMPORTANT: Called from doGet/doPost router level, NOT nested.
 */
function addToProjectSheets(data) {
  var sheetId = data.sheetId;
  var expenses = data.expenses;
  var BY_PROJECT_TAB = 'By Project';
  var DATA_COLS = 7; // Date | Category | Description | Amount | Type | Payment | Bill
  var MARKER_COL = 8; // Column H for hidden markers (beyond data columns)

  if (!sheetId || !expenses || !Array.isArray(expenses) || expenses.length === 0) {
    Logger.log('addToProjectSheets: skipping — missing sheetId or empty expenses');
    return;
  }

  Logger.log('addToProjectSheets: opening spreadsheet ' + sheetId);

  var spreadsheet = SpreadsheetApp.openById(String(sheetId));
  var sheet = spreadsheet.getSheetByName(BY_PROJECT_TAB);

  // --- Create the tab if first time ---
  if (!sheet) {
    sheet = spreadsheet.insertSheet(BY_PROJECT_TAB);
    // Title row spanning all columns
    sheet.getRange(1, 1).setValue('Project-wise Expense Ledger').setFontSize(14).setFontWeight('bold').setFontColor('#ffffff');
    sheet.getRange(1, 1, 1, DATA_COLS).setBackground('#0f766e');
    sheet.getRange(1, DATA_COLS).setValue('Last Updated: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy HH:mm')).setFontColor('#d1fae5').setFontSize(9).setHorizontalAlignment('right');
    sheet.setRowHeight(1, 36);
    // Grand total at row 3
    sheet.getRange(3, 1).setValue('GRAND TOTAL').setFontWeight('bold').setFontSize(12).setFontColor('#ffffff');
    sheet.getRange(3, 4).setValue(0).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontSize(12).setFontColor('#ffffff');
    sheet.getRange(3, 1, 1, DATA_COLS).setBackground('#0f766e');
    sheet.getRange(3, MARKER_COL).setValue('GRAND_TOTAL');
    // Column widths
    sheet.setColumnWidth(1, 110); // Date
    sheet.setColumnWidth(2, 140); // Category
    sheet.setColumnWidth(3, 250); // Description
    sheet.setColumnWidth(4, 110); // Amount
    sheet.setColumnWidth(5, 80);  // Type
    sheet.setColumnWidth(6, 100); // Payment
    sheet.setColumnWidth(7, 60);  // Bill
    sheet.hideColumns(MARKER_COL);
    Logger.log('addToProjectSheets: created "By Project" tab');
  }

  // --- Group expenses by vendor ---
  var grouped = {};
  for (var i = 0; i < expenses.length; i++) {
    var key = expenses[i].vendor || 'Uncategorized';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(expenses[i]);
  }

  var projects = Object.keys(grouped).sort();
  Logger.log('addToProjectSheets: ' + projects.length + ' projects: ' + projects.join(', '));

  // --- Process each project ---
  for (var p = 0; p < projects.length; p++) {
    var project = projects[p];
    var items = grouped[project];

    Logger.log('addToProjectSheets: processing "' + project + '" (' + items.length + ' expenses)');

    // Re-read markers each iteration (rows shift after inserts)
    var allData = sheet.getDataRange().getValues();
    var allMarkers = [];
    for (var r = 0; r < allData.length; r++) {
      allMarkers.push(allData[r].length >= MARKER_COL ? String(allData[r][MARKER_COL - 1]) : '');
    }

    // Find this project's header row
    var headerRow = -1;
    for (var r = 0; r < allMarkers.length; r++) {
      if (allMarkers[r] === 'PROJECT:' + project) { headerRow = r + 1; break; }
    }

    if (headerRow > 0) {
      // === EXISTING PROJECT — find subtotal and insert before it ===
      var subtotalRow = -1;
      for (var r = headerRow; r < allMarkers.length; r++) {
        if (allMarkers[r] === 'SUBTOTAL:' + project) { subtotalRow = r + 1; break; }
      }

      if (subtotalRow > 0) {
        // Read existing rows for duplicate detection (description is now col 3, amount col 4)
        var existingRows = [];
        for (var r = headerRow + 1; r < subtotalRow - 1; r++) {
          existingRows.push({
            date: String(allData[r][0]),
            amount: Number(allData[r][3]),
            description: String(allData[r][2])
          });
        }

        // Filter duplicates
        var newItems = [];
        for (var i = 0; i < items.length; i++) {
          var fDate = formatDateSafe(items[i].date);
          var fAmt = parseFloat(items[i].amount) || 0;
          var fDesc = items[i].description || '';
          var isDup = false;
          for (var e = 0; e < existingRows.length; e++) {
            if (existingRows[e].date === fDate && existingRows[e].amount === fAmt && existingRows[e].description === fDesc) {
              isDup = true; break;
            }
          }
          if (!isDup) newItems.push(items[i]);
        }

        Logger.log('  ' + newItems.length + ' new, ' + (items.length - newItems.length) + ' duplicates skipped');

        if (newItems.length > 0) {
          sheet.insertRowsBefore(subtotalRow, newItems.length);
          for (var i = 0; i < newItems.length; i++) {
            var row = subtotalRow + i;
            var visitType = newItems[i].visitType ? newItems[i].visitType.charAt(0).toUpperCase() + newItems[i].visitType.slice(1) : '';
            var paymentMode = newItems[i].paymentMode || 'Cash';
            var billVal = (newItems[i].billAttached === 'No' || newItems[i].billAttached === 'no') ? '\u2715' : '\u2713';
            sheet.getRange(row, 1).setValue(formatDateSafe(newItems[i].date));
            sheet.getRange(row, 2).setValue(newItems[i].category || 'Miscellaneous');
            sheet.getRange(row, 3).setValue(newItems[i].description || '');
            sheet.getRange(row, 4).setValue(parseFloat(newItems[i].amount) || 0).setNumberFormat('\u20B9#,##0.00');
            sheet.getRange(row, 5).setValue(visitType);
            sheet.getRange(row, 6).setValue(paymentMode);
            sheet.getRange(row, 7).setValue(billVal).setHorizontalAlignment('center');
            // Alternating row color
            var dataIdx = row - (headerRow + 2);
            if (dataIdx % 2 === 1) sheet.getRange(row, 1, 1, DATA_COLS).setBackground('#f8fafc');
          }
          // Recalculate subtotal (amount is now column 4)
          var newSubRow = subtotalRow + newItems.length;
          var subTotal = 0;
          for (var r = headerRow + 2; r < newSubRow; r++) {
            subTotal += (parseFloat(sheet.getRange(r, 4).getValue()) || 0);
          }
          sheet.getRange(newSubRow, 1).setValue('Subtotal').setFontWeight('bold').setFontColor('#0f766e');
          sheet.getRange(newSubRow, 4).setValue(subTotal).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontColor('#0f766e');
          sheet.getRange(newSubRow, 1, 1, DATA_COLS).setBackground('#e0f2fe');

          // Update project header with date range
          var allDatesInProject = [];
          for (var r = headerRow + 2; r < newSubRow; r++) {
            var cellVal = sheet.getRange(r, 1).getValue();
            if (cellVal) allDatesInProject.push(String(cellVal));
          }
          if (allDatesInProject.length > 0) {
            allDatesInProject.sort();
            var dateRange = allDatesInProject[0] + ' to ' + allDatesInProject[allDatesInProject.length - 1];
            sheet.getRange(headerRow, 1).setValue('\u25B8 ' + project + ' \u2014 ' + dateRange);
          }
        }
      }
    } else {
      // === NEW PROJECT — insert section before grand total ===
      var grandTotalRow = -1;
      for (var r = 0; r < allMarkers.length; r++) {
        if (allMarkers[r] === 'GRAND_TOTAL') { grandTotalRow = r + 1; break; }
      }
      if (grandTotalRow < 0) grandTotalRow = sheet.getLastRow() + 1;

      // Sort items by date for display
      items.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });

      // Compute date range for project header
      var firstDate = formatDateSafe(items[0].date);
      var lastDate = formatDateSafe(items[items.length - 1].date);
      var dateRangeStr = (firstDate === lastDate) ? firstDate : firstDate + ' to ' + lastDate;

      // Group items by category for subtotals
      var catGroups = {};
      for (var i = 0; i < items.length; i++) {
        var cat = items[i].category || 'Miscellaneous';
        if (!catGroups[cat]) catGroups[cat] = [];
        catGroups[cat].push(items[i]);
      }
      var categories = Object.keys(catGroups).sort();

      // Calculate total rows: header + col header + (items + cat subtotals) + project subtotal + blank
      var totalDataRows = items.length + categories.length; // each category gets a subtotal row
      var rowsNeeded = totalDataRows + 4; // project header + col header + project subtotal + blank
      sheet.insertRowsBefore(grandTotalRow, rowsNeeded);
      var cr = grandTotalRow;

      // Project header (dark teal with date range)
      sheet.getRange(cr, 1).setValue('\u25B8 ' + project + ' \u2014 ' + dateRangeStr).setFontWeight('bold').setFontSize(11);
      sheet.getRange(cr, 1, 1, DATA_COLS).setBackground('#0f766e').setFontColor('#ffffff');
      sheet.setRowHeight(cr, 30);
      sheet.getRange(cr, MARKER_COL).setValue('PROJECT:' + project);
      cr++;

      // Column headers
      sheet.getRange(cr, 1, 1, DATA_COLS).setValues([['Date', 'Category', 'Description', 'Amount', 'Type', 'Payment', 'Bill']]);
      sheet.getRange(cr, 1, 1, DATA_COLS).setFontWeight('bold').setFontColor('#64748b').setFontSize(9).setBackground('#f0fdfa');
      cr++;

      // Expense rows grouped by category with subtotals
      var projTotal = 0;
      var dataRowIdx = 0;
      for (var c = 0; c < categories.length; c++) {
        var catName = categories[c];
        var catItems = catGroups[catName];
        var catSubtotal = 0;

        for (var i = 0; i < catItems.length; i++) {
          var amt = parseFloat(catItems[i].amount) || 0;
          var visitType = catItems[i].visitType ? catItems[i].visitType.charAt(0).toUpperCase() + catItems[i].visitType.slice(1) : '';
          var paymentMode = catItems[i].paymentMode || 'Cash';
          var billVal = (catItems[i].billAttached === 'No' || catItems[i].billAttached === 'no') ? '\u2715' : '\u2713';

          sheet.getRange(cr, 1).setValue(formatDateSafe(catItems[i].date));
          sheet.getRange(cr, 2).setValue(catName);
          sheet.getRange(cr, 3).setValue(catItems[i].description || '');
          sheet.getRange(cr, 4).setValue(amt).setNumberFormat('\u20B9#,##0.00');
          sheet.getRange(cr, 5).setValue(visitType);
          sheet.getRange(cr, 6).setValue(paymentMode);
          sheet.getRange(cr, 7).setValue(billVal).setHorizontalAlignment('center');
          if (dataRowIdx % 2 === 1) sheet.getRange(cr, 1, 1, DATA_COLS).setBackground('#f8fafc');
          catSubtotal += amt;
          dataRowIdx++;
          cr++;
        }

        // Category subtotal row (only if more than one category)
        if (categories.length > 1) {
          sheet.getRange(cr, 1).setValue('  ' + catName + ' Subtotal').setFontWeight('bold').setFontSize(9).setFontColor('#64748b');
          sheet.getRange(cr, 4).setValue(catSubtotal).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontColor('#64748b');
          sheet.getRange(cr, 1, 1, DATA_COLS).setBackground('#f0fdfa');
          cr++;
        }

        projTotal += catSubtotal;
      }

      // Project subtotal row
      sheet.getRange(cr, 1).setValue('Subtotal').setFontWeight('bold').setFontColor('#0f766e');
      sheet.getRange(cr, 4).setValue(projTotal).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontColor('#0f766e');
      sheet.getRange(cr, 1, 1, DATA_COLS).setBackground('#e0f2fe');
      sheet.getRange(cr, MARKER_COL).setValue('SUBTOTAL:' + project);

      Logger.log('  Created section with ' + items.length + ' expenses, subtotal: ' + projTotal);
    }
  }

  // --- Update grand total (amount is now column 4) ---
  var gtData = sheet.getDataRange().getValues();
  var gtTotal = 0;
  var gtRow = -1;
  for (var r = 0; r < gtData.length; r++) {
    var mk = gtData[r].length >= MARKER_COL ? String(gtData[r][MARKER_COL - 1]) : '';
    if (mk.indexOf('SUBTOTAL:') === 0) gtTotal += (parseFloat(gtData[r][3]) || 0);
    if (mk === 'GRAND_TOTAL') gtRow = r + 1;
  }
  if (gtRow > 0) {
    sheet.getRange(gtRow, 1).setValue('GRAND TOTAL').setFontWeight('bold').setFontSize(12).setFontColor('#ffffff');
    sheet.getRange(gtRow, 4).setValue(gtTotal).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontSize(12).setFontColor('#ffffff');
    sheet.getRange(gtRow, 1, 1, DATA_COLS).setBackground('#0f766e');
    sheet.setRowHeight(gtRow, 32);
  }

  // --- Update timestamp ---
  sheet.getRange(1, DATA_COLS).setValue('Last Updated: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy HH:mm')).setFontColor('#d1fae5').setFontSize(9).setHorizontalAlignment('right');

  // --- Add advance summary after grand total ---
  var advances = data.advances;
  if (advances && Array.isArray(advances) && advances.length > 0) {
    var finalData = sheet.getDataRange().getValues();
    var gtRowFinal = -1;
    for (var r = 0; r < finalData.length; r++) {
      var mk = finalData[r].length >= MARKER_COL ? String(finalData[r][MARKER_COL - 1]) : '';
      if (mk === 'GRAND_TOTAL') { gtRowFinal = r + 1; break; }
    }

    if (gtRowFinal > 0) {
      var advStartRow = gtRowFinal + 2;
      // Clear old advance summary if present
      var lastRowSheet = sheet.getLastRow();
      for (var r = gtRowFinal + 1; r <= lastRowSheet; r++) {
        if (String(sheet.getRange(r, MARKER_COL).getValue()) === 'ADVANCE_SUMMARY') {
          // Clear from here to end
          sheet.getRange(r, 1, lastRowSheet - r + 1, MARKER_COL).clearContent().clearFormat();
          advStartRow = r;
          break;
        }
      }

      // Write advance summary section
      sheet.getRange(advStartRow, 1).setValue('Advance Summary').setFontWeight('bold').setFontSize(12).setFontColor('#92400e');
      sheet.getRange(advStartRow, 1, 1, DATA_COLS).setBackground('#fffbeb');
      sheet.getRange(advStartRow, MARKER_COL).setValue('ADVANCE_SUMMARY');

      sheet.getRange(advStartRow + 1, 1, 1, 4).setValues([['Project', 'Advance', 'Spent', 'Remaining']]);
      sheet.getRange(advStartRow + 1, 1, 1, 4).setFontWeight('bold').setFontColor('#64748b').setFontSize(9).setBackground('#f1f5f9');

      for (var a = 0; a < advances.length; a++) {
        var ar = advStartRow + 2 + a;
        var rem = (parseFloat(advances[a].advanceAmount) || 0) - (parseFloat(advances[a].totalSpent) || 0);
        sheet.getRange(ar, 1).setValue(advances[a].projectName);
        sheet.getRange(ar, 2).setValue(parseFloat(advances[a].advanceAmount) || 0).setNumberFormat('\u20B9#,##0.00');
        sheet.getRange(ar, 3).setValue(parseFloat(advances[a].totalSpent) || 0).setNumberFormat('\u20B9#,##0.00').setFontColor('#f59e0b');
        sheet.getRange(ar, 4).setValue(rem).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold')
          .setFontColor(rem < 0 ? '#ef4444' : '#10b981');
      }

      Logger.log('addToProjectSheets: advance summary added for ' + advances.length + ' advances');
    }
  }

  Logger.log('addToProjectSheets: done, grand total = ' + gtTotal);
}

/**
 * Helper: Safely format a date string to dd-MMM-yyyy
 */
function formatDateSafe(dateStr) {
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr || '';
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
  } catch (e) {
    return dateStr || '';
  }
}

/**
 * Create/update individual project tabs (one tab per project)
 * Styled to match the "By Project" grouped layout:
 *   Row 1: [Cyan header] "▸ Project Name"
 *   Row 2: Date | Category | Amount | Description (column headers)
 *   Row 3+: expense data (alternating row shading)
 *   Last:  Subtotal row (bold, teal)
 *
 * Skips duplicates (date + amount + description).
 * These tabs are PERMANENT — never cleared on reset.
 *
 * IMPORTANT: Called from doGet/doPost router level, NOT nested.
 */
function addToIndividualProjectTabs(data) {
  var sheetId = data.sheetId;
  var expenses = data.expenses;
  var NUM_COLS = 9; // S.No | Date | Category | Description | Amount | Type | Payment Mode | Bill Attached | Running Total

  if (!sheetId || !expenses || !Array.isArray(expenses) || expenses.length === 0) {
    Logger.log('addToIndividualProjectTabs: skipping — missing data');
    return;
  }

  var spreadsheet = SpreadsheetApp.openById(String(sheetId));

  // Group by vendor
  var grouped = {};
  for (var i = 0; i < expenses.length; i++) {
    var key = (expenses[i].vendor || 'Uncategorized')
      .replace(/[\/\\?*\[\]:]/g, '-').substring(0, 100).trim() || 'Uncategorized';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(expenses[i]);
  }

  var projects = Object.keys(grouped).sort();
  Logger.log('addToIndividualProjectTabs: ' + projects.length + ' projects');

  // Header row is row 3 (row 1 = project name, row 2 = advance info, row 3 = column headers)
  var HEADER_ROW = 3;
  var DATA_START_ROW = 4;

  for (var p = 0; p < projects.length; p++) {
    var project = projects[p];
    var items = grouped[project];
    var tab = spreadsheet.getSheetByName(project);

    // --- Create tab if new ---
    if (!tab) {
      Logger.log('  Creating tab: "' + project + '"');
      tab = spreadsheet.insertSheet(project);

      // Row 1: Project name header (dark teal, white, bold, 13pt) spanning all columns
      var visitType = (items[0] && items[0].visitType) ? ' (' + items[0].visitType.charAt(0).toUpperCase() + items[0].visitType.slice(1) + ')' : '';
      tab.getRange(1, 1).setValue('\u25B8 ' + project + visitType).setFontWeight('bold').setFontSize(13);
      tab.getRange(1, 1, 1, NUM_COLS).setBackground('#0f766e').setFontColor('#ffffff');
      tab.setRowHeight(1, 38);

      // Row 2: Advance info bar (placeholder — will be populated below if advance exists)
      tab.getRange(2, 1, 1, NUM_COLS).setBackground('#f0fdfa');
      tab.setRowHeight(2, 26);

      // Row 3: Column headers
      tab.getRange(HEADER_ROW, 1, 1, NUM_COLS).setValues([['S.No', 'Date', 'Category', 'Description', 'Amount', 'Type', 'Payment Mode', 'Bill', 'Running Total']]);
      tab.getRange(HEADER_ROW, 1, 1, NUM_COLS)
        .setFontWeight('bold')
        .setFontColor('#374151')
        .setFontSize(9)
        .setBackground('#e5e7eb')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');
      tab.setRowHeight(HEADER_ROW, 28);

      // Row 4: Subtotal (starts at 0) — will be moved down as data is inserted
      tab.getRange(DATA_START_ROW, 1).setValue('Subtotal').setFontWeight('bold').setFontColor('#ffffff');
      tab.getRange(DATA_START_ROW, 5).setValue(0).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontColor('#ffffff');
      tab.getRange(DATA_START_ROW, 1, 1, NUM_COLS).setBackground('#0f766e');

      // Column widths
      tab.setColumnWidth(1, 50);   // S.No
      tab.setColumnWidth(2, 100);  // Date
      tab.setColumnWidth(3, 140);  // Category
      tab.setColumnWidth(4, 250);  // Description
      tab.setColumnWidth(5, 110);  // Amount
      tab.setColumnWidth(6, 80);   // Type
      tab.setColumnWidth(7, 100);  // Payment Mode
      tab.setColumnWidth(8, 70);   // Bill Attached
      tab.setColumnWidth(9, 120);  // Running Total

      // Freeze header rows (1-3)
      tab.setFrozenRows(HEADER_ROW);

      // Auto-filter on column headers
      tab.getRange(HEADER_ROW, 1, 1, NUM_COLS).createFilter();
    }

    // --- Find subtotal row (last row with "Subtotal" in col A) ---
    var lastRow = tab.getLastRow();
    var subtotalRow = -1;
    if (lastRow >= DATA_START_ROW) {
      var colA = tab.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 1).getValues();
      for (var r = colA.length - 1; r >= 0; r--) {
        if (String(colA[r][0]) === 'Subtotal') { subtotalRow = r + DATA_START_ROW; break; }
      }
    }
    if (subtotalRow < 0) subtotalRow = lastRow + 1; // fallback

    // --- Read existing data for duplicate detection ---
    // Duplicate key: date (col 2) + amount (col 5) + description (col 4)
    var existingKeys = [];
    if (subtotalRow > DATA_START_ROW) {
      var existing = tab.getRange(DATA_START_ROW, 1, subtotalRow - DATA_START_ROW, NUM_COLS).getValues();
      for (var r = 0; r < existing.length; r++) {
        // date=col2(idx1), amount=col5(idx4), description=col4(idx3)
        existingKeys.push(String(existing[r][1]) + '|' + Number(existing[r][4]) + '|' + String(existing[r][3]));
      }
    }

    // --- Filter duplicates ---
    var newItems = [];
    for (var i = 0; i < items.length; i++) {
      var fDate = formatDateSafe(items[i].date);
      var fAmt = parseFloat(items[i].amount) || 0;
      var fDesc = items[i].description || '';
      var key = fDate + '|' + fAmt + '|' + fDesc;
      var isDup = false;
      for (var d = 0; d < existingKeys.length; d++) {
        if (existingKeys[d] === key) { isDup = true; break; }
      }
      if (!isDup) newItems.push(items[i]);
    }

    Logger.log('  "' + project + '": ' + newItems.length + ' new, ' + (items.length - newItems.length) + ' dupes skipped');

    if (newItems.length === 0) {
      // Still update advance info bar even if no new items
      _updateAdvanceInfoBar(tab, data.advances, project, subtotalRow, DATA_START_ROW, NUM_COLS);
      continue;
    }

    // --- Insert rows before subtotal ---
    tab.insertRowsBefore(subtotalRow, newItems.length);

    // Count existing data rows to determine S.No starting number
    var existingDataCount = subtotalRow - DATA_START_ROW;

    for (var i = 0; i < newItems.length; i++) {
      var row = subtotalRow + i;
      var sno = existingDataCount + i + 1;
      var amt = parseFloat(newItems[i].amount) || 0;
      var visitTypeVal = newItems[i].visitType ? newItems[i].visitType.charAt(0).toUpperCase() + newItems[i].visitType.slice(1) : '';
      var paymentMode = newItems[i].paymentMode || 'Cash';
      var billVal = (newItems[i].billAttached === 'No' || newItems[i].billAttached === 'no') ? '\u2715' : '\u2713';

      tab.getRange(row, 1).setValue(sno).setHorizontalAlignment('center');
      tab.getRange(row, 2).setValue(formatDateSafe(newItems[i].date));
      tab.getRange(row, 3).setValue(newItems[i].category || 'Miscellaneous');
      tab.getRange(row, 4).setValue(newItems[i].description || '');
      tab.getRange(row, 5).setValue(amt).setNumberFormat('\u20B9#,##0.00');
      tab.getRange(row, 6).setValue(visitTypeVal);
      tab.getRange(row, 7).setValue(paymentMode);
      tab.getRange(row, 8).setValue(billVal).setHorizontalAlignment('center');
      // Running total formula
      if (row === DATA_START_ROW) {
        tab.getRange(row, 9).setFormula('=E' + row).setNumberFormat('\u20B9#,##0.00');
      } else {
        tab.getRange(row, 9).setFormula('=I' + (row - 1) + '+E' + row).setNumberFormat('\u20B9#,##0.00');
      }

      // Alternating row colors
      var dataRowIndex = row - DATA_START_ROW;
      if (dataRowIndex % 2 === 1) {
        tab.getRange(row, 1, 1, NUM_COLS).setBackground('#f8fafc');
      } else {
        tab.getRange(row, 1, 1, NUM_COLS).setBackground('#ffffff');
      }
    }

    // --- Recalculate subtotal (amount is column 5) ---
    var newSubRow = subtotalRow + newItems.length;
    var total = 0;
    for (var r = DATA_START_ROW; r < newSubRow; r++) {
      total += (parseFloat(tab.getRange(r, 5).getValue()) || 0);
    }
    tab.getRange(newSubRow, 1).setValue('Subtotal').setFontWeight('bold').setFontColor('#ffffff');
    tab.getRange(newSubRow, 5).setValue(total).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontColor('#ffffff');
    tab.getRange(newSubRow, 1, 1, NUM_COLS).setBackground('#0f766e');
    tab.setRowHeight(newSubRow, 30);

    // --- Fix running total formulas for ALL data rows (they may have shifted) ---
    for (var r = DATA_START_ROW; r < newSubRow; r++) {
      if (r === DATA_START_ROW) {
        tab.getRange(r, 9).setFormula('=E' + r).setNumberFormat('\u20B9#,##0.00');
      } else {
        tab.getRange(r, 9).setFormula('=I' + (r - 1) + '+E' + r).setNumberFormat('\u20B9#,##0.00');
      }
      // Also fix S.No
      tab.getRange(r, 1).setValue(r - DATA_START_ROW + 1).setHorizontalAlignment('center');
    }

    // --- Update advance info bar ---
    _updateAdvanceInfoBar(tab, data.advances, project, newSubRow, DATA_START_ROW, NUM_COLS);

    // --- Add advance summary below subtotal if available ---
    var advances = data.advances;
    if (advances && Array.isArray(advances)) {
      for (var a = 0; a < advances.length; a++) {
        if (advances[a].projectName && advances[a].projectName.toLowerCase() === project.toLowerCase()) {
          var advRow = newSubRow + 2;
          // Remove old advance summary if present
          var lastRowNow = tab.getLastRow();
          if (lastRowNow > newSubRow + 1) {
            for (var check = newSubRow + 1; check <= lastRowNow; check++) {
              if (String(tab.getRange(check, 1).getValue()) === 'Advance Summary') {
                tab.getRange(check, 1, 4, NUM_COLS).clearContent().clearFormat();
                break;
              }
            }
          }
          // Write advance summary
          var advAmt = parseFloat(advances[a].advanceAmount) || 0;
          var spentAmt = parseFloat(advances[a].totalSpent) || 0;
          var remaining = advAmt - spentAmt;

          tab.getRange(advRow, 1, 1, NUM_COLS).setBackground('#fffbeb');
          tab.getRange(advRow, 1).setValue('Advance Summary').setFontWeight('bold').setFontSize(10).setFontColor('#92400e');
          tab.getRange(advRow + 1, 1).setValue('Advance Amount');
          tab.getRange(advRow + 1, 5).setValue(advAmt).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontColor('#0f766e');
          tab.getRange(advRow + 2, 1).setValue('Total Spent');
          tab.getRange(advRow + 2, 5).setValue(spentAmt).setNumberFormat('\u20B9#,##0.00').setFontColor('#f59e0b');
          tab.getRange(advRow + 3, 1).setValue('Remaining').setFontWeight('bold');
          tab.getRange(advRow + 3, 5).setValue(remaining).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold')
            .setFontColor(remaining < 0 ? '#ef4444' : '#10b981');
          Logger.log('  Added advance summary for "' + project + '": advance=' + advAmt + ', remaining=' + remaining);
          break;
        }
      }
    }

    Logger.log('  "' + project + '": subtotal = ' + total);
  }

  Logger.log('addToIndividualProjectTabs: done');
}

/**
 * Helper: Update the advance info bar in Row 2 of an individual project tab
 * Shows: Advance: X | Spent: Y | Remaining: Z | percentage
 */
function _updateAdvanceInfoBar(tab, advances, project, subtotalRow, dataStartRow, numCols) {
  if (!advances || !Array.isArray(advances)) return;

  for (var a = 0; a < advances.length; a++) {
    if (advances[a].projectName && advances[a].projectName.toLowerCase() === project.toLowerCase()) {
      var advAmt = parseFloat(advances[a].advanceAmount) || 0;
      var spentAmt = parseFloat(advances[a].totalSpent) || 0;
      var remaining = advAmt - spentAmt;
      var pct = advAmt > 0 ? Math.round((spentAmt / advAmt) * 100) : 0;

      // Build the info bar text
      var infoText = 'Advance: \u20B9' + advAmt.toLocaleString('en-IN') + '  |  Spent: \u20B9' + spentAmt.toLocaleString('en-IN') + '  |  Remaining: \u20B9' + remaining.toLocaleString('en-IN') + '  |  ' + pct + '%';

      tab.getRange(2, 1).setValue(infoText).setFontWeight('bold').setFontSize(10);
      tab.getRange(2, 1, 1, numCols).setBackground('#f0fdfa');

      // Color code based on remaining
      if (remaining < 0) {
        tab.getRange(2, 1).setFontColor('#ef4444'); // danger - overspent
      } else if (pct >= 80) {
        tab.getRange(2, 1).setFontColor('#f59e0b'); // warning
      } else {
        tab.getRange(2, 1).setFontColor('#10b981'); // success
      }
      break;
    }
  }
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

/**
 * Test function - can be run manually from Apps Script editor
 */
function testCreateSheet() {
  const testData = {
    action: 'createSheet',
    userId: 'test123',
    userEmail: 'homeessentials143@gmail.com',
    userName: 'Test User'
  };

  const result = createSheetForUser(testData);
  Logger.log(result.getContent());
}

/**
 * Test function - can be run manually from Apps Script editor
 */
function testExport() {
  const testData = {
    action: 'exportExpenses',
    sheetId: 'YOUR_TEST_SHEET_ID_HERE',
    expenses: [
      {
        date: '2024-01-15',
        vendor: 'Test Vendor',
        category: 'Travel',
        amount: 150.00
      }
    ]
  };

  const result = exportExpensesToSheet(testData);
  Logger.log(result.getContent());
}

/**
 * Test function - Export PDF
 */
function testExportPdf() {
  const testData = {
    action: 'exportPdf',
    sheetId: 'YOUR_TEST_SHEET_ID_HERE'
  };

  const result = exportSheetAsPdf(testData);
  Logger.log(result.getContent());
}

/**
 * Test function - Reset Sheet
 * IMPORTANT: Replace the sheetId with your actual sheet ID to test
 */
function testResetSheet() {
  // Replace this with your actual Google Sheet ID
  const testData = {
    action: 'resetSheet',
    sheetId: 'YOUR_TEST_SHEET_ID_HERE'  // <-- Replace with actual ID
  };

  const result = resetSheetFromMaster(testData);
  Logger.log(result.getContent());
}

/**
 * Test function - addToLogSheet
 * Tests the permanent log sheet with sample expenses.
 * Replace sheetId with your actual Google Sheet ID.
 */
function testLogSheet() {
  var testData = {
    sheetId: 'YOUR_TEST_SHEET_ID_HERE',  // <-- Replace with actual ID
    expenses: [
      {
        date: '2025-03-20',
        vendor: 'Ace Constructions',
        amount: 2500.00,
        category: 'Materials',
        description: 'Cement bags x10'
      },
      {
        date: '2025-03-21',
        vendor: 'Biocon Pharma',
        amount: 1800.50,
        category: 'Travel',
        description: 'Cab to Biocon campus'
      },
      {
        date: '2025-03-22',
        vendor: 'Ace Constructions',
        amount: 750.00,
        category: 'Labour',
        description: 'Daily wages for helpers'
      },
      {
        date: '2025-03-22',
        vendor: 'Office Supplies',
        amount: 320.00,
        category: 'Stationery',
        description: 'Printer cartridge'
      }
    ]
  };

  Logger.log('=== Testing addToLogSheet ===');
  addToLogSheet(testData);
  Logger.log('=== testLogSheet complete ===');
}

/**
 * Test function - addToProjectSheets
 * Tests the single "By Project" tab with grouped sections.
 * Replace sheetId with your actual Google Sheet ID.
 */
function testProjectSheets() {
  var testData = {
    sheetId: 'YOUR_TEST_SHEET_ID_HERE',  // <-- Replace with actual ID
    expenses: [
      {
        date: '2025-03-20',
        vendor: 'Ace Constructions',
        amount: 2500.00,
        category: 'Materials',
        description: 'Cement bags x10'
      },
      {
        date: '2025-03-21',
        vendor: 'Biocon Pharma',
        amount: 1800.50,
        category: 'Travel',
        description: 'Cab to Biocon campus'
      },
      {
        date: '2025-03-22',
        vendor: 'Ace Constructions',
        amount: 750.00,
        category: 'Labour',
        description: 'Daily wages for helpers'
      },
      {
        date: '2025-03-22',
        vendor: 'Office Supplies',
        amount: 320.00,
        category: 'Stationery',
        description: 'Printer cartridge'
      }
    ]
  };

  Logger.log('=== Testing addToProjectSheets ===');
  addToProjectSheets(testData);
  Logger.log('=== testProjectSheets complete ===');
}

/**
 * Test function - updateEmployeeInformation
 * Replace sheetId with your actual Google Sheet ID.
 */
function testUpdateEmployeeInfo() {
  var testData = {
    sheetId: 'YOUR_TEST_SHEET_ID_HERE',  // <-- Replace with actual ID
    employeeName: 'John Doe',
    employeeCode: 'EMP-001',
    fromDate: '01-Mar-2025',
    toDate: '31-Mar-2025',
    businessPurpose: 'Site visit expenses for Q1 2025'
  };

  var result = updateEmployeeInformation(testData);
  Logger.log(result.getContent());
}
