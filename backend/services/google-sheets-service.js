const axios = require('axios');

/**
 * Google Sheets Service (Using Google Apps Script)
 *
 * This service calls a Google Apps Script web app that handles:
 * - Copying the master template for new users
 * - Sharing sheets with user emails
 * - Writing expense data to the sheets
 *
 * Much simpler and more reliable than Service Account authentication!
 */

class GoogleSheetsService {
    constructor() {
        // Google Apps Script Web App URL (set via environment variable)
        this.appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

        if (!this.appsScriptUrl) {
            console.warn('⚠️  GOOGLE_APPS_SCRIPT_URL not found in environment variables');
            console.warn('⚠️  Google Sheets functionality will not work until the Apps Script is deployed');
            console.warn('⚠️  See GOOGLE_APPS_SCRIPT_SETUP.md for instructions');
        } else {
            console.log('✅ Google Sheets Service initialized successfully (using Apps Script)');
        }
    }

    /**
     * Check if service is ready
     */
    isReady() {
        return this.appsScriptUrl !== null && this.appsScriptUrl !== undefined;
    }

    /**
     * Create a personal copy of the master template for a user
     * @param {String} userId - MongoDB user ID
     * @param {String} userEmail - User's email address
     * @param {String} userName - User's full name
     * @returns {Object} - Sheet ID and URL
     */
    async createSheetForUser(userId, userEmail, userName) {
        try {
            if (!this.isReady()) {
                throw new Error('Google Apps Script URL not configured. Please set GOOGLE_APPS_SCRIPT_URL in environment variables.');
            }

            console.log(`📋 Creating Google Sheet for user: ${userName} (${userEmail})`);

            // Call Google Apps Script to create sheet
            const response = await axios.post(this.appsScriptUrl, {
                action: 'createSheet',
                userId: userId,
                userEmail: userEmail,
                userName: userName
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });

            if (response.data.status === 'success') {
                console.log(`✅ Sheet created successfully: ${response.data.data.sheetId}`);
                return {
                    success: true,
                    sheetId: response.data.data.sheetId,
                    sheetUrl: response.data.data.sheetUrl,
                    sheetName: response.data.data.sheetName,
                    message: response.data.message
                };
            } else {
                throw new Error(response.data.message || 'Failed to create sheet');
            }

        } catch (error) {
            console.error('❌ Error creating sheet for user:', error.message);

            // Check if it's a network/timeout error
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return {
                    success: false,
                    error: 'Request timeout - Google Apps Script may be initializing. Please try again.'
                };
            }

            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Export expenses to user's Google Sheet
     * @param {String} sheetId - User's sheet ID
     * @param {Array} expenses - Array of expense objects
     * @returns {Object} - Export result
     */
    async exportExpenses(sheetId, expenses) {
        try {
            if (!this.isReady()) {
                throw new Error('Google Apps Script URL not configured');
            }

            if (!sheetId) {
                throw new Error('No sheet ID provided. User may not have a sheet yet.');
            }

            if (!expenses || expenses.length === 0) {
                throw new Error('No expenses to export');
            }

            console.log(`📤 Exporting ${expenses.length} expenses to sheet: ${sheetId}`);

            // Call Google Apps Script to export expenses
            const response = await axios.post(this.appsScriptUrl, {
                action: 'exportExpenses',
                sheetId: sheetId,
                expenses: expenses.map(expense => ({
                    date: expense.date,
                    vendor: expense.vendor,
                    category: expense.category,
                    amount: expense.amount
                }))
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });

            if (response.data.status === 'success') {
                console.log(`✅ Export successful: ${response.data.data.exportedCount} expenses exported`);
                return {
                    success: true,
                    message: response.data.message,
                    exportedCount: response.data.data.exportedCount,
                    startRow: response.data.data.startRow,
                    endRow: response.data.data.endRow
                };
            } else {
                throw new Error(response.data.message || 'Failed to export expenses');
            }

        } catch (error) {
            console.error('❌ Error exporting expenses:', error.message);

            // Check if it's a network/timeout error
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return {
                    success: false,
                    error: 'Request timeout - Google Apps Script may be busy. Please try again.'
                };
            }

            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Get user's sheet URL
     * @param {String} sheetId - Sheet ID
     * @returns {String} - Sheet URL
     */
    getSheetUrl(sheetId) {
        return `https://docs.google.com/spreadsheets/d/${sheetId}`;
    }

    /**
     * Verify sheet exists and is accessible
     * @param {String} sheetId - Sheet ID
     * @returns {Object} - Verification result
     */
    async verifySheet(sheetId) {
        try {
            if (!this.isReady()) {
                throw new Error('Google Apps Script URL not configured');
            }

            console.log(`🔍 Verifying sheet access: ${sheetId}`);

            // Call Google Apps Script to verify sheet
            const response = await axios.post(this.appsScriptUrl, {
                action: 'verifySheet',
                sheetId: sheetId
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            });

            if (response.data.status === 'success') {
                console.log(`✅ Sheet verified: ${response.data.data.sheetName}`);
                return {
                    success: true,
                    sheetName: response.data.data.sheetName,
                    tabName: response.data.data.tabName
                };
            } else {
                throw new Error(response.data.message || 'Failed to verify sheet');
            }

        } catch (error) {
            console.error('❌ Error verifying sheet:', error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Export user's Google Sheet as PDF
     * @param {String} sheetId - User's sheet ID
     * @returns {Object} - PDF data in base64
     */
    async exportSheetAsPdf(sheetId) {
        try {
            if (!this.isReady()) {
                throw new Error('Google Apps Script URL not configured');
            }

            if (!sheetId) {
                throw new Error('No sheet ID provided');
            }

            console.log(`📄 Exporting sheet as PDF: ${sheetId}`);

            // Call Google Apps Script to export PDF
            const response = await axios.post(this.appsScriptUrl, {
                action: 'exportPdf',
                sheetId: sheetId
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });

            if (response.data.status === 'success') {
                console.log(`✅ PDF export successful: ${response.data.data.size} bytes`);
                return {
                    success: true,
                    pdfBase64: response.data.data.pdfBase64,
                    fileName: response.data.data.fileName,
                    size: response.data.data.size
                };
            } else {
                throw new Error(response.data.message || 'Failed to export PDF');
            }

        } catch (error) {
            console.error('❌ Error exporting PDF:', error.message);

            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return {
                    success: false,
                    error: 'Request timeout - Google Apps Script may be busy. Please try again.'
                };
            }

            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Reset user's Google Sheet to master template format
     * @param {String} sheetId - User's sheet ID
     * @returns {Object} - Reset result
     */
    async resetSheet(sheetId) {
        try {
            if (!this.isReady()) {
                throw new Error('Google Apps Script URL not configured');
            }

            if (!sheetId) {
                throw new Error('No sheet ID provided');
            }

            console.log(`🔄 Resetting sheet: ${sheetId}`);

            // Call Google Apps Script to reset sheet
            const response = await axios.post(this.appsScriptUrl, {
                action: 'resetSheet',
                sheetId: sheetId
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });

            if (response.data.status === 'success') {
                console.log(`✅ Sheet reset successful`);
                return {
                    success: true,
                    message: response.data.message
                };
            } else {
                throw new Error(response.data.message || 'Failed to reset sheet');
            }

        } catch (error) {
            console.error('❌ Error resetting sheet:', error.message);

            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return {
                    success: false,
                    error: 'Request timeout - Google Apps Script may be busy. Please try again.'
                };
            }

            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Update employee information in Google Sheet
     * Updates cells: D4, D5, F5, F6, D9:E11
     * @param {String} sheetId - Google Sheet ID
     * @param {Object} employeeData - Employee information
     * @returns {Object} - Update result
     */
    async updateEmployeeInfo(sheetId, employeeData) {
        try {
            if (!this.isReady()) {
                throw new Error('Google Apps Script URL not configured');
            }

            if (!sheetId) {
                throw new Error('No sheet ID provided');
            }

            console.log(`📝 Updating employee info in sheet: ${sheetId}`);
            console.log('Employee data:', employeeData);

            // Call Google Apps Script to update employee info
            const response = await axios.post(this.appsScriptUrl, {
                action: 'updateEmployeeInfo',
                sheetId: sheetId,
                employeeData: employeeData
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });

            if (response.data.status === 'success') {
                console.log(`✅ Employee info updated successfully`);
                return {
                    success: true,
                    message: response.data.message
                };
            } else {
                throw new Error(response.data.message || 'Failed to update employee info');
            }

        } catch (error) {
            console.error('❌ Error updating employee info:', error.message);

            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return {
                    success: false,
                    error: 'Request timeout - Google Apps Script may be busy. Please try again.'
                };
            }

            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
}

// Create singleton instance
const googleSheetsService = new GoogleSheetsService();

module.exports = googleSheetsService;
