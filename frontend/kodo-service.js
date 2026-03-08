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
     * Ensure Supabase session is fresh before making authenticated calls.
     * Refreshes the token if expired, throws if no valid session exists.
     */
    async _ensureSession() {
        const supabase = this._getSupabase();
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
            // Try to refresh explicitly
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData?.session) {
                throw new Error('Session expired. Please log out and log back in.');
            }
        }
    }

    /**
     * Call the kodo-submit Edge Function
     * Uses supabase.functions.invoke() for automatic auth handling
     * Returns parsed result with { success, data } or throws
     */
    async _callEdgeFunction(body) {
        const supabase = this._getSupabase();

        // Ensure valid auth session before calling edge function
        await this._ensureSession();

        const { data, error } = await supabase.functions.invoke('kodo-submit', {
            body: body,
        });

        // Handle SDK-level errors (network, relay, or HTTP errors)
        if (error) {
            let errorMessage = error.message || 'Edge function call failed';
            let needsReauth = false;
            let needsOtp = false;

            // For HTTP errors, the response body is in error.context (a Response object)
            if (error.context && typeof error.context.json === 'function') {
                try {
                    const errorBody = await error.context.json();
                    errorMessage = errorBody.error || errorMessage;
                    needsReauth = errorBody.needsReauth || false;
                    needsOtp = errorBody.data?.needsOtp || false;
                } catch {
                    // Could not parse error body, use default message
                }
            }

            const err = new Error(errorMessage);
            err.needsReauth = needsReauth;
            err.needsOtp = needsOtp;
            throw err;
        }

        // data is the parsed JSON response body
        if (!data?.success) {
            const err = new Error(data?.error || 'Request failed');
            err.needsReauth = data?.needsReauth || false;
            err.needsOtp = data?.data?.needsOtp || false;
            throw err;
        }

        return data;
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

    async saveSettings({ email, passcode }) {
        const supabase = this._getSupabase();
        const userId = this._getUserId();

        const settingsData = {
            user_id: userId,
            kodo_email: email,
            kodo_passcode: passcode,
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
     * Diagnostic: fetch config with raw checker data
     */
    async getKodoConfigDiagnostic() {
        const result = await this._callEdgeFunction({ action: 'get-config', diagnostic: true });
        return result.data;
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

    /**
     * Save a claim after successful submission
     */
    async saveClaim({ claimId, amount, checkerName, categoryName, comment }) {
        return await window.api.saveKodoClaim({ claimId, amount, checkerName, categoryName, comment });
    }

    /**
     * Get all tracked claims
     */
    async getClaims(statusFilter = null) {
        return await window.api.getKodoClaims(statusFilter);
    }

    /**
     * Check status of pending claims via Kodo API
     * Returns array of claims with updated statuses
     */
    async checkClaimStatuses() {
        const pendingClaims = await this.getClaims('pending');
        if (pendingClaims.length === 0) return [];

        const claimIds = pendingClaims.map(c => c.claim_id);
        const result = await this._callEdgeFunction({
            action: 'check-status',
            claimIds,
        });

        const statuses = result.data.statuses || {};
        const updated = [];

        for (const claim of pendingClaims) {
            const statusInfo = statuses[claim.claim_id];
            if (statusInfo && statusInfo.status !== claim.status) {
                await window.api.updateKodoClaimStatus(claim.claim_id, statusInfo.status, statusInfo.raw);
                await window.api.logActivity(
                    `kodo_${statusInfo.status}`,
                    `Claim ${claim.claim_id} ${statusInfo.status}: ${claim.amount}`,
                    { claimId: claim.claim_id, oldStatus: claim.status, newStatus: statusInfo.status, ...statusInfo.raw }
                );
                updated.push({ ...claim, status: statusInfo.status, raw: statusInfo.raw });
            } else if (statusInfo) {
                // Update last_checked_at even if status didn't change
                await window.api.updateKodoClaimStatus(claim.claim_id, claim.status, statusInfo.raw);
            }
        }

        return updated;
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
