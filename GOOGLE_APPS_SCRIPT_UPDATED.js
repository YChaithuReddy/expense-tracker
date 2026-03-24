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
        // Step 1: Main export to ExpenseReport tab (existing, works perfectly)
        var exportResult = exportExpensesToSheet(data);
        // Step 2: Log sheet (called from router level, NOT nested)
        try { addToLogSheet(data); } catch (err) { Logger.log('Log sheet error: ' + err.toString()); }
        // Step 3: "By Project" grouped tab (called from router level, NOT nested)
        try { addToProjectSheets(data); } catch (err) { Logger.log('By Project tab error: ' + err.toString()); }
        // Step 4: Individual project tabs (Ace, Biocon, etc.)
        try { addToIndividualProjectTabs(data); } catch (err) { Logger.log('Individual project tabs error: ' + err.toString()); }
        return exportResult;

      case 'verifySheet':
        return verifySheetAccess(data);

      case 'exportPdf':
        return exportSheetAsPdf(data);

      case 'resetSheet':
        return resetSheetFromMaster(data);

      case 'updateEmployeeInformation':
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
        // Step 1: Main export to ExpenseReport tab
        var exportResult = exportExpensesToSheet(data);
        // Step 2: Log sheet (called from router level, NOT nested)
        try { addToLogSheet(data); } catch (err) { Logger.log('Log sheet error: ' + err.toString()); }
        // Step 3: "By Project" grouped tab (called from router level, NOT nested)
        try { addToProjectSheets(data); } catch (err) { Logger.log('By Project tab error: ' + err.toString()); }
        // Step 4: Individual project tabs (Ace, Biocon, etc.)
        try { addToIndividualProjectTabs(data); } catch (err) { Logger.log('Individual project tabs error: ' + err.toString()); }
        return exportResult;

      case 'verifySheet':
        return verifySheetAccess(data);

      case 'exportPdf':
        return exportSheetAsPdf(data);

      case 'resetSheet':
        return resetSheetFromMaster(data);

      case 'updateEmployeeInformation':
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

    // Prepare data arrays for batch update
    const serialNumbers = [];
    const dates = [];
    const vendors = [];
    const categories = [];
    const costs = [];

    expenses.forEach((expense, index) => {
      // Column A: S.NO (1, 2, 3, ...)
      serialNumbers.push([nextRow + index - 13]);

      // Column B: DATE (format: dd-MMM-yyyy)
      const date = new Date(expense.date);
      const formattedDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
      dates.push([formattedDate]);

      // Column C: VENDOR NAME (will be merged with D)
      vendors.push([expense.vendor || 'Unknown Vendor']);

      // Column E: CATEGORY
      categories.push([expense.category || 'Miscellaneous']);

      // Column F: COST
      costs.push([parseFloat(expense.amount) || 0]);
    });

    // Batch update all columns
    const numExpenses = expenses.length;

    // Get reference formatting from row 14 (template row)
    const templateRange = sheet.getRange('A14:F14');
    const templateBackgrounds = templateRange.getBackgrounds();
    const templateFontColors = templateRange.getFontColors();
    const templateFontFamilies = templateRange.getFontFamilies();
    const templateFontSizes = templateRange.getFontSizes();
    const templateFontWeights = templateRange.getFontWeights();
    const templateHorizontalAlignments = templateRange.getHorizontalAlignments();
    const templateVerticalAlignments = templateRange.getVerticalAlignments();
    const templateNumberFormats = templateRange.getNumberFormats();

    // Apply formatting to all data rows being inserted
    for (let i = 0; i < numExpenses; i++) {
      const targetRow = sheet.getRange(nextRow + i, 1, 1, 6);
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

    // Set data values
    sheet.getRange(nextRow, 1, numExpenses, 1).setValues(serialNumbers);
    sheet.getRange(nextRow, 2, numExpenses, 1).setValues(dates);
    sheet.getRange(nextRow, 3, numExpenses, 1).setValues(vendors);
    sheet.getRange(nextRow, 5, numExpenses, 1).setValues(categories);
    sheet.getRange(nextRow, 6, numExpenses, 1).setValues(costs);

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
        const clearRange = sheet.getRange(dataEndRow + 1, 1, currentLastRow - dataEndRow, 6);
        clearRange.clear();
      }

      // Get the summary section from master (rows 67-83 = 17 rows)
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

      // Get target range in user sheet
      const userSummaryRange = sheet.getRange(summaryStartRow, 1, SUMMARY_ROW_COUNT, 6);

      // Apply formulas/values (formulas take priority)
      for (let i = 0; i < summaryFormulas.length; i++) {
        for (let j = 0; j < summaryFormulas[i].length; j++) {
          if (summaryFormulas[i][j]) {
            // Has formula - update row references for SUBTOTAL
            let formula = summaryFormulas[i][j];

            // Update SUBTOTAL formula to reference actual data range (14 to dataEndRow)
            if (formula.includes('=SUM(F14:F66)')) {
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
    var headers = [['Date', 'Project', 'Amount', 'Category', 'Notes']];
    logSheet.getRange(1, 1, 1, 5).setValues(headers);

    // Bold header
    logSheet.getRange(1, 1, 1, 5).setFontWeight('bold');

    // Set amount column format
    logSheet.getRange('C:C').setNumberFormat('\u20B9#,##0.00');

    // Freeze header row
    logSheet.setFrozenRows(1);

    // Set column widths for readability
    logSheet.setColumnWidth(1, 120); // Date
    logSheet.setColumnWidth(2, 180); // Project
    logSheet.setColumnWidth(3, 120); // Amount
    logSheet.setColumnWidth(4, 150); // Category
    logSheet.setColumnWidth(5, 250); // Notes

    Logger.log('addToLogSheet: header row created and formatted');
  }

  // Find the next empty row (after header)
  var lastRow = logSheet.getLastRow();
  var nextRow = lastRow + 1;

  Logger.log('addToLogSheet: appending at row ' + nextRow);

  // Build rows to append
  var rows = [];
  for (var i = 0; i < expenses.length; i++) {
    var expense = expenses[i];
    var date = new Date(expense.date);
    var formattedDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd-MMM-yyyy');

    rows.push([
      formattedDate,
      expense.vendor || 'Unknown',
      parseFloat(expense.amount) || 0,
      expense.category || 'Miscellaneous',
      expense.description || expense.notes || ''
    ]);
  }

  // Batch write all rows at once
  logSheet.getRange(nextRow, 1, rows.length, 5).setValues(rows);

  // Format the amount column for the new rows
  logSheet.getRange(nextRow, 3, rows.length, 1).setNumberFormat('\u20B9#,##0.00');

  Logger.log('addToLogSheet: appended ' + rows.length + ' rows successfully');
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
  var MARKER_COL = 5; // Column E for hidden markers

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
    sheet.getRange(1, 1).setValue('Project-wise Expense Ledger').setFontSize(14).setFontWeight('bold').setFontColor('#0e7490');
    sheet.getRange(1, 4).setValue('Last Updated: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy HH:mm')).setFontColor('#64748b').setFontSize(9);
    // Grand total at row 3
    sheet.getRange(3, 1).setValue('GRAND TOTAL').setFontWeight('bold').setFontSize(12).setFontColor('#0e7490');
    sheet.getRange(3, 3).setValue(0).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontSize(12).setFontColor('#0e7490');
    sheet.getRange(3, MARKER_COL).setValue('GRAND_TOTAL');
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 160);
    sheet.setColumnWidth(3, 130);
    sheet.setColumnWidth(4, 280);
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
        // Read existing rows for duplicate detection
        var existingRows = [];
        for (var r = headerRow + 1; r < subtotalRow - 1; r++) {
          existingRows.push({
            date: String(allData[r][0]),
            amount: Number(allData[r][2]),
            description: String(allData[r][3])
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
            sheet.getRange(row, 1).setValue(formatDateSafe(newItems[i].date));
            sheet.getRange(row, 2).setValue(newItems[i].category || 'Miscellaneous');
            sheet.getRange(row, 3).setValue(parseFloat(newItems[i].amount) || 0).setNumberFormat('\u20B9#,##0.00');
            sheet.getRange(row, 4).setValue(newItems[i].description || '');
          }
          // Recalculate subtotal
          var newSubRow = subtotalRow + newItems.length;
          var subTotal = 0;
          for (var r = headerRow + 2; r < newSubRow; r++) {
            subTotal += (parseFloat(sheet.getRange(r, 3).getValue()) || 0);
          }
          sheet.getRange(newSubRow, 3).setValue(subTotal).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontColor('#0e7490');
        }
      }
    } else {
      // === NEW PROJECT — insert section before grand total ===
      var grandTotalRow = -1;
      for (var r = 0; r < allMarkers.length; r++) {
        if (allMarkers[r] === 'GRAND_TOTAL') { grandTotalRow = r + 1; break; }
      }
      if (grandTotalRow < 0) grandTotalRow = sheet.getLastRow() + 1;

      var rowsNeeded = items.length + 4; // header + col header + items + subtotal + blank
      sheet.insertRowsBefore(grandTotalRow, rowsNeeded);
      var cr = grandTotalRow;

      // Project header (cyan)
      sheet.getRange(cr, 1).setValue('\u25B8 ' + project).setFontWeight('bold').setFontSize(11);
      sheet.getRange(cr, 1, 1, 4).setBackground('#0e7490').setFontColor('#ffffff');
      sheet.getRange(cr, MARKER_COL).setValue('PROJECT:' + project);
      cr++;

      // Column headers
      sheet.getRange(cr, 1, 1, 4).setValues([['Date', 'Category', 'Amount', 'Description']]);
      sheet.getRange(cr, 1, 1, 4).setFontWeight('bold').setFontColor('#64748b').setFontSize(9).setBackground('#f1f5f9');
      cr++;

      // Expense rows
      var subAmt = 0;
      for (var i = 0; i < items.length; i++) {
        sheet.getRange(cr, 1).setValue(formatDateSafe(items[i].date));
        sheet.getRange(cr, 2).setValue(items[i].category || 'Miscellaneous');
        sheet.getRange(cr, 3).setValue(parseFloat(items[i].amount) || 0).setNumberFormat('\u20B9#,##0.00');
        sheet.getRange(cr, 4).setValue(items[i].description || '');
        if (i % 2 === 1) sheet.getRange(cr, 1, 1, 4).setBackground('#f8fafc');
        subAmt += (parseFloat(items[i].amount) || 0);
        cr++;
      }

      // Subtotal row
      sheet.getRange(cr, 1).setValue('Subtotal').setFontWeight('bold').setFontColor('#0e7490');
      sheet.getRange(cr, 3).setValue(subAmt).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontColor('#0e7490');
      sheet.getRange(cr, MARKER_COL).setValue('SUBTOTAL:' + project);

      Logger.log('  Created section with ' + items.length + ' expenses, subtotal: ' + subAmt);
    }
  }

  // --- Update grand total ---
  var gtData = sheet.getDataRange().getValues();
  var gtTotal = 0;
  var gtRow = -1;
  for (var r = 0; r < gtData.length; r++) {
    var mk = gtData[r].length >= MARKER_COL ? String(gtData[r][MARKER_COL - 1]) : '';
    if (mk.indexOf('SUBTOTAL:') === 0) gtTotal += (parseFloat(gtData[r][2]) || 0);
    if (mk === 'GRAND_TOTAL') gtRow = r + 1;
  }
  if (gtRow > 0) {
    sheet.getRange(gtRow, 1).setValue('GRAND TOTAL').setFontWeight('bold').setFontSize(12).setFontColor('#0e7490');
    sheet.getRange(gtRow, 3).setValue(gtTotal).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontSize(12).setFontColor('#0e7490');
  }

  // --- Update timestamp ---
  sheet.getRange(1, 4).setValue('Last Updated: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy HH:mm')).setFontColor('#64748b').setFontSize(9);

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

  for (var p = 0; p < projects.length; p++) {
    var project = projects[p];
    var items = grouped[project];
    var tab = spreadsheet.getSheetByName(project);

    // --- Create tab if new ---
    if (!tab) {
      Logger.log('  Creating tab: "' + project + '"');
      tab = spreadsheet.insertSheet(project);

      // Row 1: Project header (cyan, matching By Project style)
      tab.getRange(1, 1).setValue('\u25B8 ' + project).setFontWeight('bold').setFontSize(12);
      tab.getRange(1, 1, 1, 4).setBackground('#0e7490').setFontColor('#ffffff');

      // Row 2: Column headers
      tab.getRange(2, 1, 1, 4).setValues([['Date', 'Category', 'Amount', 'Description']]);
      tab.getRange(2, 1, 1, 4).setFontWeight('bold').setFontColor('#64748b').setFontSize(9).setBackground('#f1f5f9');

      // Row 3: Subtotal (starts at 0)
      tab.getRange(3, 1).setValue('Subtotal').setFontWeight('bold').setFontColor('#0e7490');
      tab.getRange(3, 3).setValue(0).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontColor('#0e7490');

      // Column widths
      tab.setColumnWidth(1, 120);
      tab.setColumnWidth(2, 160);
      tab.setColumnWidth(3, 130);
      tab.setColumnWidth(4, 280);

      // Freeze header rows
      tab.setFrozenRows(2);
    }

    // --- Find subtotal row (last row with "Subtotal" in col A) ---
    var lastRow = tab.getLastRow();
    var subtotalRow = -1;
    if (lastRow >= 3) {
      var colA = tab.getRange(3, 1, lastRow - 2, 1).getValues();
      for (var r = colA.length - 1; r >= 0; r--) {
        if (String(colA[r][0]) === 'Subtotal') { subtotalRow = r + 3; break; }
      }
    }
    if (subtotalRow < 0) subtotalRow = lastRow + 1; // fallback

    // --- Read existing data for duplicate detection ---
    var existingKeys = [];
    if (subtotalRow > 3) {
      var existing = tab.getRange(3, 1, subtotalRow - 3, 4).getValues();
      for (var r = 0; r < existing.length; r++) {
        existingKeys.push(String(existing[r][0]) + '|' + Number(existing[r][2]) + '|' + String(existing[r][3]));
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

    if (newItems.length === 0) continue;

    // --- Insert rows before subtotal ---
    tab.insertRowsBefore(subtotalRow, newItems.length);

    for (var i = 0; i < newItems.length; i++) {
      var row = subtotalRow + i;
      tab.getRange(row, 1).setValue(formatDateSafe(newItems[i].date));
      tab.getRange(row, 2).setValue(newItems[i].category || 'Miscellaneous');
      tab.getRange(row, 3).setValue(parseFloat(newItems[i].amount) || 0).setNumberFormat('\u20B9#,##0.00');
      tab.getRange(row, 4).setValue(newItems[i].description || '');
      // Alternating row shading (check row number relative to data start)
      var dataRowIndex = row - 3; // 0-based from first data row
      if (dataRowIndex % 2 === 1) tab.getRange(row, 1, 1, 4).setBackground('#f8fafc');
    }

    // --- Recalculate subtotal ---
    var newSubRow = subtotalRow + newItems.length;
    var total = 0;
    for (var r = 3; r < newSubRow; r++) {
      total += (parseFloat(tab.getRange(r, 3).getValue()) || 0);
    }
    tab.getRange(newSubRow, 1).setValue('Subtotal').setFontWeight('bold').setFontColor('#0e7490');
    tab.getRange(newSubRow, 3).setValue(total).setNumberFormat('\u20B9#,##0.00').setFontWeight('bold').setFontColor('#0e7490');

    Logger.log('  "' + project + '": subtotal = ' + total);
  }

  Logger.log('addToIndividualProjectTabs: done');
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
