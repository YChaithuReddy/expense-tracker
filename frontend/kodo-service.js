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

    _getSupabase() {
        const client = window.supabaseClient?.get();
        if (!client) throw new Error('Supabase client not initialized');
        return client;
    }

    _getUserId() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.id) throw new Error('Not logged in');
        return user.id;
    }

    /**
     * Call the kodo-submit Edge Function
     * Returns parsed result with { success, data } or throws
     */
    async _callEdgeFunction(body) {
        const supabase = this._getSupabase();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
            throw new Error('No active session. Please log in again.');
        }

        const supabaseUrl = window.supabaseClient.SUPABASE_URL;
        const anonKey = window.supabaseClient.SUPABASE_ANON_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/kodo-submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': anonKey,
            },
            body: JSON.stringify(body),
        });

        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch {
            throw new Error(text || `Request failed (${response.status})`);
        }

        if (!response.ok || !result.success) {
            const err = new Error(result.error || `Request failed (${response.status})`);
            err.needsReauth = result.needsReauth || false;
            err.needsOtp = result.data?.needsOtp || false;
            throw err;
        }

        return result;
    }

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

    async getSettings() {
        const supabase = this._getSupabase();
        const userId = this._getUserId();

        const { data, error } = await supabase
            .from('kodo_settings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;

        this.settings = data;
        return data;
    }

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
     * Login to Kodo (step 1: email + passcode)
     * Returns { needsOtp: true, email } if OTP required
     * Returns { authenticated: true, user } if deviceToken valid
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
     * Verify OTP (step 2)
     * Returns { authenticated: true, user, hasDeviceToken }
     */
    async verifyOtp(email, otp) {
        const result = await this._callEdgeFunction({
            action: 'verify-otp',
            email,
            otp: String(otp),
        });
        return result.data;
    }

    /**
     * Fetch Kodo config (categories, checkers)
     * Throws with needsReauth if OTP session expired
     */
    async getKodoConfig() {
        if (this.config) return this.config;

        const result = await this._callEdgeFunction({ action: 'get-config' });
        this.config = result.data;
        return this.config;
    }

    /**
     * Submit reimbursement to Kodo
     */
    async submitToKodo(pdfBytes, expenseDetails) {
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

    hasSettings() {
        return this.isConfigured;
    }

    /**
     * Check if Kodo has a valid device token (OTP already completed)
     */
    hasDeviceToken() {
        return !!(this.settings?.kodo_device_token);
    }

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
