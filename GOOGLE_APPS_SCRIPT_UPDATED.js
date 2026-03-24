/**
 * Google Apps Script for Expense Tracker Auto-Copy Template
 *
 * This script handles:
 * 1. Creating a new copy of the master template for each user
 * 2. Sharing the copy with the user's email
 * 3. Accepting data exports from the backend
 * 4. Maintaining a permanent "By Project" ledger tab
 *
 * Deploy this as a Web App with "Execute as: Me" and "Access: Anyone"
 */

const MASTER_TEMPLATE_ID = '1dcq8HKP1j4NocCMgAY9YSXlwCrzHwIiRCd0t4mun25E';
const TAB_NAME = 'ExpenseReport';

/**
 * HTTP GET handler - handles actions via URL parameters from frontend
 */
function doGet(e) {
  try {
    Logger.log('doGet called with: ' + JSON.stringify(e));

    // Check for data in different ways
    let data = null;

    if (e && e.parameter && e.parameter.data) {
      Logger.log('Found data in e.parameter.data');
      data = JSON.parse(e.parameter.data);
    } else if (e && e.parameters && e.parameters.data) {
      Logger.log('Found data in e.parameters.data');
      data = JSON.parse(e.parameters.data[0]);
    } else if (e && e.queryString) {
      Logger.log('Trying to parse queryString: ' + e.queryString);
      const params = new URLSearchParams(e.queryString);
      if (params.has('data')) {
        data = JSON.parse(params.get('data'));
      }
    }

    if (data && data.action) {
      Logger.log('Action: ' + data.action);

      switch (data.action) {
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
        case 'updateEmployeeInfo':
          return updateEmployeeInformation(data);
        default:
          return createResponse(false, 'Unknown action: ' + data.action);
      }
    }

    // Default response if no data parameter
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Expense Tracker Google Apps Script is running',
      version: '3.0 — with By Project ledger',
      receivedParams: e ? JSON.stringify(e.parameter) : 'none'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return createResponse(false, 'Server error: ' + error.toString());
  }
}

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
 * Test function to trigger authorization
 * Run this once to grant permissions
 */
function authorizeScript() {
  try {
    const testUrl = 'https://www.google.com';
    const response = UrlFetchApp.fetch(testUrl);
    Logger.log('Authorization successful! Status: ' + response.getResponseCode());
  } catch (e) {
    Logger.log('Error (but authorization should still work): ' + e.toString());
  }
}

/**
 * Export expenses to an existing sheet
 * Data section is dynamic - always starts at row 14
 * Summary section (17 rows) always follows data immediately
 * Also updates the permanent "By Project" ledger tab
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

    // Find the last row with actual expense data (check column B for dates)
    // Summary section has text like "SUBTOTAL" in column E, not dates in column B
    const lastRow = sheet.getLastRow();
    let lastDataRow = DATA_START_ROW - 1; // Start before first data row

    if (lastRow >= DATA_START_ROW) {
      // Check each row for date data in column B
      const dateColumn = sheet.getRange(DATA_START_ROW, 2, lastRow - DATA_START_ROW + 1, 1).getValues();

      for (let i = 0; i < dateColumn.length; i++) {
        const cellValue = dateColumn[i][0];
        // If cell has a date or any value (not empty), it's data
        if (cellValue && cellValue !== '') {
          lastDataRow = DATA_START_ROW + i;
        } else {
          // Hit empty row, stop searching
          break;
        }
      }

      Logger.log('Last data row found: ' + lastDataRow);
    }

    // Next row to insert data is after the last data row
    const nextRow = lastDataRow + 1;
    Logger.log('Appending new expenses starting at row: ' + nextRow);

    // If there's existing data beyond nextRow (like summary), clear it
    // We'll re-add the summary after the new data
    if (lastRow >= nextRow) {
      Logger.log('Clearing old summary section from row ' + nextRow + ' onwards');
      const clearRange = sheet.getRange(nextRow, 1, lastRow - nextRow + 1, 6);

      // Unmerge any cells in this range to prevent conflicts
      try {
        const mergedRanges = clearRange.getMergedRanges();
        for (let i = 0; i < mergedRanges.length; i++) {
          mergedRanges[i].breakApart();
        }
        Logger.log('Unmerged ' + mergedRanges.length + ' ranges in summary area');
      } catch (e) {
        Logger.log('No merged cells to unmerge: ' + e);
      }

      clearRange.clear();
    }

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

    // Explicitly format date column (B) to display as "10-Sep-2025" format
    const dateRange = sheet.getRange(nextRow, 2, numExpenses, 1);
    dateRange.setNumberFormat('dd-mmm-yyyy');

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
      const MASTER_SUMMARY_START_ROW = 67; // Master template summary starts at row 67
      const rowOffset = summaryStartRow - MASTER_SUMMARY_START_ROW;

      for (let i = 0; i < summaryFormulas.length; i++) {
        for (let j = 0; j < summaryFormulas[i].length; j++) {
          if (summaryFormulas[i][j]) {
            // Has formula - update row references
            let formula = summaryFormulas[i][j];

            // Update SUBTOTAL formula to reference actual data range (14 to dataEndRow)
            if (formula.includes('=SUM(F14:F66)')) {
              formula = '=SUM(F14:F' + dataEndRow + ')';
            }

            // Update all other cell references to match new summary position
            // This handles formulas like =F67-F68, =F69*F70, etc.
            // Replace row numbers 67-83 (master summary range) with new row numbers
            if (rowOffset !== 0) {
              // Use regex to find and replace row numbers in cell references
              formula = formula.replace(/([A-Z]+)(\d+)/g, function(match, col, row) {
                const rowNum = parseInt(row);
                // Only update rows in the summary section range (67-83)
                if (rowNum >= MASTER_SUMMARY_START_ROW && rowNum <= 83) {
                  return col + (rowNum + rowOffset);
                }
                return match; // Keep other row references unchanged
              });
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

    // =====================================================================
    // INLINED: Append to permanent "By Project" ledger tab
    // Uses sheetId and expenses variables directly from this function scope
    // =====================================================================
    try {
      var PROJECT_TAB = 'By Project';
      var MARKER_COL = 6;

      Logger.log('Starting project sheet update, sheetId=' + sheetId + ', count=' + expenses.length);

      var projSS = SpreadsheetApp.openById(sheetId);
      var projSheet = projSS.getSheetByName(PROJECT_TAB);

      if (!projSheet) {
        projSheet = projSS.insertSheet(PROJECT_TAB);
        projSheet.getRange(1, 1).setValue('Project-wise Expense Ledger').setFontSize(14).setFontWeight('bold').setFontColor('#0e7490');
        projSheet.getRange(1, 4).setValue('Last Updated: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy HH:mm')).setFontColor('#64748b').setFontSize(9);
        projSheet.getRange(3, 1).setValue('GRAND TOTAL').setFontWeight('bold').setFontSize(12).setFontColor('#0e7490');
        projSheet.getRange(3, 3).setValue(0).setNumberFormat('₹#,##0.00').setFontWeight('bold').setFontSize(12).setFontColor('#0e7490');
        projSheet.getRange(3, MARKER_COL).setValue('GRAND_TOTAL');
        projSheet.setColumnWidth(1, 110);
        projSheet.setColumnWidth(2, 160);
        projSheet.setColumnWidth(3, 130);
        projSheet.setColumnWidth(4, 300);
        projSheet.hideColumns(MARKER_COL);
        Logger.log('Created new "By Project" tab');
      }

      var grouped = {};
      for (var ei = 0; ei < expenses.length; ei++) {
        var ek = expenses[ei].vendor || 'Uncategorized';
        if (!grouped[ek]) grouped[ek] = [];
        grouped[ek].push(expenses[ei]);
      }

      var projects = Object.keys(grouped).sort();

      for (var pi = 0; pi < projects.length; pi++) {
        var project = projects[pi];
        var items = grouped[project];

        Logger.log('Processing project: ' + project + ' (' + items.length + ' expenses)');

        var allData = projSheet.getDataRange().getValues();
        var allMarkers = [];
        for (var ri = 0; ri < allData.length; ri++) {
          allMarkers.push(allData[ri].length >= MARKER_COL ? String(allData[ri][MARKER_COL - 1]) : '');
        }

        var headerRow = -1;
        for (var ri = 0; ri < allMarkers.length; ri++) {
          if (allMarkers[ri] === 'PROJECT:' + project) { headerRow = ri + 1; break; }
        }

        if (headerRow > 0) {
          var subtotalRow = -1;
          for (var ri = headerRow; ri < allMarkers.length; ri++) {
            if (allMarkers[ri] === 'SUBTOTAL:' + project) { subtotalRow = ri + 1; break; }
          }

          if (subtotalRow > 0) {
            var existingRows = [];
            for (var ri = headerRow + 1; ri < subtotalRow - 1; ri++) {
              existingRows.push({ date: String(allData[ri][0]), amount: Number(allData[ri][2]), description: String(allData[ri][3]) });
            }

            var newItems = [];
            for (var ii = 0; ii < items.length; ii++) {
              var fDate = '';
              try { fDate = Utilities.formatDate(new Date(items[ii].date), Session.getScriptTimeZone(), 'dd-MMM-yyyy'); } catch(de) { fDate = items[ii].date || ''; }
              var fAmt = parseFloat(items[ii].amount) || 0;
              var fDesc = items[ii].description || '';
              var isDup = false;
              for (var ei2 = 0; ei2 < existingRows.length; ei2++) {
                if (existingRows[ei2].date === fDate && existingRows[ei2].amount === fAmt && existingRows[ei2].description === fDesc) { isDup = true; break; }
              }
              if (!isDup) newItems.push(items[ii]);
            }

            if (newItems.length > 0) {
              projSheet.insertRowsBefore(subtotalRow, newItems.length);
              for (var ii = 0; ii < newItems.length; ii++) {
                var rw = subtotalRow + ii;
                var fd2 = '';
                try { fd2 = Utilities.formatDate(new Date(newItems[ii].date), Session.getScriptTimeZone(), 'dd-MMM-yyyy'); } catch(de) { fd2 = newItems[ii].date || ''; }
                projSheet.getRange(rw, 1).setValue(fd2);
                projSheet.getRange(rw, 2).setValue(newItems[ii].category || 'Miscellaneous');
                projSheet.getRange(rw, 3).setValue(parseFloat(newItems[ii].amount) || 0).setNumberFormat('₹#,##0.00');
                projSheet.getRange(rw, 4).setValue(newItems[ii].description || '');
              }
              var newSubRow = subtotalRow + newItems.length;
              var subTotal = 0;
              for (var ri = headerRow + 2; ri < newSubRow; ri++) {
                subTotal += (parseFloat(projSheet.getRange(ri, 3).getValue()) || 0);
              }
              projSheet.getRange(newSubRow, 3).setValue(subTotal).setNumberFormat('₹#,##0.00').setFontWeight('bold').setFontColor('#0e7490');
            }
          }
        } else {
          var grandTotalRow = -1;
          for (var ri = 0; ri < allMarkers.length; ri++) {
            if (allMarkers[ri] === 'GRAND_TOTAL') { grandTotalRow = ri + 1; break; }
          }
          if (grandTotalRow < 0) grandTotalRow = projSheet.getLastRow() + 1;

          var rowsNeeded = items.length + 4;
          projSheet.insertRowsBefore(grandTotalRow, rowsNeeded);
          var cr = grandTotalRow;

          projSheet.getRange(cr, 1).setValue('▸ ' + project).setFontWeight('bold').setFontSize(11);
          projSheet.getRange(cr, 1, 1, 4).setBackground('#0e7490').setFontColor('#ffffff');
          projSheet.getRange(cr, MARKER_COL).setValue('PROJECT:' + project);
          cr++;

          projSheet.getRange(cr, 1, 1, 4).setValues([['Date', 'Category', 'Amount', 'Description']]);
          projSheet.getRange(cr, 1, 1, 4).setFontWeight('bold').setFontColor('#64748b').setFontSize(9).setBackground('#f1f5f9');
          cr++;

          var subAmt = 0;
          for (var ii = 0; ii < items.length; ii++) {
            var fd3 = '';
            try { fd3 = Utilities.formatDate(new Date(items[ii].date), Session.getScriptTimeZone(), 'dd-MMM-yyyy'); } catch(de) { fd3 = items[ii].date || ''; }
            projSheet.getRange(cr, 1).setValue(fd3);
            projSheet.getRange(cr, 2).setValue(items[ii].category || 'Miscellaneous');
            projSheet.getRange(cr, 3).setValue(parseFloat(items[ii].amount) || 0).setNumberFormat('₹#,##0.00');
            projSheet.getRange(cr, 4).setValue(items[ii].description || '');
            if (ii % 2 === 1) projSheet.getRange(cr, 1, 1, 4).setBackground('#f8fafc');
            subAmt += (parseFloat(items[ii].amount) || 0);
            cr++;
          }

          projSheet.getRange(cr, 1).setValue('Subtotal').setFontWeight('bold').setFontColor('#0e7490');
          projSheet.getRange(cr, 3).setValue(subAmt).setNumberFormat('₹#,##0.00').setFontWeight('bold').setFontColor('#0e7490');
          projSheet.getRange(cr, MARKER_COL).setValue('SUBTOTAL:' + project);
        }
      }

      var gtData = projSheet.getDataRange().getValues();
      var gtTotal = 0;
      var gtRow = -1;
      for (var ri = 0; ri < gtData.length; ri++) {
        var mk = gtData[ri].length >= MARKER_COL ? String(gtData[ri][MARKER_COL - 1]) : '';
        if (mk.indexOf('SUBTOTAL:') === 0) gtTotal += (parseFloat(gtData[ri][2]) || 0);
        if (mk === 'GRAND_TOTAL') gtRow = ri + 1;
      }
      if (gtRow > 0) {
        projSheet.getRange(gtRow, 3).setValue(gtTotal).setNumberFormat('₹#,##0.00').setFontWeight('bold').setFontSize(12).setFontColor('#0e7490');
      }

      projSheet.getRange(1, 4).setValue('Last Updated: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy HH:mm')).setFontColor('#64748b').setFontSize(9);

      Logger.log('✅ Project ledger updated successfully');
    } catch (projectError) {
      Logger.log('⚠️ Failed to update project sheet: ' + projectError.toString());
      Logger.log('⚠️ Stack: ' + (projectError.stack || 'no stack'));
    }
    // =====================================================================
    // END: Project sheet logic
    // =====================================================================

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
 * NOTE: "By Project" tab is NOT touched — it's a permanent ledger
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
    // NOTE: "By Project" tab is NOT cleared — it's a permanent ledger

    Logger.log('Sheet reset completed:');
    Logger.log('- Data section (rows 14-66): Formatted with borders');
    Logger.log('- Summary section (rows 67-83): Formatted without borders');
    Logger.log('- By Project tab: Preserved (permanent ledger)');

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
 * Update employee information in Google Sheet
 * Updates specific cells: D4 (Employee Name), D5 (Employee Code), F5 (From Date), F6 (To Date), D9:E11 (Business Purpose)
 */
function updateEmployeeInformation(data) {
  try {
    const { sheetId, employeeData } = data;

    if (!sheetId) {
      return createResponse(false, 'Missing sheetId');
    }

    if (!employeeData) {
      return createResponse(false, 'Missing employeeData');
    }

    Logger.log('Updating employee info in sheet: ' + sheetId);

    // Open the user's sheet
    const sheet = SpreadsheetApp.openById(sheetId);
    const activeSheet = sheet.getActiveSheet();

    // Update Employee Name (Cell D4)
    if (employeeData.employeeName) {
      activeSheet.getRange('D4').setValue(employeeData.employeeName);
      Logger.log('✅ Updated D4 (Employee Name): ' + employeeData.employeeName);
    }

    // Update Employee Code (Cell D5) - Optional
    if (employeeData.employeeCode) {
      activeSheet.getRange('D5').setValue(employeeData.employeeCode);
      Logger.log('✅ Updated D5 (Employee Code): ' + employeeData.employeeCode);
    } else {
      activeSheet.getRange('D5').setValue(''); // Clear if not provided
      Logger.log('✅ Cleared D5 (Employee Code)');
    }

    // Update Expense Period From (Cell F5) - Format as dd-mmm-yyyy
    if (employeeData.expensePeriodFrom) {
      const fromDate = new Date(employeeData.expensePeriodFrom);
      const formattedFromDate = Utilities.formatDate(fromDate, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
      const cellF5 = activeSheet.getRange('F5');
      cellF5.setValue(formattedFromDate);
      cellF5.setNumberFormat('dd-mmm-yyyy');
      Logger.log('✅ Updated F5 (From Date): ' + formattedFromDate);
    }

    // Update Expense Period To (Cell F6) - Format as dd-mmm-yyyy
    if (employeeData.expensePeriodTo) {
      const toDate = new Date(employeeData.expensePeriodTo);
      const formattedToDate = Utilities.formatDate(toDate, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
      const cellF6 = activeSheet.getRange('F6');
      cellF6.setValue(formattedToDate);
      cellF6.setNumberFormat('dd-mmm-yyyy');
      Logger.log('✅ Updated F6 (To Date): ' + formattedToDate);
    }

    // Update Business Purpose (Cells D9:E11 merged range)
    if (employeeData.businessPurpose) {
      // Set the value in the top-left cell of the merged range (D9)
      activeSheet.getRange('D9').setValue(employeeData.businessPurpose);
      Logger.log('✅ Updated D9:E11 (Business Purpose): ' + employeeData.businessPurpose);
    }

    Logger.log('✅ Employee information updated successfully');

    return createResponse(true, 'Employee information updated successfully');

  } catch (error) {
    Logger.log('❌ Error updating employee info: ' + error.toString());
    return createResponse(false, 'Failed to update employee information: ' + error.toString());
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
