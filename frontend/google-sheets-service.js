/**
 * Google Sheets Service Module
 * Handles authentication and data export to Google Sheets
 */

class GoogleSheetsService {
    constructor() {
        this.CLIENT_ID = '681872016305-u5r9g2mmr2ivkegehupbl1d8hnrb4mvj.apps.googleusercontent.com';
        this.API_KEY = 'AIzaSyCwd0tqGge6Aw5G1KINQJDGsf_9t0_Et0I';
        this.SHEET_ID = '1dcq8HKP1j4NocCMgAY9YSXlwCrzHwIiRCd0t4mun25E';
        this.SHEET_NAME = 'ExpenseReport';

        this.DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
        this.SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

        this.tokenClient = null;
        this.gapiInited = false;
        this.gisInited = false;
        this.isAuthenticated = false;

        this.cellMapping = {
            dateRange: 'B14:B66',      // DATE column
            vendorRange: 'C14:D66',     // VENDOR NAME column (spans C-D)
            categoryRange: 'E14:E66',   // CATEGORY column
            costRange: 'F14:F66'        // COST column
        };
    }

    /**
     * Initialize Google API client
     */
    async initializeGapi() {
        try {
            console.log('Attempting GAPI initialization...');
            console.log('- typeof gapi:', typeof gapi);
            console.log('- gapi exists:', typeof gapi !== 'undefined');
            console.log('- gapi.client exists:', typeof gapi !== 'undefined' && !!gapi.client);
            console.log('- gapi.load exists:', typeof gapi !== 'undefined' && !!gapi.load);

            if (typeof gapi === 'undefined') {
                console.error('GAPI script not loaded');
                return false;
            }

            if (!gapi.client) {
                console.log('gapi.client not ready, loading...');
                await new Promise((resolve, reject) => {
                    gapi.load('client', {
                        callback: resolve,
                        onerror: reject
                    });
                });
            }

            console.log('Initializing gapi.client with API key...');
            await gapi.client.init({
                apiKey: this.API_KEY,
                discoveryDocs: [this.DISCOVERY_DOC],
            });

            this.gapiInited = true;
            this.updateAuthStatus();
            console.log('✅ Google API initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Error initializing Google API:', error);
            this.gapiInited = false;
            return false;
        }
    }

    /**
     * Initialize Google Identity Services
     */
    initializeGis() {
        try {
            console.log('Attempting GIS initialization...');
            console.log('- typeof google:', typeof google);
            console.log('- google exists:', typeof google !== 'undefined');
            console.log('- google.accounts exists:', typeof google !== 'undefined' && !!google.accounts);
            console.log('- google.accounts.oauth2 exists:', typeof google !== 'undefined' && !!google.accounts && !!google.accounts.oauth2);

            if (typeof google === 'undefined') {
                console.error('Google Identity Services script not loaded');
                return false;
            }

            if (!google.accounts || !google.accounts.oauth2) {
                console.error('google.accounts.oauth2 not available');
                return false;
            }

            console.log('Creating token client...');
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (resp) => {
                    if (resp.error !== undefined) {
                        console.error('Authentication error:', resp.error);
                        this.updateAuthStatus(false);
                        return;
                    }
                    this.isAuthenticated = true;
                    this.updateAuthStatus(true);
                    console.log('Google authentication successful');
                },
            });

            this.gisInited = true;
            this.updateAuthStatus();
            console.log('✅ Google Identity Services initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Error initializing Google Identity Services:', error);
            this.gisInited = false;
            return false;
        }
    }

    /**
     * Set API credentials
     */
    setCredentials(clientId, apiKey) {
        this.CLIENT_ID = clientId;
        this.API_KEY = apiKey;
        localStorage.setItem('googleClientId', clientId);
        localStorage.setItem('googleApiKey', apiKey);
    }

    /**
     * Set sheet configuration
     */
    setSheetConfig(sheetId, sheetName) {
        this.SHEET_ID = sheetId;
        this.SHEET_NAME = sheetName;
        localStorage.setItem('googleSheetId', sheetId);
        localStorage.setItem('googleSheetName', sheetName);
    }

    /**
     * Load saved configuration
     */
    loadConfig() {
        const clientId = localStorage.getItem('googleClientId');
        const apiKey = localStorage.getItem('googleApiKey');
        const sheetId = localStorage.getItem('googleSheetId');
        const sheetName = localStorage.getItem('googleSheetName');

        if (clientId && apiKey) {
            this.CLIENT_ID = clientId;
            this.API_KEY = apiKey;
        }

        if (sheetId) this.SHEET_ID = sheetId;
        if (sheetName) this.SHEET_NAME = sheetName;

        return {
            clientId: clientId || '',
            apiKey: apiKey || '',
            sheetId: this.SHEET_ID,
            sheetName: this.SHEET_NAME
        };
    }

    /**
     * Check if service is ready for authentication
     */
    isReady() {
        return this.gapiInited && this.gisInited && this.CLIENT_ID && this.API_KEY;
    }

    /**
     * Authenticate user
     */
    async authenticate() {
        if (!this.isReady()) {
            throw new Error('Google Sheets service not properly configured');
        }

        if (gapi.client.getToken() === null) {
            this.tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
            this.tokenClient.requestAccessToken({prompt: ''});
        }
    }

    /**
     * Sign out user
     */
    signOut() {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
            this.isAuthenticated = false;
            this.updateAuthStatus(false);
        }
    }

    /**
     * Test connection to Google Sheets
     */
    async testConnection() {
        try {
            if (!this.isAuthenticated) {
                throw new Error('Not authenticated with Google');
            }

            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.SHEET_ID,
            });

            const sheetTitle = response.result.properties.title;
            const sheets = response.result.sheets.map(sheet => sheet.properties.title);

            console.log('Available sheet tabs:', sheets);

            return {
                success: true,
                message: `Connected to sheet: ${sheetTitle}. Available tabs: ${sheets.join(', ')}`,
                sheetTitle: sheetTitle,
                availableSheets: sheets
            };
        } catch (error) {
            console.error('Connection test failed:', error);

            let errorMessage = 'Unknown error';
            if (error.result && error.result.error) {
                const apiError = error.result.error;
                if (apiError.code === 403) {
                    errorMessage = 'Permission denied. Make sure the Google Sheet is shared with your Google account.';
                } else if (apiError.code === 404) {
                    errorMessage = 'Sheet not found. Check if the Sheet ID is correct.';
                } else {
                    errorMessage = apiError.message;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }

            return {
                success: false,
                message: `Connection failed: ${errorMessage}`,
                error: error
            };
        }
    }

    /**
     * Validate sheet name/tab exists
     */
    async validateSheetName() {
        try {
            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.SHEET_ID,
            });

            const availableTabs = response.result.sheets.map(sheet => sheet.properties.title);
            const isValid = availableTabs.includes(this.SHEET_NAME);

            console.log('Available sheet tabs:', availableTabs);
            console.log('Current sheet name:', this.SHEET_NAME);
            console.log('Is valid:', isValid);

            return {
                isValid: isValid,
                availableTabs: availableTabs
            };
        } catch (error) {
            console.error('Error validating sheet name:', error);
            return {
                isValid: false,
                availableTabs: []
            };
        }
    }

    /**
     * Get existing data from sheet to find next empty row (checking column B for dates)
     */
    async getExistingData() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.SHEET_ID,
                range: `${this.SHEET_NAME}!B14:B66`, // Check DATE column from row 14
            });

            return response.result.values || [];
        } catch (error) {
            console.error('Error reading existing data:', error);
            return [];
        }
    }

    /**
     * Find the next empty row in the data range (starting from row 14)
     */
    findNextEmptyRow(existingData) {
        let nextRow = 14; // Starting row (changed from 13 to 14)

        if (existingData && existingData.length > 0) {
            // Find the last row with data
            for (let i = existingData.length - 1; i >= 0; i--) {
                const row = existingData[i];
                if (row && row.length > 0 && row[0] && row[0].toString().trim() !== '') {
                    nextRow = 14 + i + 1;
                    break;
                }
            }
        }

        return Math.min(nextRow, 66); // Don't exceed row 66
    }

    /**
     * Export expenses data to Google Sheets
     */
    async exportExpenses(expenses) {
        try {
            console.log('🔄 Starting export process...');
            console.log('Expenses data:', expenses);
            console.log('Is authenticated:', this.isAuthenticated);
            console.log('Sheet name:', this.SHEET_NAME);

            // Validate authentication
            let isAuthValid = this.isAuthenticated;
            try {
                if (typeof gapi !== 'undefined' && gapi.client) {
                    const token = gapi.client.getToken();
                    isAuthValid = isAuthValid && token !== null;
                    console.log('Token status:', token ? 'Valid' : 'Missing');
                }
            } catch (tokenError) {
                console.error('Error checking token:', tokenError);
                isAuthValid = false;
            }

            if (!isAuthValid) {
                throw new Error('Not authenticated with Google. Please click "Connect to Google" first.');
            }

            if (!expenses || expenses.length === 0) {
                throw new Error('No expenses data to export');
            }

            // Check expense data structure
            console.log('First expense structure:', expenses[0]);

            // Test sheet access first
            console.log('Testing sheet access...');
            try {
                const testResponse = await gapi.client.sheets.spreadsheets.get({
                    spreadsheetId: this.SHEET_ID,
                });
                console.log('Sheet access test successful:', testResponse.result.properties.title);
            } catch (accessError) {
                console.error('Sheet access test failed:', accessError);

                let errorMessage = 'Unknown access error';
                if (accessError.result && accessError.result.error) {
                    const apiError = accessError.result.error;
                    errorMessage = apiError.message;

                    if (apiError.code === 400 && apiError.message.includes('not supported for this document')) {
                        errorMessage = 'This appears to be an Excel file (.xlsx) uploaded to Google Drive. Please convert it to Google Sheets format:\n' +
                                     '1. Open the file in Google Sheets\n' +
                                     '2. Click File → Save as Google Sheets\n' +
                                     '3. Use the new Google Sheets URL';
                    } else if (apiError.code === 403) {
                        errorMessage = 'Permission denied. Make sure the Google Sheet is shared with your Google account or is public.';
                    } else if (apiError.code === 404) {
                        errorMessage = 'Sheet not found. Check if the Sheet ID is correct.';
                    }
                } else if (accessError.message) {
                    errorMessage = accessError.message;
                }

                throw new Error(`Cannot access Google Sheet: ${errorMessage}`);
            }

            // Validate sheet name/tab
            console.log('Validating sheet tab name...');
            const sheetInfo = await this.validateSheetName();
            if (!sheetInfo.isValid) {
                throw new Error(`Sheet tab "${this.SHEET_NAME}" not found. Available tabs: ${sheetInfo.availableTabs.join(', ')}. Please update the sheet name in configuration.`);
            }

            // Get existing data to find next empty row
            console.log('Getting existing data from sheet...');
            const existingData = await this.getExistingData();
            let startRow = this.findNextEmptyRow(existingData);
            console.log('Starting row:', startRow);

            if (startRow + expenses.length > 66) {
                throw new Error(`Not enough empty rows. Available rows: ${66 - startRow + 1}, Required: ${expenses.length}`);
            }

            // Prepare data arrays for columns A, B, C, E, F (starting from row 14)
            const updates = [];

            // Column A: S.NO (serial numbers)
            const serialNumbers = expenses.map((expense, index) => [startRow + index - 13]);
            updates.push({
                range: `${this.SHEET_NAME}!A${startRow}:A${startRow + expenses.length - 1}`,
                values: serialNumbers
            });

            // Column B: DATE (format: dd-MMM-yyyy like 20-Mar-2025)
            const dates = expenses.map(expense => [this.formatDate(expense.date)]);
            updates.push({
                range: `${this.SHEET_NAME}!B${startRow}:B${startRow + expenses.length - 1}`,
                values: dates
            });

            // Column C: VENDOR NAME (only vendor name - no category or description)
            const vendors = expenses.map(expense => [
                expense.vendor || 'Unknown Vendor'
            ]);
            updates.push({
                range: `${this.SHEET_NAME}!C${startRow}:C${startRow + expenses.length - 1}`,
                values: vendors
            });

            // Column E: CATEGORY (exact category entered by user)
            const categories = expenses.map(expense => [
                expense.category || 'Miscellaneous'
            ]);
            updates.push({
                range: `${this.SHEET_NAME}!E${startRow}:E${startRow + expenses.length - 1}`,
                values: categories
            });

            // Column F: COST (only numeric amount)
            const costs = expenses.map(expense => {
                const amount = parseFloat(expense.amount) || 0;
                return [amount];
            });
            updates.push({
                range: `${this.SHEET_NAME}!F${startRow}:F${startRow + expenses.length - 1}`,
                values: costs
            });

            console.log('Prepared updates:', updates);
            console.log('Update details:');
            updates.forEach((update, index) => {
                console.log(`  ${index + 1}. Range: ${update.range}`);
                console.log(`     Values:`, update.values);
            });

            // Execute batch update
            console.log('Executing batch update to Google Sheets...');
            const response = await gapi.client.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.SHEET_ID,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: updates
                }
            });

            console.log('Batch update response:', response);
            console.log('Updated ranges:', response.result.updatedData?.map(data => data.range));
            console.log('Updated cells total:', response.result.totalUpdatedCells);

            // Verify the data was written by reading it back
            try {
                const verifyResponse = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: this.SHEET_ID,
                    range: `${this.SHEET_NAME}!A${startRow}:E${startRow + expenses.length - 1}`,
                });
                console.log('Verification - Data written to sheet:', verifyResponse.result.values);
            } catch (verifyError) {
                console.warn('Could not verify written data:', verifyError);
            }

            return {
                success: true,
                message: `Successfully exported ${expenses.length} expenses to Google Sheets (rows ${startRow}-${startRow + expenses.length - 1})`,
                updatedRows: response.result.totalUpdatedRows,
                startRow: startRow,
                endRow: startRow + expenses.length - 1
            };

        } catch (error) {
            console.error('❌ Error exporting to Google Sheets:', error);

            let errorMessage = 'Unknown error';
            let errorDetails = '';

            // Handle different types of errors
            if (error.result && error.result.error) {
                // Google API error
                const apiError = error.result.error;
                errorMessage = apiError.message || 'Google API error';
                errorDetails = `Status: ${apiError.status}, Code: ${apiError.code}`;
                console.error('Google API Error Details:', apiError);
            } else if (error.status) {
                // HTTP error
                errorMessage = `HTTP Error ${error.status}`;
                errorDetails = error.statusText || '';
            } else if (error.message) {
                // Regular JavaScript error
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                // String error
                errorMessage = error;
            }

            console.error('Processed error details:', {
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            return {
                success: false,
                message: `Export failed: ${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`,
                error: error
            };
        }
    }

    /**
     * Map category to valid categories from Categories tab
     */
    mapToValidCategory(category) {
        // Category mapping for common expense types
        const categoryMap = {
            'Transportation': 'Transportation',
            'Accommodation': 'Accommodation',
            'Meals': 'Food',
            'Food': 'Food',
            'Fuel': 'Fuel',
            'Miscellaneous': 'Others',
            'Others': 'Others'
        };

        return categoryMap[category] || 'Others';
    }

    /**
     * Format date for Google Sheets (dd-MMM-yyyy format like 20-Mar-2025)
     */
    formatDate(dateString) {
        try {
            if (!dateString) return '';
            const date = new Date(dateString);

            const day = String(date.getDate()).padStart(2, '0');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames[date.getMonth()];
            const year = date.getFullYear();

            return `${day}-${month}-${year}`; // Format: 20-Mar-2025
        } catch (error) {
            return dateString; // Return original if formatting fails
        }
    }

    /**
     * Update authentication status in UI
     */
    updateAuthStatus(authenticated = null) {
        const statusIndicator = document.getElementById('statusIndicator');
        const authorizeBtn = document.getElementById('authorizeGoogle');
        const signOutBtn = document.getElementById('signOutGoogle');
        const exportBtn = document.getElementById('exportToGoogleSheets');

        // Check if user has existing token
        if (authenticated === null) {
            try {
                authenticated = this.isAuthenticated || (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken() !== null);
                this.isAuthenticated = authenticated;
            } catch (error) {
                console.log('Error checking token status:', error);
                authenticated = this.isAuthenticated;
            }
        }

        if (statusIndicator) {
            if (authenticated) {
                statusIndicator.textContent = '🟢 Connected to Google';
                statusIndicator.className = 'status-indicator connected';
            } else if (this.isReady()) {
                statusIndicator.textContent = '🟡 Ready to connect';
                statusIndicator.className = 'status-indicator ready';
            } else {
                statusIndicator.textContent = '⚪ Not configured';
                statusIndicator.className = 'status-indicator not-configured';
            }
        }

        if (authorizeBtn) {
            authorizeBtn.style.display = (this.isReady() && !authenticated) ? 'block' : 'none';
        }

        if (signOutBtn) {
            signOutBtn.style.display = authenticated ? 'block' : 'none';
        }

        if (exportBtn) {
            exportBtn.style.display = authenticated ? 'block' : 'none';
        }
    }
}

// Global instance
window.googleSheetsService = new GoogleSheetsService();

// Global functions for HTML onload attributes
window.gapiLoaded = function() {
    console.log('Google API script loaded');

    // Function to retry GAPI initialization
    const initGapi = async (retries = 5) => {
        if (!window.googleSheetsService) return false;

        const success = await window.googleSheetsService.initializeGapi();
        if (success) {
            console.log('GAPI successfully initialized');
            return true;
        } else if (retries > 0) {
            console.log(`GAPI initialization failed, retrying... (${retries} attempts left)`);
            setTimeout(() => initGapi(retries - 1), 1000);
        } else {
            console.error('GAPI initialization failed after all retries');
        }
        return false;
    };

    // Start initialization with delay
    setTimeout(() => initGapi(), 200);
};

window.gisLoaded = function() {
    console.log('Google Identity Services script loaded');

    // Function to retry GIS initialization
    const initGis = (retries = 5) => {
        if (!window.googleSheetsService) return false;

        const success = window.googleSheetsService.initializeGis();
        if (success) {
            console.log('GIS successfully initialized');
            return true;
        } else if (retries > 0) {
            console.log(`GIS initialization failed, retrying... (${retries} attempts left)`);
            setTimeout(() => initGis(retries - 1), 1000);
        } else {
            console.error('GIS initialization failed after all retries');
        }
        return false;
    };

    // Start initialization with delay
    setTimeout(() => initGis(), 200);
};