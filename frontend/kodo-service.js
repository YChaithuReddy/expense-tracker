/**
 * Kodo Reimbursement Service
 * Submits expense claims to Kodo via Supabase Edge Function
 */

class KodoService {
    constructor() {
        this.isConfigured = false;
        this.settings = null;
        this.config = null; // categories, checkers from Kodo
    }

    /**
     * Get Supabase client
     */
    _getSupabase() {
        const client = window.supabaseClient?.get();
        if (!client) throw new Error('Supabase client not initialized');
        return client;
    }

    /**
     * Get current user ID
     */
    _getUserId() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.id) throw new Error('Not logged in');
        return user.id;
    }

    /**
     * Call the kodo-submit Edge Function
     */
    async _callEdgeFunction(body) {
        const supabase = this._getSupabase();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
            throw new Error('No active session. Please log in again.');
        }

        const url = `${window.supabaseClient.SUPABASE_URL}/functions/v1/kodo-submit`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': window.supabaseClient.SUPABASE_URL ? '' : '',
            },
            body: JSON.stringify(body),
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Edge function call failed');
        }
        return result;
    }

    /**
     * Initialize - check if Kodo is configured
     */
    async initialize() {
        try {
            const settings = await this.getSettings();
            this.isConfigured = !!(settings && settings.kodo_email && settings.kodo_passcode);
            this.settings = settings;
            return this.isConfigured;
        } catch {
            this.isConfigured = false;
            return false;
        }
    }

    /**
     * Get Kodo settings from Supabase
     */
    async getSettings() {
        const supabase = this._getSupabase();
        const userId = this._getUserId();

        const { data, error } = await supabase
            .from('kodo_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            throw error;
        }

        this.settings = data;
        return data;
    }

    /**
     * Save Kodo settings
     */
    async saveSettings({ email, passcode, checkerId, checkerName, categoryId, categoryName }) {
        const supabase = this._getSupabase();
        const userId = this._getUserId();

        const settingsData = {
            user_id: userId,
            kodo_email: email,
            kodo_passcode: passcode,
            default_checker_id: checkerId || null,
            default_checker_name: checkerName || null,
            default_category_id: categoryId || null,
            default_category_name: categoryName || null,
        };

        const { data, error } = await supabase
            .from('kodo_settings')
            .upsert(settingsData, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;

        this.settings = data;
        this.isConfigured = true;
        return data;
    }

    /**
     * Test Kodo connection (login)
     */
    async testConnection(email, passcode) {
        const result = await this._callEdgeFunction({
            action: 'login',
            email,
            passcode,
        });
        return result.data;
    }

    /**
     * Fetch Kodo config (categories, checkers)
     */
    async getKodoConfig() {
        if (this.config) return this.config;

        const result = await this._callEdgeFunction({ action: 'get-config' });
        this.config = result.data;
        return this.config;
    }

    /**
     * Submit reimbursement to Kodo
     * @param {Uint8Array|ArrayBuffer} pdfBytes - The PDF file bytes
     * @param {Object} expenseDetails - { totalAmount, checkerId, categoryId, comment, billDate }
     */
    async submitToKodo(pdfBytes, expenseDetails) {
        // Convert to base64
        const bytes = pdfBytes instanceof ArrayBuffer ? new Uint8Array(pdfBytes) : pdfBytes;
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
        }
        const pdfBase64 = btoa(binary);

        const result = await this._callEdgeFunction({
            action: 'submit',
            pdfBase64,
            expenseDetails,
        });

        return result.data;
    }

    /**
     * Check if Kodo is configured
     */
    hasSettings() {
        return this.isConfigured;
    }

    /**
     * Clear Kodo settings
     */
    async clearSettings() {
        const supabase = this._getSupabase();
        const userId = this._getUserId();

        await supabase
            .from('kodo_settings')
            .delete()
            .eq('user_id', userId);

        this.settings = null;
        this.isConfigured = false;
        this.config = null;
    }
}

// Create global instance
window.kodoService = new KodoService();
