/**
 * Simplified reset function if BorderStyle enum is causing issues
 * Replace the resetSheetFromMaster function in your Apps Script with this version
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

    // Step 1: Clear all content from user sheet (keep formatting)
    userDataRange.clearContent();

    // Step 2: Copy ALL formatting from master template
    masterDataRange.copyTo(userDataRange, {formatOnly: true});

    // Step 3: Apply borders using simple method (without BorderStyle enum)
    userDataRange.setBorder(
      true,  // top
      true,  // left
      true,  // bottom
      true,  // right
      true,  // vertical
      true   // horizontal
    );

    // Also ensure header has borders
    const headerRange = userSheet.getRange('A13:F13');
    headerRange.setBorder(true, true, true, true, false, false);

    Logger.log('Sheet reset completed - data cleared, borders applied');

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