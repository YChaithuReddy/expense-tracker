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
   * HTTP GET handler - handles actions via URL parameters
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
 * Also appends to permanent "By Project" ledger tab
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
    const DATA_START_ROW = 14;
    const SUMMARY_ROW_COUNT = 17;

    // Find the last row with actual expense data
    const lastRow = sheet.getLastRow();
    let lastDataRow = DATA_START_ROW - 1;

    if (lastRow >= DATA_START_ROW) {
      const dateColumn = sheet.getRange(DATA_START_ROW, 2, lastRow - DATA_START_ROW + 1, 1).getValues();

      for (let i = 0; i < dateColumn.length; i++) {
        const cellValue = dateColumn[i][0];
        if (cellValue && cellValue !== '') {
          lastDataRow = DATA_START_ROW + i;
        } else {
          break;
        }
      }
      Logger.log('Last data row found: ' + lastDataRow);
    }

    const nextRow = lastDataRow + 1;
    Logger.log('Appending new expenses starting at row: ' + nextRow);

    // Clear old summary section
    if (lastRow >= nextRow) {
      Logger.log('Clearing old summary section from row ' + nextRow + ' onwards');
      const clearRange = sheet.getRange(nextRow, 1, lastRow - nextRow + 1, 6);
      try {
        const mergedRanges = clearRange.getMergedRanges();
        for (let i = 0; i < mergedRanges.length; i++) {
          mergedRanges[i].breakApart();
        }
      } catch (e) {
        Logger.log('No merged cells to unmerge: ' + e);
      }
      clearRange.clear();
    }

    // Prepare data arrays
    const serialNumbers = [];
    const dates = [];
    const vendors = [];
    const categories = [];
    const costs = [];

    expenses.forEach((expense, index) => {
      serialNumbers.push([nextRow + index - 13]);
      const date = new Date(expense.date);
      const formattedDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
      dates.push([formattedDate]);
      vendors.push([expense.vendor || 'Unknown Vendor']);
      categories.push([expense.category || 'Miscellaneous']);
      costs.push([parseFloat(expense.amount) || 0]);
    });

    const numExpenses = expenses.length;

    // Get reference formatting from row 14
    const templateRange = sheet.getRange('A14:F14');
    const templateBackgrounds = templateRange.getBackgrounds();
    const templateFontColors = templateRange.getFontColors();
    const templateFontFamilies = templateRange.getFontFamilies();
    const templateFontSizes = templateRange.getFontSizes();
    const templateFontWeights = templateRange.getFontWeights();
    const templateHorizontalAlignments = templateRange.getHorizontalAlignments();
    const templateVerticalAlignments = templateRange.getVerticalAlignments();
    const templateNumberFormats = templateRange.getNumberFormats();

    // Apply formatting to all data rows
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
      targetRow.setBorder(true, true, true, true, true, true);
    }

    // Set data values
    sheet.getRange(nextRow, 1, numExpenses, 1).setValues(serialNumbers);
    sheet.getRange(nextRow, 2, numExpenses, 1).setValues(dates);
    sheet.getRange(nextRow, 3, numExpenses, 1).setValues(vendors);
    sheet.getRange(nextRow, 5, numExpenses, 1).setValues(categories);
    sheet.getRange(nextRow, 6, numExpenses, 1).setValues(costs);

    // Format date column
    sheet.getRange(nextRow, 2, numExpenses, 1).setNumberFormat('dd-mmm-yyyy');

    // Merge vendor cells (C and D)
    for (let i = 0; i < numExpenses; i++) {
      sheet.getRange(nextRow + i, 3, 1, 2).merge();
    }

    // Position summary section
    const dataEndRow = nextRow + numExpenses - 1;
    const summaryStartRow = dataEndRow + 1;

    Logger.log('Data ends at row ' + dataEndRow + ', summary at row ' + summaryStartRow);

    // Copy summary from master template
    const masterSpreadsheet = SpreadsheetApp.openById(MASTER_TEMPLATE_ID);
    const masterSheet = masterSpreadsheet.getSheetByName(TAB_NAME);

    if (masterSheet) {
      const currentLastRow = sheet.getLastRow();
      if (currentLastRow > dataEndRow) {
        sheet.getRange(dataEndRow + 1, 1, currentLastRow - dataEndRow, 6).clear();
      }

      const masterSummaryRange = masterSheet.getRange('A67:F83');
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

      const userSummaryRange = sheet.getRange(summaryStartRow, 1, SUMMARY_ROW_COUNT, 6);
      const MASTER_SUMMARY_START_ROW = 67;
      const rowOffset = summaryStartRow - MASTER_SUMMARY_START_ROW;

      for (let i = 0; i < summaryFormulas.length; i++) {
        for (let j = 0; j < summaryFormulas[i].length; j++) {
          if (summaryFormulas[i][j]) {
            let formula = summaryFormulas[i][j];
            if (formula.includes('=SUM(F14:F66)')) {
              formula = '=SUM(F14:F' + dataEndRow + ')';
            }
            if (rowOffset !== 0) {
              formula = formula.replace(/([A-Z]+)(\d+)/g, function(match, col, row) {
                const rowNum = parseInt(row);
                if (rowNum >= MASTER_SUMMARY_START_ROW && rowNum <= 83) {
                  return col + (rowNum + rowOffset);
                }
                return match;
              });
            }
            userSummaryRange.getCell(i + 1, j + 1).setFormula(formula);
          } else if (summaryValues[i][j]) {
            userSummaryRange.getCell(i + 1, j + 1).setValue(summaryValues[i][j]);
          }
        }
      }

      userSummaryRange.setBackgrounds(summaryBackgrounds);
      userSummaryRange.setFontColors(summaryFontColors);
      userSummaryRange.setFontFamilies(summaryFontFamilies);
      userSummaryRange.setFontSizes(summaryFontSizes);
      userSummaryRange.setFontWeights(summaryFontWeights);
      userSummaryRange.setHorizontalAlignments(summaryHorizontalAlignments);
      userSummaryRange.setVerticalAlignments(summaryVerticalAlignments);
      userSummaryRange.setNumberFormats(summaryNumberFormats);

      const masterMergedRanges = masterSummaryRange.getMergedRanges();
      for (let i = 0; i < masterMergedRanges.length; i++) {
        const mergedRange = masterMergedRanges[i];
        const mrOffset = mergedRange.getRow() - 67;
        const numRows = mergedRange.getNumRows();
        const numCols = mergedRange.getNumColumns();
        const col = mergedRange.getColumn();
        sheet.getRange(summaryStartRow + mrOffset, col, numRows, numCols).merge();
      }

      Logger.log('Summary section copied to row ' + summaryStartRow);
    }

    Logger.log('Export completed successfully');

    // ===== NEW: Append to permanent "By Project" ledger tab =====
    try {
      appendToProjectSheet(spreadsheet, expenses);
      Logger.log('✅ Project sheet updated successfully');
    } catch (projectError) {
      Logger.log('⚠️ Failed to update project sheet (non-fatal): ' + projectError.toString());
    }

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

// ===================================================================
// "BY PROJECT" PERMANENT LEDGER — never cleared on reset
// ===================================================================

/**
 * Append expenses to the permanent "By Project" tab
 * Groups by vendor, appends to existing sections, creates new sections for new projects
 * Skips duplicates (same date + amount + description)
 */
function appendToProjectSheet(spreadsheet, expenses) {
  const PROJECT_TAB = 'By Project';
  const MARKER_COL = 6; // Column F used for markers (hidden)

  var sheet = spreadsheet.getSheetByName(PROJECT_TAB);

  // Create tab if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet(PROJECT_TAB);
    sheet.getRange(1, 1).setValue('Project-wise Expense Ledger').setFontSize(14).setFontWeight('bold');
    sheet.getRange(1, 4).setValue('Last Updated: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy'));
    sheet.getRange(3, 1).setValue('GRAND TOTAL').setFontWeight('bold').setFontSize(12);
    sheet.getRange(3, 3).setValue(0).setNumberFormat('₹#,##0.00').setFontWeight('bold').setFontSize(12);
    sheet.getRange(3, MARKER_COL).setValue('GRAND_TOTAL');
    sheet.setColumnWidth(1, 110);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 280);
    sheet.hideColumns(MARKER_COL);
    Logger.log('Created new "By Project" tab');
  }

  // Group expenses by vendor
  var grouped = {};
  expenses.forEach(function(exp) {
    var key = exp.vendor || 'Uncategorized';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(exp);
  });

  var projects = Object.keys(grouped).sort();

  for (var p = 0; p < projects.length; p++) {
    var project = projects[p];
    var items = grouped[project];

    // Re-read data each iteration (rows may have shifted)
    var allData = sheet.getDataRange().getValues();
    var allMarkers = [];
    for (var r = 0; r < allData.length; r++) {
      allMarkers.push(allData[r].length >= MARKER_COL ? String(allData[r][MARKER_COL - 1]) : '');
    }

    // Find this project's header row
    var headerRow = -1;
    for (var r = 0; r < allMarkers.length; r++) {
      if (allMarkers[r] === 'PROJECT:' + project) {
        headerRow = r + 1; // 1-indexed
        break;
      }
    }

    if (headerRow > 0) {
      // === Section exists — find subtotal and append before it ===
      var subtotalRow = -1;
      for (var r = headerRow; r < allMarkers.length; r++) {
        if (allMarkers[r] === 'SUBTOTAL:' + project) {
          subtotalRow = r + 1;
          break;
        }
      }

      if (subtotalRow > 0) {
        // Read existing rows to check for duplicates
        var existingRows = [];
        for (var r = headerRow + 1; r < subtotalRow - 1; r++) {
          existingRows.push({
            date: String(allData[r][0]),
            amount: Number(allData[r][2]),
            description: String(allData[r][3])
          });
        }

        // Filter out duplicates
        var newItems = [];
        for (var i = 0; i < items.length; i++) {
          var exp = items[i];
          var fDate = formatDateSafe(exp.date);
          var isDuplicate = false;
          for (var e = 0; e < existingRows.length; e++) {
            if (existingRows[e].date === fDate &&
                existingRows[e].amount === (parseFloat(exp.amount) || 0) &&
                existingRows[e].description === (exp.description || '')) {
              isDuplicate = true;
              break;
            }
          }
          if (!isDuplicate) newItems.push(exp);
        }

        if (newItems.length > 0) {
          sheet.insertRowsBefore(subtotalRow, newItems.length);
          for (var i = 0; i < newItems.length; i++) {
            var row = subtotalRow + i;
            var exp = newItems[i];
            sheet.getRange(row, 1).setValue(formatDateSafe(exp.date));
            sheet.getRange(row, 2).setValue(exp.category || 'Miscellaneous');
            sheet.getRange(row, 3).setValue(parseFloat(exp.amount) || 0).setNumberFormat('₹#,##0.00');
            sheet.getRange(row, 4).setValue(exp.description || '');
          }
          // Update subtotal
          var newSubtotalRow = subtotalRow + newItems.length;
          updateProjectSubtotal(sheet, headerRow, newSubtotalRow, MARKER_COL);
        }
      }
    } else {
      // === New project — insert section before grand total ===
      var grandTotalRow = -1;
      for (var r = 0; r < allMarkers.length; r++) {
        if (allMarkers[r] === 'GRAND_TOTAL') {
          grandTotalRow = r + 1;
          break;
        }
      }
      if (grandTotalRow < 0) grandTotalRow = sheet.getLastRow() + 1;

      var rowsNeeded = items.length + 4; // header + col header + items + subtotal + blank
      sheet.insertRowsBefore(grandTotalRow, rowsNeeded);
      var currentRow = grandTotalRow;

      // Project header
      sheet.getRange(currentRow, 1).setValue('▸ ' + project).setFontWeight('bold').setFontSize(11);
      sheet.getRange(currentRow, 1, 1, 4).setBackground('#0e7490').setFontColor('#ffffff');
      sheet.getRange(currentRow, MARKER_COL).setValue('PROJECT:' + project);
      currentRow++;

      // Column headers
      sheet.getRange(currentRow, 1, 1, 4).setValues([['Date', 'Category', 'Amount', 'Description']]);
      sheet.getRange(currentRow, 1, 1, 4).setFontWeight('bold').setFontColor('#64748b').setFontSize(9);
      currentRow++;

      // Expense rows
      for (var i = 0; i < items.length; i++) {
        var exp = items[i];
        sheet.getRange(currentRow, 1).setValue(formatDateSafe(exp.date));
        sheet.getRange(currentRow, 2).setValue(exp.category || 'Miscellaneous');
        sheet.getRange(currentRow, 3).setValue(parseFloat(exp.amount) || 0).setNumberFormat('₹#,##0.00');
        sheet.getRange(currentRow, 4).setValue(exp.description || '');
        currentRow++;
      }

      // Subtotal row
      var subtotalAmount = items.reduce(function(sum, exp) { return sum + (parseFloat(exp.amount) || 0); }, 0);
      sheet.getRange(currentRow, 1).setValue('Subtotal').setFontWeight('bold');
      sheet.getRange(currentRow, 3).setValue(subtotalAmount).setNumberFormat('₹#,##0.00').setFontWeight('bold');
      sheet.getRange(currentRow, MARKER_COL).setValue('SUBTOTAL:' + project);
    }
  }

  // Update grand total and timestamp
  updateGrandTotal(sheet, MARKER_COL);
  sheet.getRange(1, 4).setValue('Last Updated: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy HH:mm'));
}

/** Format date safely */
function formatDateSafe(dateStr) {
  try {
    var d = new Date(dateStr);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
  } catch(e) {
    return dateStr || '';
  }
}

/** Recalculate a project's subtotal */
function updateProjectSubtotal(sheet, headerRow, subtotalRow, markerCol) {
  var total = 0;
  for (var r = headerRow + 2; r < subtotalRow; r++) {
    total += (parseFloat(sheet.getRange(r, 3).getValue()) || 0);
  }
  sheet.getRange(subtotalRow, 3).setValue(total).setNumberFormat('₹#,##0.00').setFontWeight('bold');
}

/** Recalculate grand total from all subtotals */
function updateGrandTotal(sheet, markerCol) {
  var allData = sheet.getDataRange().getValues();
  var grandTotal = 0;
  var grandTotalRow = -1;

  for (var r = 0; r < allData.length; r++) {
    var marker = allData[r].length >= markerCol ? String(allData[r][markerCol - 1]) : '';
    if (marker.indexOf('SUBTOTAL:') === 0) {
      grandTotal += (parseFloat(allData[r][2]) || 0);
    }
    if (marker === 'GRAND_TOTAL') {
      grandTotalRow = r + 1;
    }
  }

  if (grandTotalRow > 0) {
    sheet.getRange(grandTotalRow, 3).setValue(grandTotal).setNumberFormat('₹#,##0.00').setFontWeight('bold').setFontSize(12);
  }
}

// ===================================================================
// EXISTING FUNCTIONS (unchanged)
// ===================================================================

/**
 * Verify that a sheet exists and is accessible
 */
function verifySheetAccess(data) {
  try {
    const { sheetId } = data;
    if (!sheetId) return createResponse(false, 'Missing required field: sheetId');

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(TAB_NAME);
    if (!sheet) return createResponse(false, 'Tab "' + TAB_NAME + '" not found');

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
 * NOTE: Does NOT clear the "By Project" tab — that's permanent
 */
function resetSheetFromMaster(data) {
  try {
    const { sheetId } = data;
    if (!sheetId) return createResponse(false, 'Missing required field: sheetId');

    Logger.log('Resetting sheet from master template: ' + sheetId);

    const userSpreadsheet = SpreadsheetApp.openById(sheetId);
    const userSheet = userSpreadsheet.getSheetByName(TAB_NAME);
    if (!userSheet) return createResponse(false, 'Tab "' + TAB_NAME + '" not found in user sheet');

    const masterSpreadsheet = SpreadsheetApp.openById(MASTER_TEMPLATE_ID);
    const masterSheet = masterSpreadsheet.getSheetByName(TAB_NAME);
    if (!masterSheet) return createResponse(false, 'Tab "' + TAB_NAME + '" not found in master template');

    // Step 1: Clear everything from row 14 onwards
    const lastRow = userSheet.getLastRow();
    if (lastRow >= 14) {
      userSheet.getRange('A14:F' + lastRow).clear();
    }

    // Step 2: Restore DATA section (rows 14-66) with borders
    const masterDataRange = masterSheet.getRange('A14:F66');
    const userDataRange = userSheet.getRange('A14:F66');
    userDataRange.setBackgrounds(masterDataRange.getBackgrounds());
    userDataRange.setFontColors(masterDataRange.getFontColors());
    userDataRange.setFontFamilies(masterDataRange.getFontFamilies());
    userDataRange.setFontSizes(masterDataRange.getFontSizes());
    userDataRange.setFontWeights(masterDataRange.getFontWeights());
    userDataRange.setHorizontalAlignments(masterDataRange.getHorizontalAlignments());
    userDataRange.setVerticalAlignments(masterDataRange.getVerticalAlignments());
    userDataRange.setNumberFormats(masterDataRange.getNumberFormats());
    userDataRange.setBorder(true, true, true, true, true, true);

    for (let row = 14; row <= 66; row++) {
      userSheet.getRange(row, 3, 1, 2).merge();
    }

    // Step 3: Restore SUMMARY section (rows 67-83) WITHOUT borders
    const masterSummaryRange = masterSheet.getRange('A67:F83');
    const summaryValues = masterSummaryRange.getValues();
    const summaryFormulas = masterSummaryRange.getFormulas();
    const userSummaryRange = userSheet.getRange('A67:F83');

    for (let i = 0; i < summaryFormulas.length; i++) {
      for (let j = 0; j < summaryFormulas[i].length; j++) {
        if (summaryFormulas[i][j]) {
          userSummaryRange.getCell(i + 1, j + 1).setFormula(summaryFormulas[i][j]);
        } else if (summaryValues[i][j]) {
          userSummaryRange.getCell(i + 1, j + 1).setValue(summaryValues[i][j]);
        }
      }
    }

    userSummaryRange.setBackgrounds(masterSummaryRange.getBackgrounds());
    userSummaryRange.setFontColors(masterSummaryRange.getFontColors());
    userSummaryRange.setFontFamilies(masterSummaryRange.getFontFamilies());
    userSummaryRange.setFontSizes(masterSummaryRange.getFontSizes());
    userSummaryRange.setFontWeights(masterSummaryRange.getFontWeights());
    userSummaryRange.setHorizontalAlignments(masterSummaryRange.getHorizontalAlignments());
    userSummaryRange.setVerticalAlignments(masterSummaryRange.getVerticalAlignments());
    userSummaryRange.setNumberFormats(masterSummaryRange.getNumberFormats());

    const masterMergedRanges = masterSummaryRange.getMergedRanges();
    for (let i = 0; i < masterMergedRanges.length; i++) {
      const mergedRange = masterMergedRanges[i];
      const rowOffset = mergedRange.getRow() - 67;
      userSheet.getRange(67 + rowOffset, mergedRange.getColumn(), mergedRange.getNumRows(), mergedRange.getNumColumns()).merge();
    }

    // NOTE: "By Project" tab is NOT touched — it's a permanent ledger

    Logger.log('Sheet reset completed (By Project tab preserved)');

    return createResponse(true, 'Sheet reset successfully - all data cleared, template restored', {
      sheetId: sheetId,
      sheetName: userSpreadsheet.getName()
    });
  } catch (error) {
    Logger.log('Error resetting sheet: ' + error.toString());
    return createResponse(false, 'Failed to reset sheet: ' + error.toString());
  }
}

/**
 * Export sheet as PDF and return as base64
 */
function exportSheetAsPdf(data) {
  try {
    const { sheetId } = data;
    if (!sheetId) return createResponse(false, 'Missing required field: sheetId');

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(TAB_NAME);
    if (!sheet) return createResponse(false, 'Tab "' + TAB_NAME + '" not found');

    const url = 'https://docs.google.com/spreadsheets/d/' + sheetId + '/export?';
    const params = {
      format: 'pdf', size: 'A4', portrait: true, fitw: true, fith: true,
      scale: 4, sheetnames: false, printtitle: false, pagenumbers: false,
      gridlines: false, fzr: false, horizontal_alignment: 'CENTER',
      vertical_alignment: 'TOP', gid: sheet.getSheetId()
    };

    const queryString = Object.keys(params).map(function(key) {
      return key + '=' + params[key];
    }).join('&');

    const token = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(url + queryString, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    const pdfBlob = response.getBlob();
    const base64Pdf = Utilities.base64Encode(pdfBlob.getBytes());

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
 */
function updateEmployeeInformation(data) {
  try {
    const { sheetId, employeeData } = data;
    if (!sheetId) return createResponse(false, 'Missing sheetId');
    if (!employeeData) return createResponse(false, 'Missing employeeData');

    const sheet = SpreadsheetApp.openById(sheetId);
    const activeSheet = sheet.getActiveSheet();

    if (employeeData.employeeName) activeSheet.getRange('D4').setValue(employeeData.employeeName);
    if (employeeData.employeeCode) {
      activeSheet.getRange('D5').setValue(employeeData.employeeCode);
    } else {
      activeSheet.getRange('D5').setValue('');
    }

    if (employeeData.expensePeriodFrom) {
      const fromDate = new Date(employeeData.expensePeriodFrom);
      activeSheet.getRange('F5').setValue(Utilities.formatDate(fromDate, Session.getScriptTimeZone(), 'dd-MMM-yyyy')).setNumberFormat('dd-mmm-yyyy');
    }
    if (employeeData.expensePeriodTo) {
      const toDate = new Date(employeeData.expensePeriodTo);
      activeSheet.getRange('F6').setValue(Utilities.formatDate(toDate, Session.getScriptTimeZone(), 'dd-MMM-yyyy')).setNumberFormat('dd-mmm-yyyy');
    }
    if (employeeData.businessPurpose) activeSheet.getRange('D9').setValue(employeeData.businessPurpose);

    return createResponse(true, 'Employee information updated successfully');
  } catch (error) {
    Logger.log('Error updating employee info: ' + error.toString());
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
  if (data) response.data = data;
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
