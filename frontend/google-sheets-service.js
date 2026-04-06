/**
 * Google Sheets Service - Uses Google Apps Script Web App
 * Connects to master template system for expense exports
 */

class GoogleSheetsService {
    constructor() {
        this.sheetUrl = null;
        this.sheetId = null;
        this.isInitialized = false;
        this.isCreating = false; // Lock to prevent multiple creations
        this.createPromise = null; // Store pending creation promise
        this.isInitializing = false; // Lock to prevent multiple initializations
        this.initPromise = null; // Store pending initialization promise

        // Google Apps Script Web App URL
        this.APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxKYFf8qGNKSBOcFlQ4yw2J_WBQ3SoLGFKJR_QNNJzND0NY4QD36-6ZsMtt0e-pMl0Pmw/exec';
    }

    /**
     * Initialize service - load sheet info from database or create new sheet
     */
    async initialize() {
        // If already initialized with a sheet, return immediately
        if (this.isInitialized && this.sheetId && this.sheetUrl) {
            console.log('Google Sheets already initialized');
            return true;
        }

        // If initialization is in progress, wait for it
        if (this.isInitializing && this.initPromise) {
            console.log('Google Sheets initialization already in progress, waiting...');
            return await this.initPromise;
        }

        // Start initialization with lock
        this.isInitializing = true;
        this.initPromise = this._doInitialize();

        try {
            const result = await this.initPromise;
            return result;
        } finally {
            this.isInitializing = false;
            this.initPromise = null;
        }
    }

    /**
     * Internal method to actually initialize
     */
    async _doInitialize() {
        try {
            // First check localStorage (cache)
            const savedSheetId = localStorage.getItem('googleSheetId');
            const savedSheetUrl = localStorage.getItem('googleSheetUrl');

            if (savedSheetId && savedSheetUrl) {
                this.sheetId = savedSheetId;
                this.sheetUrl = savedSheetUrl;
                this.isInitialized = true;
                this.updateUI();
                console.log('Google Sheet loaded from cache:', this.sheetUrl);
                return true;
            }

            // Check database for user's sheet
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (!user.id) {
                console.log('User not logged in, skipping sheet initialization');
                return false;
            }

            // Try to get sheet from Supabase profile
            try {
                const supabase = window.supabaseClient?.get();
                if (supabase) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('google_sheet_id, google_sheet_url')
                        .eq('id', user.id)
                        .single();

                    if (profile?.google_sheet_id && profile?.google_sheet_url) {
                        this.sheetId = profile.google_sheet_id;
                        this.sheetUrl = profile.google_sheet_url;

                        // Cache in localStorage
                        localStorage.setItem('googleSheetId', this.sheetId);
                        localStorage.setItem('googleSheetUrl', this.sheetUrl);

                        this.isInitialized = true;
                        this.updateUI();
                        console.log('Google Sheet loaded from database:', this.sheetUrl);
                        return true;
                    }
                }
            } catch (dbError) {
                console.log('Could not fetch sheet from database:', dbError.message);
            }

            // No sheet in database - create one for new user
            if (user.email && user.name) {
                console.log('No Google Sheet found, creating one for new user...');
                try {
                    await this.createSheet();
                    console.log('Google Sheet created for new user:', this.sheetUrl);
                } catch (createError) {
                    console.log('Sheet creation deferred:', createError.message);
                }
            }

            return true;
        } catch (error) {
            console.log('Google Sheets initialization:', error.message);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Call Apps Script using form submission (avoids CORS)
     */
    async callAppsScript(data) {
        return new Promise((resolve, reject) => {
            // Create a unique callback name
            const callbackName = 'googleSheetsCallback_' + Date.now();

            // Create hidden iframe for form submission
            const iframe = document.createElement('iframe');
            iframe.name = 'googleSheetsFrame';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            // Create form
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = this.APPS_SCRIPT_URL;
            form.target = 'googleSheetsFrame';

            // Add data as hidden field
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'data';
            input.value = JSON.stringify(data);
            form.appendChild(input);

            // Handle response via postMessage
            const messageHandler = (event) => {
                if (event.origin === 'https://script.google.com') {
                    window.removeEventListener('message', messageHandler);
                    document.body.removeChild(iframe);
                    document.body.removeChild(form);

                    try {
                        const result = JSON.parse(event.data);
                        resolve(result);
                    } catch (e) {
                        resolve({ status: 'success', data: {} });
                    }
                }
            };

            window.addEventListener('message', messageHandler);

            // Submit form
            document.body.appendChild(form);
            form.submit();

            // Timeout after 30 seconds
            setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
                if (document.body.contains(form)) {
                    document.body.removeChild(form);
                }
                // Assume success if no response (Apps Script may not send postMessage)
                resolve({ status: 'success', data: {} });
            }, 30000);
        });
    }

    /**
     * Call Apps Script using GET request (better CORS support)
     */
    async fetchAppsScript(data) {
        try {
            // Use GET request with data as URL parameter
            const params = new URLSearchParams({
                data: JSON.stringify(data)
            });

            const response = await fetch(`${this.APPS_SCRIPT_URL}?${params}`, {
                method: 'GET',
                redirect: 'follow'
            });

            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.log('Response:', text);
                return { status: 'success', data: {} };
            }
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    /**
     * Create a new sheet for the user (copy of master template)
     */
    async createSheet() {
        // If already have a sheet, return it
        if (this.sheetId && this.sheetUrl) {
            return { success: true, sheetId: this.sheetId, sheetUrl: this.sheetUrl };
        }

        // If creation is in progress, wait for it
        if (this.isCreating && this.createPromise) {
            console.log('Sheet creation already in progress, waiting...');
            return await this.createPromise;
        }

        // Start creation with lock
        this.isCreating = true;
        this.createPromise = this._doCreateSheet();

        try {
            const result = await this.createPromise;
            return result;
        } finally {
            this.isCreating = false;
            this.createPromise = null;
        }
    }

    /**
     * Internal method to actually create the sheet
     */
    async _doCreateSheet() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');

            if (!user.email || !user.name) {
                throw new Error('User information not available. Please log in again.');
            }

            console.log('Creating sheet for:', user.name, user.email);

            const data = {
                action: 'createSheet',
                userId: user.id,
                userEmail: user.email,
                userName: user.name
            };

            const result = await this.fetchAppsScript(data);

            if (result.status === 'success' && result.data) {
                this.sheetId = result.data.sheetId;
                this.sheetUrl = result.data.sheetUrl;

                // Save to localStorage (cache)
                localStorage.setItem('googleSheetId', this.sheetId);
                localStorage.setItem('googleSheetUrl', this.sheetUrl);

                // Save to Supabase database (persistent)
                try {
                    const supabase = window.supabaseClient?.get();
                    if (supabase) {
                        await supabase
                            .from('profiles')
                            .update({
                                google_sheet_id: this.sheetId,
                                google_sheet_url: this.sheetUrl
                            })
                            .eq('id', user.id);
                        console.log('Sheet ID saved to database');
                    }
                } catch (dbError) {
                    console.log('Could not save sheet to database:', dbError.message);
                }

                this.isInitialized = true;
                this.updateUI();

                console.log('Sheet created:', this.sheetUrl);
                return { success: true, sheetId: this.sheetId, sheetUrl: this.sheetUrl };
            } else {
                throw new Error(result.message || 'Failed to create sheet');
            }
        } catch (error) {
            console.error('Error creating sheet:', error);
            throw error;
        }
    }

    /**
     * Get the last export timestamp for incremental exports
     */
    getLastExportTimestamp() {
        return localStorage.getItem('sheetsLastExportTimestamp') || null;
    }

    /**
     * Save the last export timestamp
     */
    setLastExportTimestamp(timestamp) {
        localStorage.setItem('sheetsLastExportTimestamp', timestamp);
    }

    /**
     * Get IDs of previously exported expenses
     */
    getExportedExpenseIds() {
        try {
            return JSON.parse(localStorage.getItem('sheetsExportedIds') || '[]');
        } catch { return []; }
    }

    /**
     * Save exported expense IDs
     */
    addExportedExpenseIds(ids) {
        const existing = this.getExportedExpenseIds();
        const merged = [...new Set([...existing, ...ids])];
        localStorage.setItem('sheetsExportedIds', JSON.stringify(merged));
    }

    /**
     * Clear export tracking (used on sheet reset/recreate)
     */
    clearExportTracking() {
        localStorage.removeItem('sheetsLastExportTimestamp');
        localStorage.removeItem('sheetsExportedIds');
    }

    /**
     * Check if an expense has been exported
     */
    isExpenseExported(expenseId) {
        return this.getExportedExpenseIds().includes(expenseId);
    }

    /**
     * Export expenses to Google Sheets (incremental — only new/unsynced expenses)
     * @param {Array} expenses - expenses to export
     * @param {boolean} forceAll - if true, export all even if already exported (user confirmed)
     */
    async exportExpenses(expenses, forceAll = false) {
        try {
            if (!expenses || expenses.length === 0) {
                throw new Error('No expenses to export');
            }

            // Create sheet if doesn't exist
            if (!this.sheetId) {
                await this.createSheet();
            }

            // Filter to only unexported expenses (unless user forced re-export)
            let newExpenses;
            if (forceAll) {
                newExpenses = expenses;
            } else {
                const exportedIds = this.getExportedExpenseIds();
                newExpenses = expenses.filter(exp => !exportedIds.includes(exp.id));
            }

            if (newExpenses.length === 0) {
                return {
                    success: true,
                    message: 'All expenses already exported. No new expenses to sync.',
                    sheetUrl: this.sheetUrl,
                    exportedCount: 0,
                    skippedCount: expenses.length
                };
            }

            console.log(`Exporting ${newExpenses.length} expenses to sheet:`, this.sheetId);

            // Sort expenses chronologically (oldest first) before exporting
            const sorted = [...newExpenses].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

            // Format expenses for the Apps Script
            const formattedExpenses = sorted.map(exp => ({
                date: exp.date,
                vendor: exp.vendor || 'N/A',
                category: exp.category,
                amount: parseFloat(exp.amount) || 0,
                description: exp.description || '',
                visitType: exp.visitType || '',
                paymentMode: exp.paymentMode === 'bank_transfer' ? 'Bank Transfer' : exp.paymentMode === 'upi' ? 'UPI' : 'Cash',
                billAttached: exp.billAttached === 'no' ? 'No' : 'Yes'
            }));

            const data = {
                action: 'exportExpenses',
                sheetId: this.sheetId,
                expenses: formattedExpenses
            };

            // Step 1: Main export to ExpenseReport tab
            const result = await this.fetchAppsScript(data);

            if (result.status !== 'success') {
                throw new Error(result.message || 'Export failed');
            }

            // Track exported expense IDs to prevent duplicates
            this.addExportedExpenseIds(newExpenses.map(exp => exp.id));
            this.setLastExportTimestamp(new Date().toISOString());

            // Build advance summaries for Google Sheets
            let advanceSummaries = [];
            try {
                if (window.expenseTracker?.advances?.length > 0) {
                    advanceSummaries = window.expenseTracker.advances
                        .filter(a => a.status === 'active')
                        .map(a => ({
                            projectName: a.project_name,
                            advanceAmount: a.amount,
                            totalSpent: a.totalSpent,
                            remaining: a.remaining
                        }));
                }
            } catch (e) {
                console.warn('Could not build advance summaries:', e);
            }

            // Step 2-4: Log sheet, By Project tab, Individual project tabs
            // Separate API calls — each gets its own fresh doGet context
            // Fire all 3 in parallel (non-blocking, errors don't fail the export)
            this.fetchAppsScript({ action: 'addToLogSheet', sheetId: this.sheetId, expenses: formattedExpenses })
                .catch(err => console.warn('Log sheet update failed (non-fatal):', err));
            this.fetchAppsScript({ action: 'addToProjectSheets', sheetId: this.sheetId, expenses: formattedExpenses, advances: advanceSummaries })
                .catch(err => console.warn('By Project tab update failed (non-fatal):', err));
            this.fetchAppsScript({ action: 'addToIndividualProjectTabs', sheetId: this.sheetId, expenses: formattedExpenses, advances: advanceSummaries })
                .catch(err => console.warn('Project tabs update failed (non-fatal):', err));

            this.updateUI();

            const exportedCount = result.data?.exportedCount || newExpenses.length;
            const skippedCount = expenses.length - newExpenses.length;
            const skippedMsg = skippedCount > 0 ? ` (${skippedCount} already exported)` : '';

            return {
                success: true,
                message: `Exported ${exportedCount} new expenses${skippedMsg} (project ledger updated)`,
                sheetUrl: this.sheetUrl,
                exportedCount,
                skippedCount,
                startRow: result.data?.startRow,
                endRow: result.data?.endRow
            };

        } catch (error) {
            console.error('❌ Error exporting to Google Sheets:', error);
            return {
                success: false,
                message: error.message || 'Failed to export expenses'
            };
        }
    }

    /**
     * Reset/clear the sheet - restores to master template format
     */
    async resetSheet() {
        try {
            if (!this.sheetId) {
                throw new Error('No Google Sheet found. Please create one first.');
            }

            const data = {
                action: 'resetSheet',
                sheetId: this.sheetId
            };

            const result = await this.fetchAppsScript(data);

            if (result.status === 'success') {
                this.clearExportTracking();
                return { success: true, message: 'Sheet reset to template successfully' };
            } else {
                throw new Error(result.message || 'Failed to reset sheet');
            }
        } catch (error) {
            console.error('Error resetting sheet:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Create a completely new sheet (replaces existing)
     */
    async createNewSheet() {
        try {
            // Clear saved sheet data
            localStorage.removeItem('googleSheetId');
            localStorage.removeItem('googleSheetUrl');

            // Clear from database
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const supabase = window.supabaseClient?.get();
                if (supabase && user.id) {
                    await supabase
                        .from('profiles')
                        .update({
                            google_sheet_id: null,
                            google_sheet_url: null
                        })
                        .eq('id', user.id);
                }
            } catch (dbError) {
                console.log('Could not clear sheet from database:', dbError.message);
            }

            this.sheetId = null;
            this.sheetUrl = null;
            this.isInitialized = false;
            this.clearExportTracking();

            // Create a new sheet
            await this.createSheet();

            return { success: true, message: 'New sheet created from template' };
        } catch (error) {
            console.error('Error creating new sheet:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Get sheet URL
     */
    getSheetUrl() {
        return this.sheetUrl;
    }

    /**
     * Check if user has a sheet
     */
    hasSheet() {
        return this.isInitialized && this.sheetUrl !== null;
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

        if (exportBtn) {
            exportBtn.style.display = 'flex';
        }
    }

    /**
     * Update employee information in the sheet
     */
    async updateEmployeeInfo(employeeData) {
        try {
            if (!this.sheetId) {
                await this.createSheet();
            }

            const data = {
                action: 'updateEmployeeInfo',
                sheetId: this.sheetId,
                employeeData: employeeData
            };

            const result = await this.fetchAppsScript(data);

            if (result.status === 'success') {
                return {
                    success: true,
                    message: 'Employee information updated successfully'
                };
            } else {
                throw new Error(result.message || 'Failed to update employee info');
            }
        } catch (error) {
            console.error('Error updating employee info:', error);
            return {
                success: false,
                message: error.message || 'Failed to update employee information'
            };
        }
    }

    /**
     * Export sheet as PDF
     */
    async exportAsPdf() {
        try {
            if (!this.sheetId) {
                throw new Error('No Google Sheet found. Please create one first.');
            }

            const user = JSON.parse(localStorage.getItem('user') || '{}');

            const data = {
                action: 'exportPdf',
                sheetId: this.sheetId,
                userEmail: user.email
            };

            const result = await this.fetchAppsScript(data);

            if (result.status === 'success' && result.data) {
                return {
                    success: true,
                    pdfUrl: result.data.pdfUrl,
                    message: 'PDF exported successfully'
                };
            } else {
                throw new Error(result.message || 'Failed to export PDF');
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
            return {
                success: false,
                message: error.message || 'Failed to export PDF'
            };
        }
    }

    /**
     * Disconnect Google Sheets (clear local data)
     */
    disconnect() {
        this.sheetId = null;
        this.sheetUrl = null;
        this.isInitialized = false;
        localStorage.removeItem('googleSheetId');
        localStorage.removeItem('googleSheetUrl');
        this.clearExportTracking();
        this.updateUI();
    }
}

// Create global instance
window.googleSheetsService = new GoogleSheetsService();
