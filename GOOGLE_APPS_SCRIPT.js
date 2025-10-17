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
    // First check the current data range
    const lastRow = sheet.getLastRow();
    const startRow = 14;
    let nextRow = startRow;

    // Check existing data to find first empty row
    if (lastRow >= startRow) {
      const dataRange = sheet.getRange(startRow, 2, lastRow - startRow + 1, 1);
      const values = dataRange.getValues();

      for (let i = 0; i < values.length; i++) {
        if (!values[i][0] || values[i][0] === '') {
          nextRow = startRow + i;
          break;
        } else if (i === values.length - 1) {
          // All rows have data, start after the last row
          nextRow = lastRow + 1;
        }
      }
    }

    // Check if we need to expand the sheet
    const requiredEndRow = nextRow + expenses.length - 1;
    const currentMaxDataRow = 66; // Fixed data section ends at row 66
    const summaryStartRow = 67; // Summary section starts at row 67 (rows 67-83 in master)
    const summaryEndRow = 83; // Summary section ends at row 83
    const summaryRowCount = summaryEndRow - summaryStartRow + 1; // 17 rows

    if (requiredEndRow > currentMaxDataRow) {
      Logger.log('Expanding data section from row ' + currentMaxDataRow + ' to row ' + requiredEndRow);

      // Insert new rows BEFORE row 67 (summary section) to push it down
      const rowsToInsert = requiredEndRow - currentMaxDataRow;
      sheet.insertRowsBefore(summaryStartRow, rowsToInsert);

      // Get reference formatting from row 14 (a data row)
      const formatRange = sheet.getRange('A14:F14');

      // Copy all formatting from row 14
      const backgrounds = formatRange.getBackgrounds();
      const fontColors = formatRange.getFontColors();
      const fontFamilies = formatRange.getFontFamilies();
      const fontSizes = formatRange.getFontSizes();
      const fontWeights = formatRange.getFontWeights();
      const horizontalAlignments = formatRange.getHorizontalAlignments();
      const verticalAlignments = formatRange.getVerticalAlignments();
      const numberFormats = formatRange.getNumberFormats();

      // Apply formatting to each new data row (starting from row 67, which was just inserted)
      for (let i = 0; i < rowsToInsert; i++) {
        const targetRow = sheet.getRange(summaryStartRow + i, 1, 1, 6);
        targetRow.setBackgrounds(backgrounds);
        targetRow.setFontColors(fontColors);
        targetRow.setFontFamilies(fontFamilies);
        targetRow.setFontSizes(fontSizes);
        targetRow.setFontWeights(fontWeights);
        targetRow.setHorizontalAlignments(horizontalAlignments);
        targetRow.setVerticalAlignments(verticalAlignments);
        targetRow.setNumberFormats(numberFormats);

        // Apply borders
        targetRow.setBorder(true, true, true, true, true, true);

        // Merge vendor cells (columns C and D) like in the template
        const vendorRange = sheet.getRange(summaryStartRow + i, 3, 1, 2);
        vendorRange.merge();
      }

      // Now copy the ENTIRE summary section from master template to new position
      const newSummaryStartRow = requiredEndRow + 1;
      Logger.log('Copying summary section from master template (A67:F83) to row ' + newSummaryStartRow);

      // Open master template to copy summary section
      const masterSpreadsheet = SpreadsheetApp.openById(MASTER_TEMPLATE_ID);
      const masterSheet = masterSpreadsheet.getSheetByName(TAB_NAME);

      if (masterSheet) {
        // Get the summary section from master (rows 67-83)
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
        const userSummaryRange = sheet.getRange(newSummaryStartRow, 1, summaryRowCount, 6);

        // Apply all properties
        // First apply formulas/values (formulas take priority)
        for (let i = 0; i < summaryFormulas.length; i++) {
          for (let j = 0; j < summaryFormulas[i].length; j++) {
            if (summaryFormulas[i][j]) {
              // Has formula - need to update row references
              let formula = summaryFormulas[i][j];

              // Update SUBTOTAL formula to reference correct data range
              if (formula.includes('=SUM(F14:F66)')) {
                formula = '=SUM(F14:F' + requiredEndRow + ')';
              }

              userSummaryRange.getCell(i + 1, j + 1).setFormula(formula);
            } else if (summaryValues[i][j]) {
              // No formula, just value
              userSummaryRange.getCell(i + 1, j + 1).setValue(summaryValues[i][j]);
            }
          }
        }

        // Apply all formatting
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
          const rowOffset = mergedRange.getRow() - 67; // Offset from row 67
          const numRows = mergedRange.getNumRows();
          const numCols = mergedRange.getNumColumns();
          const col = mergedRange.getColumn();

          // Apply same merge pattern in user sheet at new position
          const userMergeRange = sheet.getRange(newSummaryStartRow + rowOffset, col, numRows, numCols);
          userMergeRange.merge();
        }

        // Copy borders
        userSummaryRange.setBorder(true, true, true, true, true, true);

        Logger.log('Summary section copied successfully to row ' + newSummaryStartRow);
      }

      Logger.log('Sheet expanded by ' + rowsToInsert + ' rows. Summary section moved to row ' + newSummaryStartRow);
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

    // Set VENDOR NAME (Column C) and merge with Column D to match header format
    sheet.getRange(nextRow, 3, numExpenses, 1).setValues(vendors);

    // Merge vendor cells across columns C and D for each row
    for (let i = 0; i < numExpenses; i++) {
      const vendorRange = sheet.getRange(nextRow + i, 3, 1, 2);  // Row, Col C, 1 row, 2 columns
      vendorRange.merge();
    }

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

    Logger.log('Clearing data and restoring formatting from master template...');

    // Get the actual last row (sheet might be expanded)
    const lastRow = userSheet.getLastRow();
    const originalDataEndRow = 66; // Original data section ends at row 66
    const originalSummaryStartRow = 67; // Original summary starts at row 67
    const originalSummaryEndRow = 83; // Original summary ends at row 83

    // Step 1: Clear ONLY data rows (14 to end of data section, excluding summary)
    if (lastRow > originalSummaryStartRow) {
      // Sheet was expanded - need to find where summary actually is
      // Summary is 17 rows (67-83), so it should be at lastRow - 16 to lastRow
      const currentSummaryStartRow = lastRow - 16;

      // Clear data range from row 14 to just before summary
      if (currentSummaryStartRow > 14) {
        const userDataRange = userSheet.getRange('A14:F' + (currentSummaryStartRow - 1));
        userDataRange.clear();
      }

      // Delete extra rows between row 67 and current summary start
      const extraRows = currentSummaryStartRow - originalSummaryStartRow;
      if (extraRows > 0) {
        Logger.log('Deleting ' + extraRows + ' extra rows to restore original structure');
        userSheet.deleteRows(originalSummaryStartRow, extraRows);
      }
    } else {
      // Sheet not expanded - just clear data rows 14-66
      const userDataRange = userSheet.getRange('A14:F66');
      userDataRange.clear();
    }

    // Step 2: Restore DATA section formatting from master (A14:F66)
    const masterDataRange = masterSheet.getRange('A14:F66');
    const masterBackgrounds = masterDataRange.getBackgrounds();
    const masterFontColors = masterDataRange.getFontColors();
    const masterFontFamilies = masterDataRange.getFontFamilies();
    const masterFontSizes = masterDataRange.getFontSizes();
    const masterFontWeights = masterDataRange.getFontWeights();
    const masterHorizontalAlignments = masterDataRange.getHorizontalAlignments();
    const masterVerticalAlignments = masterDataRange.getVerticalAlignments();
    const masterNumberFormats = masterDataRange.getNumberFormats();

    // Apply all formatting to user sheet data section
    const userDataRange = userSheet.getRange('A14:F66');
    userDataRange.setBackgrounds(masterBackgrounds);
    userDataRange.setFontColors(masterFontColors);
    userDataRange.setFontFamilies(masterFontFamilies);
    userDataRange.setFontSizes(masterFontSizes);
    userDataRange.setFontWeights(masterFontWeights);
    userDataRange.setHorizontalAlignments(masterHorizontalAlignments);
    userDataRange.setVerticalAlignments(masterVerticalAlignments);
    userDataRange.setNumberFormats(masterNumberFormats);

    // Apply borders to data section
    userDataRange.setBorder(true, true, true, true, true, true);

    // Merge vendor cells (C14:D66) to match template
    for (let row = 14; row <= 66; row++) {
      const vendorCellRange = userSheet.getRange(row, 3, 1, 2);
      vendorCellRange.merge();
    }

    // Step 3: Restore SUMMARY section from master (A67:F83)
    Logger.log('Restoring summary section (rows 67-83) from master template...');

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

    // Clear the summary area first
    userSummaryRange.clear();

    // Apply formulas and values
    for (let i = 0; i < summaryFormulas.length; i++) {
      for (let j = 0; j < summaryFormulas[i].length; j++) {
        if (summaryFormulas[i][j]) {
          // Has formula - copy it as is
          userSummaryRange.getCell(i + 1, j + 1).setFormula(summaryFormulas[i][j]);
        } else if (summaryValues[i][j]) {
          // No formula, just value
          userSummaryRange.getCell(i + 1, j + 1).setValue(summaryValues[i][j]);
        }
      }
    }

    // Apply all formatting to summary section
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

    // Apply borders to summary section
    userSummaryRange.setBorder(true, true, true, true, true, true);

    Logger.log('Sheet reset completed - data cleared, formatting and summary section restored from master');

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
