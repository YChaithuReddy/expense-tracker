/**
 * Google Sheets Service Module - Simplified
 * All sheet management now handled by backend
 * Frontend just makes simple API calls
 */

class GoogleSheetsService {
    constructor() {
        this.sheetUrl = null;
        this.isInitialized = false;
    }

    /**
     * Initialize service - check if user has a sheet
     */
    async initialize() {
        try {
            const response = await api.getGoogleSheetLink();

            if (response.status === 'success') {
                this.sheetUrl = response.data.sheetUrl;
                this.isInitialized = true;
                this.updateUI();
            } else {
                // User doesn't have a sheet yet - will be created on first export
                this.isInitialized = false;
            }

            return true;
        } catch (error) {
            // Check if it's an authentication error
            if (error.message && (error.message.includes('Not authorized') ||
                                 error.message.includes('Token is invalid') ||
                                 error.message.includes('401'))) {
                console.log('Authentication error in Google Sheets service - token expired or invalid');
                // Don't redirect here, let the main expense loading handle it
            } else {
                console.log('User has no Google Sheet yet - will be created on first export');
            }
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Export selected expenses to Google Sheets
     * @param {Array} expenses - Array of expense objects
     * @returns {Object} - Export result
     */
    async exportExpenses(expenses) {
        try {
            if (!expenses || expenses.length === 0) {
                throw new Error('No expenses to export');
            }

            // Extract expense IDs
            const expenseIds = expenses.map(exp => exp.id);

            // Call backend export API
            const response = await api.exportToGoogleSheets(expenseIds);

            if (response.status === 'success') {
                // Update sheet URL if returned
                if (response.data.sheetUrl) {
                    this.sheetUrl = response.data.sheetUrl;
                    this.isInitialized = true;
                    this.updateUI();
                }

                return {
                    success: true,
                    message: response.message,
                    sheetUrl: response.data.sheetUrl,
                    exportedCount: response.data.exportedCount
                };
            } else {
                return {
                    success: false,
                    message: response.message || 'Export failed'
                };
            }

        } catch (error) {
            console.error('❌ Error exporting to Google Sheets:', error);
            return {
                success: false,
                message: error.message || 'Failed to export expenses'
            };
        }
    }

    /**
     * Get user's Google Sheet URL
     * @returns {String} - Sheet URL or null
     */
    getSheetUrl() {
        return this.sheetUrl;
    }

    /**
     * Check if user has a sheet
     * @returns {Boolean}
     */
    hasSheet() {
        return this.isInitialized && this.sheetUrl !== null;
    }

    /**
     * Reset user's Google Sheet to master template format
     * @returns {Object} - Reset result
     */
    async resetSheet() {
        try {
            if (!this.hasSheet()) {
                throw new Error('No Google Sheet found. Please export expenses first.');
            }

            console.log('🔄 Resetting Google Sheet...');

            // Call backend reset API
            const response = await api.resetGoogleSheet();

            if (response.status === 'success') {
                console.log('✅ Sheet reset successfully');
                return {
                    success: true,
                    message: response.message
                };
            } else {
                return {
                    success: false,
                    message: response.message || 'Reset failed'
                };
            }

        } catch (error) {
            console.error('❌ Error resetting sheet:', error);
            return {
                success: false,
                message: error.message || 'Failed to reset sheet'
            };
        }
    }

    /**
     * Update employee information in Google Sheet
     * Updates specific cells: D4, D5, F5, F6, D9:E11
     * @param {Object} employeeData - Employee information
     * @returns {Object} - Update result
     */
    async updateEmployeeInfo(employeeData) {
        try {
            if (!this.hasSheet()) {
                throw new Error('No Google Sheet found. Please export expenses first.');
            }

            console.log('📝 Updating employee info in Google Sheet...');

            // Call backend API to update employee info
            const response = await api.updateEmployeeInfo(employeeData);

            if (response.status === 'success') {
                console.log('✅ Employee info updated successfully');
                return {
                    success: true,
                    message: response.message
                };
            } else {
                return {
                    success: false,
                    message: response.message || 'Update failed'
                };
            }

        } catch (error) {
            console.error('❌ Error updating employee info:', error);
            return {
                success: false,
                message: error.message || 'Failed to update employee information'
            };
        }
    }

    /**
     * Update UI to show/hide sheet link
     */
    updateUI() {
        const viewSheetBtn = document.getElementById('viewGoogleSheet');
        const exportBtn = document.getElementById('exportToGoogleSheets');

        if (viewSheetBtn) {
            if (this.hasSheet()) {
                viewSheetBtn.style.display = 'inline-block';
                viewSheetBtn.onclick = () => {
                    window.open(this.sheetUrl, '_blank');
                };
            } else {
                viewSheetBtn.style.display = 'none';
            }
        }

        // Export button always visible
        if (exportBtn) {
            exportBtn.style.display = 'inline-block';
        }
    }
}

// Create global instance
window.googleSheetsService = new GoogleSheetsService();

// Note: No more Google API loading needed!
// Everything is handled by the backend now.
