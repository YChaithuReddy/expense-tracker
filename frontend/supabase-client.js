/**
 * Supabase Client Configuration
 * Initialize and export the Supabase client for use throughout the app
 */

// ==============================================
// CONFIGURATION
// ==============================================
const SUPABASE_URL = 'https://ynpquqlxafdvoealmfye.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlucHF1cWx4YWZkdm9lYWxtZnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDA2MjQsImV4cCI6MjA4NTU3NjYyNH0.ib7e4Xql3UCJCeGtB9VYpxwR1nzxLZJlGQxXtzVdmec';

// ==============================================
// SUPABASE CLIENT INITIALIZATION
// ==============================================

// Store the client instance (using different name to avoid conflict with CDN)
let _supabaseInstance = null;

function initSupabase() {
    if (_supabaseInstance) return _supabaseInstance;

    // Check if Supabase SDK is loaded from CDN
    // The CDN exposes window.supabase with createClient method
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        console.error('Supabase JS library not loaded. Make sure to include the CDN script before this file.');
        return null;
    }

    _supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            storage: window.localStorage,
            storageKey: 'expense-tracker-auth',
            flowType: 'pkce'
        }
    });

    // Set up auth state change listener
    _supabaseInstance.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN') {
            console.log('User signed in:', session?.user?.email);
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
            localStorage.removeItem('user');
        } else if (event === 'TOKEN_REFRESHED') {
            console.log('Token refreshed');
        }
    });

    console.log('Supabase client initialized successfully');
    return _supabaseInstance;
}

// Get the Supabase client instance
function getSupabaseClient() {
    if (!_supabaseInstance) {
        return initSupabase();
    }
    return _supabaseInstance;
}

// ==============================================
// AUTH HELPERS
// ==============================================

async function getSession() {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
        console.error('Error getting session:', error);
        return null;
    }
    return session;
}

async function getUser() {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data: { user }, error } = await client.auth.getUser();
    if (error) {
        console.error('Error getting user:', error);
        return null;
    }
    return user;
}

async function isAuthenticatedAsync() {
    const session = await getSession();
    return !!session;
}

// ==============================================
// STORAGE HELPERS
// ==============================================

const STORAGE_BUCKET = 'expense-bills';

async function uploadImage(file, userId) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');

    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { data, error } = await client.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.error('Upload error:', error);
        throw error;
    }

    const { data: { publicUrl } } = client.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

    return {
        path: filePath,
        publicUrl: publicUrl,
        filename: file.name,
        size: file.size
    };
}

async function deleteImage(filePath) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');

    const { error } = await client.storage
        .from(STORAGE_BUCKET)
        .remove([filePath]);

    if (error) {
        console.error('Delete error:', error);
        throw error;
    }

    return true;
}

// ==============================================
// EXPORT - Make available globally
// ==============================================

window.supabaseClient = {
    init: initSupabase,
    get: getSupabaseClient,
    getSession,
    getUser,
    isAuthenticated: isAuthenticatedAsync,
    uploadImage,
    deleteImage,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    STORAGE_BUCKET
};

// Auto-initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
} else {
    initSupabase();
}
