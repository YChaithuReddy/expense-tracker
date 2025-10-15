/**
 * Google Apps Script for Expense Tracker Auto-Copy Template
 *
 * This script handles:
 * 1. Creating a new copy of the master template for each user
 * 2. Sharing the copy with the user's email
 * 3. Accepting data exports from the backend
 *
 * Deploy this as a Web App with "Execute as: Me" and "Access: Anyone"
 */

const MASTER_TEMPLATE_ID = '1dcq8HKP1j4NocCMgAY9YSXlwCrzHwIiRCd0t4mun25E';
const TAB_NAME = 'ExpenseReport';

/**
 * HTTP POST handler - called by backend
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case 'createSheet':
        return createSheetForUser(data);
      case 'exportExpenses':
        return exportExpensesToSheet(data);
      case 'verifySheet':
        return verifySheetAccess(data);
      case 'exportPdf':
        return exportSheetAsPdf(data);
      case 'resetSheet':
        return resetSheetFromMaster(data);
      default:
        return createResponse(false, 'Unknown action: ' + action);
    }
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return createResponse(false, 'Server error: ' + error.toString());
  }
}

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

    // Find next empty row (starting from row 14)
    const dataRange = sheet.getRange('B14:B66');
    const values = dataRange.getValues();
    let nextRow = 14;

    for (let i = 0; i < values.length; i++) {
      if (!values[i][0] || values[i][0] === '') {
        nextRow = 14 + i;
        break;
      }
    }

    // Check if we have space for all expenses
    if (nextRow + expenses.length > 67) {
      return createResponse(false, 'Not enough space. Only ' + (67 - nextRow) + ' rows available.');
    }

    Logger.log('Starting export at row: ' + nextRow);

    // Prepare data arrays for batch update
    const serialNumbers = [];
    const dates = [];
    const vendors = [];
    const categories = [];
    const costs = [];

    expenses.forEach((expense, index) => {
      // Column A: S.NO
      serialNumbers.push([nextRow + index - 13]);

      // Column B: DATE (format: dd-MMM-yyyy)
      const date = new Date(expense.date);
      const formattedDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
      dates.push([formattedDate]);

      // Column C: VENDOR NAME (merged with D)
      vendors.push([expense.vendor || 'Unknown Vendor']);

      // Column E: CATEGORY
      categories.push([expense.category || 'Miscellaneous']);

      // Column F: COST
      costs.push([parseFloat(expense.amount) || 0]);
    });

    // Batch update all columns
    const numExpenses = expenses.length;

    // Set S.NO (Column A)
    sheet.getRange(nextRow, 1, numExpenses, 1).setValues(serialNumbers);

    // Set DATE (Column B)
    sheet.getRange(nextRow, 2, numExpenses, 1).setValues(dates);

    // Set VENDOR NAME (Column C)
    sheet.getRange(nextRow, 3, numExpenses, 1).setValues(vendors);

    // Set CATEGORY (Column E)
    sheet.getRange(nextRow, 5, numExpenses, 1).setValues(categories);

    // Set COST (Column F)
    sheet.getRange(nextRow, 6, numExpenses, 1).setValues(costs);

    // Note: Borders are already set on the sheet (A14:F66) from master template
    // No need to reapply borders during export - they're permanent on the sheet

    Logger.log('Export completed successfully');

    return createResponse(true, 'Successfully exported ' + numExpenses + ' expenses', {
      exportedCount: numExpenses,
      startRow: nextRow,
      endRow: nextRow + numExpenses - 1
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
 * This will replace the corrupted/messed up sheet with a fresh copy
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

    Logger.log('Clearing data and applying borders from master template...');

    // Get the data range A14:F66
    const userDataRange = userSheet.getRange('A14:F66');
    const masterDataRange = masterSheet.getRange('A14:F66');

    // Step 1: Clear all content and formatting from user sheet
    userDataRange.clear();

    // Step 2: Copy ONLY the formatting (borders, colors, fonts) from master - no data
    const masterBackgrounds = masterDataRange.getBackgrounds();
    const masterFontColors = masterDataRange.getFontColors();
    const masterFontFamilies = masterDataRange.getFontFamilies();
    const masterFontSizes = masterDataRange.getFontSizes();
    const masterFontWeights = masterDataRange.getFontWeights();
    const masterHorizontalAlignments = masterDataRange.getHorizontalAlignments();
    const masterVerticalAlignments = masterDataRange.getVerticalAlignments();
    const masterNumberFormats = masterDataRange.getNumberFormats();

    // Apply all formatting to user sheet
    userDataRange.setBackgrounds(masterBackgrounds);
    userDataRange.setFontColors(masterFontColors);
    userDataRange.setFontFamilies(masterFontFamilies);
    userDataRange.setFontSizes(masterFontSizes);
    userDataRange.setFontWeights(masterFontWeights);
    userDataRange.setHorizontalAlignments(masterHorizontalAlignments);
    userDataRange.setVerticalAlignments(masterVerticalAlignments);
    userDataRange.setNumberFormats(masterNumberFormats);

    // Step 3: Note - we cannot use copyTo between different spreadsheets
    // Borders will be explicitly set in Step 4 instead

    // Step 4: Explicitly set borders (simplified version without BorderStyle enum)
    // Apply borders to the entire data range A14:F66
    userDataRange.setBorder(
      true,  // top
      true,  // left
      true,  // bottom
      true,  // right
      true,  // vertical (internal vertical borders)
      true   // horizontal (internal horizontal borders)
    );

    // Apply borders to header row (row 13)
    const headerRange = userSheet.getRange('A13:F13');
    headerRange.setBorder(
      true,  // top
      true,  // left
      true,  // bottom
      true,  // right
      false, // no internal vertical
      false  // no internal horizontal
    );

    Logger.log('Sheet reset completed - data cleared, all formatting and borders explicitly applied');

    return createResponse(true, 'Sheet reset successfully - all data cleared, borders restored', {
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
function createResponse(success, message, data = null) {
  const response = {
    status: success ? 'success' : 'error',
    message: message
  };

  if (data) {
    response.data = data;
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

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
