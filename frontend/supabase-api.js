/**
 * Supabase API Wrapper for Expense Tracker
 * Replaces the Express/Railway backend with direct Supabase calls
 */

// ==============================================
// HELPER FUNCTIONS
// ==============================================

function getSupabase() {
    const client = window.supabaseClient?.get();
    if (!client) {
        console.error('Supabase client not available');
        throw new Error('Supabase client not initialized. Please refresh the page.');
    }
    return client;
}

// Performance: Use cached session instead of network call for every API request.
// supabase.auth.getUser() makes a network roundtrip each time (~100-300ms).
// supabase.auth.getSession() uses the locally-cached JWT (instant, ~0ms).
// The session is validated server-side by Supabase RLS anyway.
// Cache the user for the current page session to avoid repeated auth calls
let _cachedUser = null;
let _cachedUserTime = 0;

async function getCachedUser() {
    const supabase = getSupabase();
    // Return cached user if fresh (within 5 minutes)
    if (_cachedUser && (Date.now() - _cachedUserTime) < 300000) {
        return _cachedUser;
    }
    // First call: use getUser() to ensure token refresh, then cache
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Not authenticated');
    _cachedUser = user;
    _cachedUserTime = Date.now();
    return user;
}

// Handle Supabase errors
function handleError(error, context = 'Operation') {
    console.error(`${context} error:`, error);

    if (!navigator.onLine) {
        const offlineError = new Error('You are offline. Changes will be saved locally and synced when online.');
        offlineError.isOffline = true;
        throw offlineError;
    }

    if (error.code === 'PGRST301') {
        throw new Error('Session expired. Please log in again.');
    }

    if (error.code === '23505') {
        throw new Error('This record already exists.');
    }

    throw new Error(error.message || `${context} failed`);
}

// ==============================================
// API OBJECT
// ==============================================

const api = {
    // ==============================================
    // AUTHENTICATION
    // ==============================================

    // Register new user
    async register(name, email, password) {
        const supabase = getSupabase();

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name,
                    full_name: name
                }
            }
        });

        if (error) handleError(error, 'Registration');

        return {
            success: true,
            message: 'Registration successful! Please check your email to verify your account.',
            user: data.user
        };
    },

    // Login user
    async login(email, password) {
        const supabase = getSupabase();

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) handleError(error, 'Login');

        // Get profile data
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        // Store user info for compatibility
        const userInfo = {
            id: data.user.id,
            email: data.user.email,
            name: profile?.name || data.user.user_metadata?.name || email.split('@')[0],
            ...profile
        };

        localStorage.setItem('user', JSON.stringify(userInfo));

        return {
            success: true,
            token: data.session.access_token,
            user: userInfo
        };
    },

    // Login with Google
    async loginWithGoogle() {
        const supabase = getSupabase();

        // Check if running in Capacitor native app
        const isCapacitorApp = window.Capacitor &&
            window.Capacitor.isNativePlatform &&
            window.Capacitor.isNativePlatform();

        // Use custom URL scheme for native app, web URL for browser
        const redirectUrl = isCapacitorApp
            ? 'expensetracker://auth'
            : `${window.location.origin}/login.html`;

        console.log('Google OAuth redirect URL:', redirectUrl, 'isCapacitorApp:', isCapacitorApp);

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                queryParams: {
                    hd: 'fluxgentech.com'  // Restrict to company Google Workspace domain
                }
            }
        });

        if (error) handleError(error, 'Google login');

        return { success: true, url: data.url };
    },

    // Get current user
    async getCurrentUser() {
        const supabase = getSupabase();
        const user = await getCachedUser();

        // Get profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) handleError(profileError, 'Get profile');

        const userData = {
            id: user.id,
            email: user.email,
            ...profile
        };

        // Update localStorage
        localStorage.setItem('user', JSON.stringify(userData));

        return {
            success: true,
            data: userData
        };
    },

    // NOTE: updateProfile is defined later (line ~2574) with (updates) signature
    // Removed duplicate definition that was dead code

    // Update password
    async updatePassword(currentPassword, newPassword) {
        const supabase = getSupabase();

        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) handleError(error, 'Update password');

        return { success: true, message: 'Password updated successfully' };
    },

    // Logout
    async logout() {
        const supabase = getSupabase();
        await supabase.auth.signOut();
        localStorage.removeItem('user');
        return { success: true };
    },

    // ==============================================
    // EXPENSES
    // ==============================================

    // Get all expenses
    async getExpenses(page = 1, limit = 50, category = 'all') {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        let query = supabase
            .from('expenses')
            .select(`
                *,
                expense_images (id, storage_path, public_url, filename)
            `, { count: 'exact' })
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });

        // Apply category filter
        if (category !== 'all') {
            query = query.eq('category', category);
        }

        // Apply pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) handleError(error, 'Get expenses');

        // Transform to match old API format
        const expenses = data.map(expense => ({
            _id: expense.id,
            ...expense,
            images: (expense.expense_images || []).map(img => ({
                url: img.public_url,
                publicId: img.storage_path,
                filename: img.filename
            }))
        }));

        // Cache for offline
        if (window.offlineManager) {
            window.offlineManager.cacheExpenses(expenses);
        }

        return {
            success: true,
            data: expenses,
            pagination: {
                page,
                limit,
                total: count,
                pages: Math.ceil(count / limit)
            }
        };
    },

    // Get single expense
    async getExpense(id) {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('expenses')
            .select(`
                *,
                expense_images (id, storage_path, public_url, filename)
            `)
            .eq('id', id)
            .single();

        if (error) handleError(error, 'Get expense');

        return {
            success: true,
            data: {
                _id: data.id,
                ...data,
                images: (data.expense_images || []).map(img => ({
                    url: img.public_url,
                    publicId: img.storage_path,
                    filename: img.filename
                }))
            }
        };
    },

    // Create expense
    async createExpense(expenseData, images = []) {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Offline support
        if (!navigator.onLine && images.length === 0 && window.offlineManager) {
            await window.offlineManager.savePendingExpense(expenseData);
            return {
                success: true,
                offline: true,
                message: 'Expense saved offline. Will sync when online.'
            };
        }

        // Ensure profile exists (for Google OAuth users)
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();

        if (!profile) {
            console.log('Profile not found, creating one...');
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0],
                    email: user.email,
                    profile_picture: user.user_metadata?.avatar_url || user.user_metadata?.picture
                });

            if (profileError) {
                console.error('Failed to create profile:', profileError);
            }
        }

        // Create expense record
        const insertData = {
            user_id: user.id,
            date: expenseData.date,
            time: expenseData.time || null,
            category: expenseData.category,
            amount: parseFloat(expenseData.amount) || 0,
            vendor: expenseData.vendor || 'N/A',
            description: expenseData.description || 'N/A',
            visit_type: expenseData.visitType || null,
            payment_mode: expenseData.paymentMode || 'cash',
            bill_attached: expenseData.billAttached || 'yes'
        };
        // Add project_id if provided (company mode)
        if (expenseData.project_id) insertData.project_id = expenseData.project_id;

        const { data: expense, error: expenseError } = await supabase
            .from('expenses')
            .insert(insertData)
            .select()
            .single();

        if (expenseError) {
            console.error('Create expense error details:', expenseError);
            handleError(expenseError, 'Create expense');
        }

        // Upload images
        const uploadedImages = [];
        for (const imageFile of images) {
            try {
                const imageData = await window.supabaseClient.uploadImage(imageFile, user.id);

                // Save image record
                const { data: imgRecord, error: imgError } = await supabase
                    .from('expense_images')
                    .insert({
                        expense_id: expense.id,
                        user_id: user.id,
                        storage_path: imageData.path,
                        public_url: imageData.publicUrl,
                        filename: imageData.filename,
                        size_bytes: imageData.size
                    })
                    .select()
                    .single();

                if (!imgError) {
                    uploadedImages.push({
                        url: imageData.publicUrl,
                        publicId: imageData.path,
                        filename: imageData.filename
                    });
                }
            } catch (imgErr) {
                console.error('Image upload failed:', imgErr);
            }
        }

        return {
            success: true,
            data: {
                _id: expense.id,
                ...expense,
                images: uploadedImages
            }
        };
    },

    // Update expense
    async updateExpense(id, expenseData, images = []) {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Build update object
        const updateObj = {};
        if (expenseData.date) updateObj.date = expenseData.date;
        if (expenseData.time !== undefined) updateObj.time = expenseData.time;
        if (expenseData.category) updateObj.category = expenseData.category;
        if (expenseData.amount !== undefined) updateObj.amount = parseFloat(expenseData.amount);
        if (expenseData.vendor !== undefined) updateObj.vendor = expenseData.vendor;
        if (expenseData.description) updateObj.description = expenseData.description;
        if (expenseData.visitType !== undefined) updateObj.visit_type = expenseData.visitType;
        if (expenseData.paymentMode !== undefined) updateObj.payment_mode = expenseData.paymentMode;
        if (expenseData.billAttached !== undefined) updateObj.bill_attached = expenseData.billAttached;
        if (expenseData.project_id !== undefined) updateObj.project_id = expenseData.project_id || null;
        updateObj.updated_at = new Date().toISOString();

        const { data: expense, error } = await supabase
            .from('expenses')
            .update(updateObj)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) handleError(error, 'Update expense');

        // Upload new images
        for (const imageFile of images) {
            try {
                const imageData = await window.supabaseClient.uploadImage(imageFile, user.id);

                await supabase
                    .from('expense_images')
                    .insert({
                        expense_id: id,
                        user_id: user.id,
                        storage_path: imageData.path,
                        public_url: imageData.publicUrl,
                        filename: imageData.filename,
                        size_bytes: imageData.size
                    });
            } catch (imgErr) {
                console.error('Image upload failed:', imgErr);
            }
        }

        // Get updated expense with images
        return await this.getExpense(id);
    },

    // Delete expense
    async deleteExpense(id) {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Get images first
        const { data: images } = await supabase
            .from('expense_images')
            .select('storage_path')
            .eq('expense_id', id);

        // Delete images from storage
        if (images && images.length > 0) {
            const paths = images.map(img => img.storage_path);
            await supabase.storage.from('expense-bills').remove(paths);
        }

        // Delete expense (cascade deletes expense_images)
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) handleError(error, 'Delete expense');

        return { success: true, message: 'Expense deleted' };
    },

    // Delete image from expense
    async deleteExpenseImage(expenseId, storagePath) {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Delete from storage
        await window.supabaseClient.deleteImage(storagePath);

        // Delete record with ownership check
        const { error } = await supabase
            .from('expense_images')
            .delete()
            .eq('storage_path', storagePath)
            .eq('expense_id', expenseId);

        if (error) handleError(error, 'Delete image');

        return { success: true, message: 'Image deleted' };
    },

    // Get expense statistics
    async getExpenseStats() {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .rpc('get_expense_stats', { p_user_id: user.id });

        if (error) handleError(error, 'Get stats');

        return { success: true, data };
    },

    // ==============================================
    // CLEAR DATA
    // ==============================================

    // Clear expense data only (preserve images as orphaned)
    async clearExpenseDataOnly() {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Get all expense images
        const { data: expenseImages } = await supabase
            .from('expense_images')
            .select(`
                *,
                expenses (date, vendor, amount, category)
            `)
            .eq('user_id', user.id);

        // Move to orphaned images
        if (expenseImages && expenseImages.length > 0) {
            const orphanedRecords = expenseImages.map(img => ({
                user_id: user.id,
                storage_path: img.storage_path,
                public_url: img.public_url,
                filename: img.filename || 'unknown',
                original_expense_date: img.expenses?.date,
                original_vendor: img.expenses?.vendor,
                original_amount: img.expenses?.amount,
                original_category: img.expenses?.category,
                original_expense_id: img.expense_id,
                size_bytes: img.size_bytes
            }));

            await supabase.from('orphaned_images').insert(orphanedRecords);
        }

        // Delete all expenses (cascades to expense_images)
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('user_id', user.id);

        if (error) handleError(error, 'Clear expenses');

        const count = expenseImages?.length || 0;
        return {
            success: true,
            message: 'Expense data cleared. Images preserved.',
            orphanedCount: count,
            orphanedImagesCount: count  // script.js expects this property name
        };
    },

    // Clear images only
    async clearImagesOnly() {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Get orphaned images
        const { data: orphaned } = await supabase
            .from('orphaned_images')
            .select('storage_path')
            .eq('user_id', user.id);

        // Delete from storage
        if (orphaned && orphaned.length > 0) {
            const paths = orphaned.map(img => img.storage_path);
            await supabase.storage.from('expense-bills').remove(paths);
        }

        const deletedCount = orphaned?.length || 0;

        // Delete records
        await supabase
            .from('orphaned_images')
            .delete()
            .eq('user_id', user.id);

        return {
            success: true,
            message: 'Orphaned images cleared',
            deletedCount: deletedCount  // script.js expects this
        };
    },

    // Clear all data
    async clearAll() {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Get all images (expense + orphaned)
        const { data: expenseImages } = await supabase
            .from('expense_images')
            .select('storage_path')
            .eq('user_id', user.id);

        const { data: orphanedImages } = await supabase
            .from('orphaned_images')
            .select('storage_path')
            .eq('user_id', user.id);

        // Collect all paths
        const allPaths = [
            ...(expenseImages || []).map(img => img.storage_path),
            ...(orphanedImages || []).map(img => img.storage_path)
        ];

        // Delete from storage
        if (allPaths.length > 0) {
            await supabase.storage.from('expense-bills').remove(allPaths);
        }

        // Count before deleting
        const { count: expenseCount } = await supabase
            .from('expenses')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

        // Delete expenses (cascades to expense_images)
        const { error: expErr } = await supabase.from('expenses').delete().eq('user_id', user.id);
        if (expErr) handleError(expErr, 'Clear all expenses');

        // Delete orphaned images
        const { error: orphErr } = await supabase.from('orphaned_images').delete().eq('user_id', user.id);
        if (orphErr) handleError(orphErr, 'Clear all images');

        return {
            success: true,
            message: 'All data cleared',
            expensesCleared: expenseCount || 0,
            expenseImagesDeleted: expenseImages?.length || 0,
            orphanedImagesDeleted: orphanedImages?.length || 0
        };
    },

    // ==============================================
    // ORPHANED IMAGES
    // ==============================================

    async getOrphanedImages() {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Fetch images and stats in parallel instead of sequentially
        const [imagesResult, statsResult] = await Promise.all([
            supabase
                .from('orphaned_images')
                .select('*')
                .eq('user_id', user.id)
                .order('upload_date', { ascending: false }),
            supabase
                .rpc('get_user_storage_stats', { p_user_id: user.id })
        ]);

        const { data, error } = imagesResult;
        const { data: stats } = statsResult;

        if (error) handleError(error, 'Get orphaned images');

        const images = data.map(img => ({
            _id: img.id,
            url: img.public_url,
            publicId: img.storage_path,
            filename: img.filename,
            originalExpenseInfo: {
                date: img.original_expense_date,
                vendor: img.original_vendor,
                amount: img.original_amount,
                category: img.original_category
            },
            uploadDate: img.upload_date,
            expiryDate: img.expiry_date,
            wasExported: img.was_exported,
            preserveIndefinitely: img.preserve_indefinitely
        }));

        return {
            success: true,
            status: 'success',  // script.js checks for this
            images: images,      // script.js expects 'images' not 'data'
            data: images,        // keep for compatibility
            stats: {
                totalImages: stats?.total_images,
                totalSizeMB: stats?.total_size_mb ?? '0.00',
                exportedCount: stats?.exported_count ?? 0,
                expiringWithin7Days: stats?.expiring_within_7_days ?? 0,
                preservedCount: stats?.preserved_count ?? 0
            }
        };
    },

    async deleteOrphanedImage(imageId) {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Get image path first with ownership check
        const { data: img } = await supabase
            .from('orphaned_images')
            .select('storage_path')
            .eq('id', imageId)
            .eq('user_id', user.id)
            .single();

        if (img) {
            // Delete from storage
            await supabase.storage.from('expense-bills').remove([img.storage_path]);
        }

        // Delete record with ownership check
        const { error } = await supabase
            .from('orphaned_images')
            .delete()
            .eq('id', imageId)
            .eq('user_id', user.id);

        if (error) handleError(error, 'Delete orphaned image');

        return { success: true };
    },

    async extendOrphanedImageExpiry(imageId, days = 30) {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .rpc('extend_orphaned_image_expiry', {
                p_image_id: imageId,
                p_days: days
            });

        if (error) handleError(error, 'Extend expiry');

        return { success: true, data };
    },

    // ==============================================
    // GOOGLE SHEETS (via Apps Script)
    // ==============================================

    // Apps Script Web App URL
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw30RWs5YAt0K3SNnwh_32KgKbYwKyjj2ii40FiaBa-yARcX5rr6KkqzJFdWtjhAPGS9Q/exec',

    // Helper to call Apps Script
    async callAppsScript(data) {
        try {
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
                console.log('Apps Script response:', text);
                return { status: 'success', data: {} };
            }
        } catch (error) {
            console.error('Apps Script call error:', error);
            throw error;
        }
    },

    // Get sheet ID from googleSheetsService or database
    async getSheetId() {
        // First try googleSheetsService
        if (window.googleSheetsService?.sheetId) {
            return window.googleSheetsService.sheetId;
        }

        // Fall back to database
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('profiles')
            .select('google_sheet_id')
            .eq('id', user.id)
            .single();

        return profile?.google_sheet_id;
    },

    async getGoogleSheetLink() {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('profiles')
            .select('google_sheet_id, google_sheet_url')
            .eq('id', user.id)
            .single();

        return {
            success: true,
            hasSheet: !!profile?.google_sheet_id,
            sheetUrl: profile?.google_sheet_url
        };
    },

    async exportToGoogleSheets(expenses) {
        // This is handled by googleSheetsService.exportExpenses()
        // But provide a fallback here
        if (window.googleSheetsService) {
            return await window.googleSheetsService.exportExpenses(expenses);
        }
        throw new Error('Google Sheets service not available');
    },

    async createGoogleSheet() {
        // This is handled by googleSheetsService.createSheet()
        if (window.googleSheetsService) {
            return await window.googleSheetsService.createSheet();
        }
        throw new Error('Google Sheets service not available');
    },

    async exportGoogleSheetAsPdf() {
        const sheetId = await this.getSheetId();
        if (!sheetId) {
            throw new Error('No Google Sheet found. Please create one first.');
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');

        const result = await this.callAppsScript({
            action: 'exportPdf',
            sheetId: sheetId,
            userEmail: user.email
        });

        if (result.status === 'success' && result.data) {
            return {
                success: true,
                data: {
                    pdfBase64: result.data.pdfBase64,
                    fileName: result.data.fileName,
                    size: result.data.size
                },
                message: 'PDF exported successfully'
            };
        } else {
            throw new Error(result.message || 'Failed to export PDF');
        }
    },

    async resetGoogleSheet() {
        const sheetId = await this.getSheetId();
        if (!sheetId) {
            throw new Error('No Google Sheet found. Please create one first.');
        }

        const result = await this.callAppsScript({
            action: 'resetSheet',
            sheetId: sheetId
        });

        if (result.status === 'success') {
            return {
                success: true,
                message: 'Sheet reset to template successfully'
            };
        } else {
            throw new Error(result.message || 'Failed to reset sheet');
        }
    },

    async updateEmployeeInfo(employeeData) {
        const sheetId = await this.getSheetId();
        if (!sheetId) {
            throw new Error('No Google Sheet found. Please create one first.');
        }

        const result = await this.callAppsScript({
            action: 'updateEmployeeInfo',
            sheetId: sheetId,
            employeeData: employeeData
        });

        if (result.status === 'success') {
            return {
                success: true,
                message: 'Employee information updated successfully'
            };
        } else {
            throw new Error(result.message || 'Failed to update employee info');
        }
    },

    // ==============================================
    // WHATSAPP (via Edge Functions)
    // ==============================================

    async getWhatsAppStatus() {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('profiles')
            .select('whatsapp_number, whatsapp_notifications')
            .eq('id', user.id)
            .single();

        return {
            success: true,
            configured: !!profile?.whatsapp_number,
            phoneNumber: profile?.whatsapp_number,
            notificationsEnabled: profile?.whatsapp_notifications
        };
    },

    async setupWhatsApp(phoneNumber, enableNotifications = true) {
        const supabase = getSupabase();

        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('profiles')
            .update({
                whatsapp_number: phoneNumber,
                whatsapp_notifications: enableNotifications
            })
            .eq('id', user.id)
            .select()
            .single();

        if (error) handleError(error, 'Setup WhatsApp');

        return { success: true, data };
    },

    async sendWhatsAppSummary(period = 'month') {
        const supabase = getSupabase();

        const { data, error } = await supabase.functions.invoke('whatsapp-send-summary', {
            body: { period }
        });

        if (error) handleError(error, 'Send summary');

        return data;
    },

    async testWhatsApp() {
        const supabase = getSupabase();

        const { data, error } = await supabase.functions.invoke('whatsapp-test', {});

        if (error) handleError(error, 'Test WhatsApp');

        return data;
    },

    // ==============================================
    // REIMBURSEMENT PDF LIBRARY
    // ==============================================

    async saveReimbursementPdf({ storagePath, filename, fileSize, pageCount, totalAmount, dateFrom, dateTo, purpose, source = 'uploaded' }) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('reimbursement_pdfs')
            .insert({
                user_id: user.id,
                storage_path: storagePath,
                filename,
                file_size: fileSize || null,
                page_count: pageCount || 1,
                total_amount: totalAmount || null,
                date_from: dateFrom || null,
                date_to: dateTo || null,
                purpose: purpose || null,
                source
            })
            .select()
            .single();

        if (error) handleError(error, 'Save PDF');
        return data;
    },

    async listReimbursementPdfs() {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('reimbursement_pdfs')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) handleError(error, 'List PDFs');
        return data || [];
    },

    async deleteReimbursementPdf(id, storagePath) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Delete from storage
        if (storagePath) {
            await supabase.storage.from('expense-bills').remove([storagePath]);
        }

        // Delete DB row
        const { error } = await supabase
            .from('reimbursement_pdfs')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) handleError(error, 'Delete PDF');
        return { success: true };
    },

    // ---- Activity Log ----
    async logActivity(action, details = '', metadata = {}) {
        try {
            const supabase = getSupabase();
            const user = await getCachedUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('activity_log')
                .insert({
                    user_id: user.id,
                    action,
                    details: details || null,
                    metadata: metadata || {}
                })
                .select()
                .single();

            if (error) console.warn('Activity log error:', error.message);
            return data;
        } catch (err) {
            console.warn('Activity log failed:', err.message);
            return null;
        }
    },

    // ==============================================
    // KODO CLAIMS TRACKING
    // ==============================================

    async saveKodoClaim({ claimId, amount, checkerName, categoryName, comment }) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('kodo_claims')
            .insert({
                user_id: user.id,
                claim_id: claimId,
                amount,
                checker_name: checkerName || null,
                category_name: categoryName || null,
                comment: comment || null,
                status: 'pending'
            })
            .select()
            .single();

        if (error) handleError(error, 'Save Kodo claim');
        return data;
    },

    async getKodoClaims(statusFilter = null) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        let query = supabase
            .from('kodo_claims')
            .select('*')
            .eq('user_id', user.id)
            .order('submitted_at', { ascending: false });

        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (error) handleError(error, 'Get Kodo claims');
        return data || [];
    },

    async updateKodoClaimStatus(claimId, status, rawStatus = null) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const updateObj = {
            status,
            last_checked_at: new Date().toISOString(),
            status_updated_at: new Date().toISOString()
        };
        if (rawStatus) updateObj.kodo_status_raw = rawStatus;

        const { data, error } = await supabase
            .from('kodo_claims')
            .update(updateObj)
            .eq('claim_id', claimId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) handleError(error, 'Update claim status');
        return data;
    },

    // ==============================================
    // ADVANCES
    // ==============================================

    async createAdvance(projectName, amount, notes = '', visitType = 'project', managerId = null, accountantId = null) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Check if company mode — require approval
        const profile = await this._getProfile(user.id);
        const isCompany = !!(profile?.organization_id);

        const insertObj = {
            user_id: user.id,
            project_name: projectName.trim(),
            amount: parseFloat(amount),
            notes: notes || null,
            visit_type: visitType || 'project'
        };

        // Always set organization_id in company mode so admin/accountant can see it
        if (isCompany) {
            insertObj.organization_id = profile.organization_id;
            console.log('Creating advance with organization_id:', profile.organization_id);
        } else {
            console.log('Creating advance in personal mode (no org_id). isCompany:', isCompany, 'profile:', profile);
        }

        if (isCompany && managerId && accountantId) {
            insertObj.status = 'pending_manager';
            insertObj.manager_id = managerId;
            insertObj.accountant_id = accountantId;
            insertObj.submitted_at = new Date().toISOString();
        } else if (isCompany) {
            // Company mode but no approvers selected — still visible to admin, active immediately
            insertObj.status = 'active';
        }
        // Personal mode (no org) → active immediately (legacy behavior)

        const { data, error } = await supabase
            .from('advances')
            .insert(insertObj)
            .select()
            .single();

        if (error) handleError(error, 'Create advance');

        // Add history entry for company mode
        if (isCompany && managerId && data) {
            await supabase.from('advance_history').insert({
                advance_id: data.id,
                action: 'submitted',
                acted_by: user.id,
                comments: `Advance of ₹${parseFloat(amount).toLocaleString('en-IN')} for ${projectName}`,
                new_status: 'pending_manager',
                created_at: new Date().toISOString()
            });
        }

        return { success: true, data };
    },

    async _getProfile(userId) {
        const supabase = getSupabase();
        const { data } = await supabase.from('profiles').select('organization_id').eq('id', userId).single();
        return data;
    },

    async getAdvances(status = null) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        let query = supabase
            .from('advances')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) handleError(error, 'Get advances');
        return data || [];
    },

    async getAdvanceWithBalance(advanceId) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Get advance
        const { data: advance, error: advError } = await supabase
            .from('advances')
            .select('*')
            .eq('id', advanceId)
            .eq('user_id', user.id)
            .single();

        if (advError) handleError(advError, 'Get advance');

        // Get total spent from linked expenses
        const { data: expenses, error: expError } = await supabase
            .from('expenses')
            .select('amount')
            .eq('advance_id', advanceId)
            .eq('user_id', user.id);

        if (expError) handleError(expError, 'Get advance expenses');

        const totalSpent = (expenses || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        return {
            ...advance,
            totalSpent,
            remaining: advance.amount - totalSpent,
            percentUsed: advance.amount > 0 ? (totalSpent / advance.amount) * 100 : 0
        };
    },

    async getAdvancesWithBalances() {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Get all advances
        const { data: advances, error: advError } = await supabase
            .from('advances')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (advError) handleError(advError, 'Get advances');
        if (!advances || advances.length === 0) return [];

        // Get all expenses with advance_id
        const { data: expenses, error: expError } = await supabase
            .from('expenses')
            .select('advance_id, amount')
            .eq('user_id', user.id)
            .not('advance_id', 'is', null);

        if (expError) handleError(expError, 'Get advance expenses');

        // Group spent amounts by advance_id
        const spentByAdvance = {};
        (expenses || []).forEach(e => {
            if (e.advance_id) {
                spentByAdvance[e.advance_id] = (spentByAdvance[e.advance_id] || 0) + (parseFloat(e.amount) || 0);
            }
        });

        return advances.map(adv => {
            const totalSpent = spentByAdvance[adv.id] || 0;
            return {
                ...adv,
                totalSpent,
                remaining: adv.amount - totalSpent,
                percentUsed: adv.amount > 0 ? (totalSpent / adv.amount) * 100 : 0
            };
        });
    },

    async getActiveAdvanceForProject(projectName) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('advances')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .ilike('project_name', projectName.trim())
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') handleError(error, 'Get advance for project');
        return data || null;
    },

    async updateAdvance(advanceId, updates) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const updateObj = {};
        if (updates.projectName !== undefined) updateObj.project_name = updates.projectName;
        if (updates.amount !== undefined) updateObj.amount = parseFloat(updates.amount);
        if (updates.status !== undefined) updateObj.status = updates.status;
        if (updates.notes !== undefined) updateObj.notes = updates.notes;
        if (updates.visitType !== undefined) updateObj.visit_type = updates.visitType;

        const { data, error } = await supabase
            .from('advances')
            .update(updateObj)
            .eq('id', advanceId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) handleError(error, 'Update advance');
        return { success: true, data };
    },

    async deleteAdvance(advanceId) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Unlink expenses first
        await supabase
            .from('expenses')
            .update({ advance_id: null })
            .eq('advance_id', advanceId)
            .eq('user_id', user.id);

        const { error } = await supabase
            .from('advances')
            .delete()
            .eq('id', advanceId)
            .eq('user_id', user.id);

        if (error) handleError(error, 'Delete advance');
        return { success: true };
    },

    async linkExpenseToAdvance(expenseId, advanceId) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('expenses')
            .update({ advance_id: advanceId })
            .eq('id', expenseId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) handleError(error, 'Link expense to advance');
        return { success: true, data };
    },

    async unlinkExpenseFromAdvance(expenseId) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('expenses')
            .update({ advance_id: null })
            .eq('id', expenseId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) handleError(error, 'Unlink expense from advance');
        return { success: true, data };
    },

    async moveExpenseToAdvance(expenseId, newAdvanceId) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('expenses')
            .update({ advance_id: newAdvanceId })
            .eq('id', expenseId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) handleError(error, 'Move expense to advance');
        return { success: true, data };
    },

    // ==============================================
    // ADVANCE APPROVAL
    // ==============================================

    async getAdvancesForApproval() {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase.from('profiles').select('role, organization_id').eq('id', user.id).single();
        const role = profile?.role || 'employee';

        let query = supabase.from('advances').select('*, submitter:user_id(id, name, employee_id, email)');

        if (role === 'manager') {
            query = query.eq('manager_id', user.id).in('status', ['pending_manager']);
        } else if (role === 'accountant') {
            const orgId = profile?.organization_id;
            if (orgId) query = query.eq('organization_id', orgId).in('status', ['pending_accountant']);
        } else if (role === 'admin') {
            const orgId = profile?.organization_id;
            if (orgId) query = query.eq('organization_id', orgId).in('status', ['pending_manager', 'pending_accountant']);
        } else {
            query = query.eq('user_id', user.id);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) handleError(error, 'Get advances for approval');
        return data || [];
    },

    async getAdvanceDetail(advanceId) {
        const supabase = getSupabase();

        // Fetch advance + history in parallel
        const [advRes, histRes] = await Promise.all([
            supabase.from('advances').select('*').eq('id', advanceId).single(),
            supabase.from('advance_history').select('*').eq('advance_id', advanceId).order('created_at', { ascending: true })
        ]);

        if (advRes.error) handleError(advRes.error, 'Get advance detail');
        const advance = advRes.data;
        const history = histRes.data || [];

        // Collect all profile IDs needed (advance people + history actors) in one batch
        const allIds = new Set([advance.user_id, advance.manager_id, advance.accountant_id, ...history.map(h => h.acted_by)].filter(Boolean));
        let profileMap = {};
        if (allIds.size > 0) {
            const { data: pList } = await supabase.from('profiles').select('id, name, email, profile_picture').in('id', [...allIds]);
            if (pList) pList.forEach(p => profileMap[p.id] = p);
        }

        advance.submitter = profileMap[advance.user_id] || null;
        advance.manager = profileMap[advance.manager_id] || null;
        advance.accountant = profileMap[advance.accountant_id] || null;
        history.forEach(h => h.actor = profileMap[h.acted_by] || null);

        return { ...advance, history };
    },

    async approveAdvance(advanceId, comments = '') {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Get current advance
        const { data: advance } = await supabase.from('advances').select('*').eq('id', advanceId).single();
        if (!advance) throw new Error('Advance not found');

        // Get approver's role
        const { data: approverProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        const role = approverProfile?.role || 'employee';
        const isAdmin = role === 'admin';
        const isAccountant = role === 'accountant';

        let newStatus, action;
        if (advance.status === 'pending_manager' && (advance.manager_id === user.id || isAdmin)) {
            newStatus = 'pending_accountant';
            action = 'manager_approved';
        } else if (advance.status === 'pending_accountant' && (advance.accountant_id === user.id || isAdmin || isAccountant)) {
            newStatus = 'active';
            action = 'accountant_approved';
        } else {
            throw new Error('You are not authorized to approve this advance');
        }

        const updateObj = { status: newStatus };
        if (action === 'manager_approved') updateObj.manager_action_at = new Date().toISOString();
        if (action === 'accountant_approved') updateObj.accountant_action_at = new Date().toISOString();

        const { error } = await supabase
            .from('advances')
            .update(updateObj)
            .eq('id', advanceId);

        if (error) handleError(error, 'Approve advance');

        // Add history
        await supabase.from('advance_history').insert({
            advance_id: advanceId,
            action,
            acted_by: user.id,
            comments: comments || null,
            previous_status: advance.status,
            new_status: newStatus
        });

        // Notify employee
        const amt = `₹${Number(advance.amount).toLocaleString('en-IN')}`;
        if (action === 'manager_approved') {
            this.createNotification(advance.user_id, 'advance_approved', 'Advance approved by manager',
                `Your advance of ${amt} for ${advance.project_name} has been approved by manager. Now pending accountant verification.`, advanceId);
            // Notify accountant
            if (advance.accountant_id) {
                this.createNotification(advance.accountant_id, 'advance_submitted', 'Advance ready for verification',
                    `Advance of ${amt} for ${advance.project_name} has been approved by manager and is ready for your verification.`, advanceId);
            }
        } else if (action === 'accountant_approved') {
            this.createNotification(advance.user_id, 'advance_approved', 'Advance fully approved!',
                `Your advance of ${amt} for ${advance.project_name} has been fully approved and is now active.`, advanceId);

            // Create payment transaction
            try {
                const bankDetails = await this.getBankDetailsForUser(advance.user_id);
                const txn = await this.createPaymentTransaction(
                    advanceId, advance.user_id, advance.organization_id,
                    advance.amount, bankDetails?.preferred_method || 'manual', user.id
                );
                await supabase.from('advances')
                    .update({ payment_status: 'pending', payment_transaction_id: txn.id })
                    .eq('id', advanceId);

                if (!bankDetails) {
                    this.createNotification(advance.user_id, 'system', 'Add bank details',
                        `Your advance of ${amt} is approved. Please add your bank details in Profile to receive payment.`, advanceId);
                }
            } catch (payErr) {
                console.warn('Payment transaction creation failed (non-blocking):', payErr);
            }
        }

        return { success: true, newStatus };
    },

    async rejectAdvance(advanceId, reason = '') {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data: advance } = await supabase.from('advances').select('*').eq('id', advanceId).single();
        if (!advance) throw new Error('Advance not found');

        const action = advance.status === 'pending_manager' ? 'manager_rejected' : 'accountant_rejected';

        const { error } = await supabase
            .from('advances')
            .update({
                status: 'rejected',
                rejection_reason: reason || null,
                rejected_by: user.id
            })
            .eq('id', advanceId);

        if (error) handleError(error, 'Reject advance');

        await supabase.from('advance_history').insert({
            advance_id: advanceId,
            action,
            acted_by: user.id,
            comments: reason || null,
            previous_status: advance.status,
            new_status: 'rejected'
        });

        // Notify employee
        const amt = `₹${Number(advance.amount).toLocaleString('en-IN')}`;
        const rejector = action === 'manager_rejected' ? 'manager' : 'accountant';
        this.createNotification(advance.user_id, 'advance_rejected', 'Advance rejected',
            `Your advance of ${amt} for ${advance.project_name} was rejected by ${rejector}.${reason ? ' Reason: ' + reason : ''}`, advanceId);

        return { success: true };
    },

    async resubmitAdvance(advanceId) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('advances')
            .update({
                status: 'pending_manager',
                rejection_reason: null,
                rejected_by: null,
                submitted_at: new Date().toISOString()
            })
            .eq('id', advanceId)
            .eq('user_id', user.id);

        if (error) handleError(error, 'Resubmit advance');

        await supabase.from('advance_history').insert({
            advance_id: advanceId,
            action: 'resubmitted',
            acted_by: user.id,
            previous_status: 'rejected',
            new_status: 'pending_manager'
        });

        return { success: true };
    },

    async getActivityLog(limit = 50) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('activity_log')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) handleError(error, 'Get Activity Log');
        return data || [];
    },

    // ==============================================
    // ORGANIZATION & EMPLOYEE MANAGEMENT
    // ==============================================

    async createOrganization(name, domain = null) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .insert({ name, domain, created_by: user.id })
            .select()
            .single();

        if (orgError) handleError(orgError, 'Create organization');

        // Set current user as admin of this org
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                organization_id: org.id,
                role: 'admin'
            })
            .eq('id', user.id);

        if (profileError) handleError(profileError, 'Set admin role');

        return { success: true, data: org };
    },

    async getOrganization() {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return null;

        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profile.organization_id)
            .single();

        if (error) return null;
        return data;
    },

    async importEmployees(orgId, employees) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Upsert employees into whitelist
        const records = employees.map(emp => ({
            organization_id: orgId,
            employee_id: emp.employee_id,
            name: emp.name,
            email: emp.email.toLowerCase().trim(),
            department: emp.department || null,
            designation: emp.designation || null,
            reporting_manager_email: emp.reporting_manager_email?.toLowerCase().trim() || null,
            role: emp.role || 'employee',
            is_active: true
        }));

        const { data, error } = await supabase
            .from('employee_whitelist')
            .upsert(records, { onConflict: 'organization_id,email' })
            .select();

        if (error) handleError(error, 'Import employees');

        // Update profiles of existing users who match whitelist emails
        for (const emp of records) {
            await supabase
                .from('profiles')
                .update({
                    employee_id: emp.employee_id,
                    department: emp.department,
                    designation: emp.designation,
                    role: emp.role,
                    organization_id: orgId
                })
                .eq('email', emp.email)
                .is('organization_id', null);
        }

        // Resolve manager IDs
        await supabase.rpc('resolve_manager_ids', { p_org_id: orgId });

        return { success: true, imported: data?.length || 0 };
    },

    async getEmployeeWhitelist(orgId) {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('employee_whitelist')
            .select('*')
            .eq('organization_id', orgId)
            .order('name');

        if (error) handleError(error, 'Get employee whitelist');
        return data || [];
    },

    async getOrgMembers(orgId, role = null) {
        const supabase = getSupabase();

        let query = supabase
            .from('profiles')
            .select('id, name, email, employee_id, department, designation, role, profile_picture')
            .eq('organization_id', orgId)
            .order('name');

        if (role) {
            query = query.eq('role', role);
        }

        const { data, error } = await query;
        if (error) handleError(error, 'Get org members');
        return data || [];
    },

    async updateEmployeeRole(profileId, role) {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', profileId)
            .select()
            .single();

        if (error) handleError(error, 'Update employee role');
        return { success: true, data };
    },

    async updateEmployeeWhitelist(whitelistId, updates) {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('employee_whitelist')
            .update(updates)
            .eq('id', whitelistId)
            .select()
            .single();

        if (error) handleError(error, 'Update whitelist entry');
        return { success: true, data };
    },

    async deactivateEmployee(whitelistId) {
        return this.updateEmployeeWhitelist(whitelistId, { is_active: false });
    },

    // ==============================================
    // PROJECT MANAGEMENT
    // ==============================================

    async getProjects(orgId, status = null) {
        const supabase = getSupabase();

        let query = supabase
            .from('projects')
            .select('*')
            .eq('organization_id', orgId)
            .order('project_code', { ascending: true });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) handleError(error, 'Get projects');
        return data || [];
    },

    async createProject(orgId, projectData) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Use provided code or auto-generate
        let projectCode = projectData.project_code;
        if (!projectCode) {
            const { data: codeResult } = await supabase.rpc('generate_project_code', { p_org_id: orgId });
            projectCode = codeResult || `PRJ-${new Date().getFullYear()}-${Date.now().toString().slice(-3)}`;
        }

        const { data, error } = await supabase
            .from('projects')
            .insert({
                organization_id: orgId,
                project_code: projectCode,
                project_name: projectData.project_name,
                client_name: projectData.client_name || null,
                status: projectData.status || 'active',
                budget: projectData.budget ? parseFloat(projectData.budget) : null,
                description: projectData.description || null,
                start_date: projectData.start_date || null,
                end_date: projectData.end_date || null,
                created_by: user.id
            })
            .select()
            .single();

        if (error) handleError(error, 'Create project');
        return { success: true, data };
    },

    async updateProject(projectId, updates) {
        const supabase = getSupabase();

        const updateData = {};
        if (updates.project_name !== undefined) updateData.project_name = updates.project_name;
        if (updates.client_name !== undefined) updateData.client_name = updates.client_name;
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.budget !== undefined) updateData.budget = updates.budget ? parseFloat(updates.budget) : null;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.start_date !== undefined) updateData.start_date = updates.start_date;
        if (updates.end_date !== undefined) updateData.end_date = updates.end_date;

        const { data, error } = await supabase
            .from('projects')
            .update(updateData)
            .eq('id', projectId)
            .select()
            .single();

        if (error) handleError(error, 'Update project');
        return { success: true, data };
    },

    async importProjects(orgId, projectsArray) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Get existing project codes to avoid duplicates
        const { data: existing } = await supabase
            .from('projects')
            .select('project_code')
            .eq('organization_id', orgId);
        const existingCodes = new Set((existing || []).map(p => p.project_code));

        const toInsert = projectsArray
            .filter(p => p.project_code && p.project_name && !existingCodes.has(p.project_code))
            .map(p => ({
                organization_id: orgId,
                project_code: p.project_code,
                project_name: p.project_name,
                client_name: p.client_name || null,
                description: p.sector ? `Sector: ${p.sector}` : null,
                status: 'active',
                created_by: user.id
            }));

        if (toInsert.length === 0) return { imported: 0, skipped: projectsArray.length };

        const { data, error } = await supabase
            .from('projects')
            .insert(toInsert)
            .select();

        if (error) handleError(error, 'Import projects');
        return { imported: (data || []).length, skipped: projectsArray.length - (data || []).length };
    },

    async deleteProject(projectId) {
        const supabase = getSupabase();

        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (error) handleError(error, 'Delete project');
        return { success: true };
    },

    async getProjectByCode(orgId, projectCode) {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('organization_id', orgId)
            .eq('project_code', projectCode)
            .single();

        if (error) return null;
        return data;
    },

    // ==============================================
    // VOUCHER & APPROVAL WORKFLOW
    // ==============================================

    async createVoucher(orgId, managerId, accountantId, expenseIds, purpose = '', advanceId = null, projectId = null, attachments = {}, extras = {}) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Generate voucher number
        const { data: voucherNum } = await supabase.rpc('generate_voucher_number', { p_org_id: orgId });

        // Calculate total from expenses
        const { data: expenses } = await supabase
            .from('expenses')
            .select('amount')
            .in('id', expenseIds);

        const totalAmount = (expenses || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        // Create voucher — only include fields that have values
        const insertObj = {
            organization_id: orgId,
            voucher_number: voucherNum || `VCH-${Date.now()}`,
            submitted_by: user.id,
            manager_id: managerId,
            accountant_id: accountantId,
            status: 'pending_manager',
            total_amount: totalAmount,
            expense_count: expenseIds.length,
            submitted_at: new Date().toISOString()
        };
        // Optional fields — only add if they have values (avoids 400 if column doesn't exist)
        if (advanceId) insertObj.advance_id = advanceId;
        if (projectId) insertObj.project_id = projectId;
        if (purpose) insertObj.purpose = purpose;
        if (attachments.sheetUrl) insertObj.google_sheet_url = attachments.sheetUrl;
        if (attachments.pdfUrl) insertObj.pdf_url = attachments.pdfUrl;
        if (attachments.pdfFilename) insertObj.pdf_filename = attachments.pdfFilename;
        // Note: period_from, period_to, declaration_accepted columns don't exist in vouchers table

        const { data: voucher, error: vError } = await supabase
            .from('vouchers')
            .insert(insertObj)
            .select()
            .single();

        if (vError) handleError(vError, 'Create voucher');

        // Link expenses to voucher via junction table
        const links = expenseIds.map(eid => ({ voucher_id: voucher.id, expense_id: eid }));
        const { error: linkError } = await supabase
            .from('voucher_expenses')
            .insert(links);

        if (linkError) {
            console.error('Failed to link expenses to voucher:', linkError);
            // Critical: if junction fails, expenses won't show in voucher detail
        } else {
            console.log(`Linked ${expenseIds.length} expenses to voucher ${voucher.voucher_number}`);
        }

        // Update expense voucher_status
        await supabase
            .from('expenses')
            .update({ voucher_status: 'submitted' })
            .in('id', expenseIds)
            .eq('user_id', user.id);

        // Add history entry
        await supabase.from('voucher_history').insert({
            voucher_id: voucher.id,
            action: 'submitted',
            acted_by: user.id,
            previous_status: 'draft',
            new_status: 'pending_manager',
            comments: purpose || 'Voucher submitted for approval'
        });

        return { success: true, data: voucher };
    },

    async getMyVouchers(status = null) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        let query = supabase
            .from('vouchers')
            .select(`
                *,
                manager:manager_id(id, name, email, profile_picture),
                accountant:accountant_id(id, name, email, profile_picture),
                project:project_id(id, project_code, project_name)
            `)
            .eq('submitted_by', user.id)
            .order('created_at', { ascending: false });

        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) handleError(error, 'Get my vouchers');
        return data || [];
    },

    async getVouchersForApproval() {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        let query = supabase
            .from('vouchers')
            .select(`
                *,
                submitter:submitted_by(id, name, email, employee_id, profile_picture),
                manager:manager_id(id, name, email),
                accountant:accountant_id(id, name, email),
                project:project_id(id, project_code, project_name)
            `)
            .order('submitted_at', { ascending: false });

        // Manager sees pending_manager vouchers assigned to them
        // Accountant sees manager_approved vouchers assigned to them
        if (profile?.role === 'manager') {
            query = query.eq('manager_id', user.id).in('status', ['pending_manager']);
        } else if (profile?.role === 'accountant') {
            query = query.eq('accountant_id', user.id).in('status', ['manager_approved', 'pending_accountant']);
        } else if (profile?.role === 'admin') {
            // Admin sees only pending org vouchers (not already approved/closed)
            const { data: p } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
            if (p?.organization_id) query = query.eq('organization_id', p.organization_id).in('status', ['pending_manager', 'pending_accountant', 'manager_approved']);
        }

        const { data, error } = await query;
        if (error) handleError(error, 'Get vouchers for approval');
        return data || [];
    },

    async getVoucherDetail(voucherId) {
        const supabase = getSupabase();

        // Fetch voucher + expense links + history in parallel
        const [vRes, linkRes, histRes] = await Promise.all([
            supabase.from('vouchers').select(`*, submitter:submitted_by(id, name, email, employee_id, department, profile_picture), manager:manager_id(id, name, email, profile_picture), accountant:accountant_id(id, name, email, profile_picture), project:project_id(id, project_code, project_name, client_name), advance:advance_id(id, project_name, amount)`).eq('id', voucherId).single(),
            supabase.from('voucher_expenses').select('expense_id').eq('voucher_id', voucherId),
            supabase.from('voucher_history').select('*, actor:acted_by(id, name, profile_picture)').eq('voucher_id', voucherId).order('created_at', { ascending: true })
        ]);

        if (vRes.error) handleError(vRes.error, 'Get voucher detail');
        const voucher = vRes.data;

        // Fetch expenses if any links found
        const expenseIds = (linkRes.data || []).map(l => l.expense_id);
        let expenses = [];
        if (expenseIds.length > 0) {
            const { data: expData } = await supabase
                .from('expenses')
                .select('*, expense_images(*)')
                .in('id', expenseIds)
                .order('date', { ascending: true });
            expenses = expData || [];
        }

        return { ...voucher, expenses, history: histRes.data || [] };
    },

    async approveVoucher(voucherId, comments = '') {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Get current voucher to determine next status
        const { data: voucher } = await supabase
            .from('vouchers')
            .select('status, manager_id, accountant_id')
            .eq('id', voucherId)
            .single();

        if (!voucher) throw new Error('Voucher not found');

        let newStatus, action, actionTimestamp;

        if (voucher.status === 'pending_manager' && voucher.manager_id === user.id) {
            newStatus = 'pending_accountant';
            action = 'manager_approved';
            actionTimestamp = { manager_action_at: new Date().toISOString() };
        } else if (['manager_approved', 'pending_accountant'].includes(voucher.status) && voucher.accountant_id === user.id) {
            newStatus = 'approved';
            action = 'accountant_approved';
            actionTimestamp = { accountant_action_at: new Date().toISOString() };
        } else {
            throw new Error('You are not authorized to approve this voucher in its current state');
        }

        // Update voucher
        const { error: updateErr } = await supabase
            .from('vouchers')
            .update({ status: newStatus, ...actionTimestamp })
            .eq('id', voucherId);

        if (updateErr) handleError(updateErr, 'Approve voucher');

        // If fully approved, update expense statuses
        if (newStatus === 'approved') {
            const { data: links } = await supabase
                .from('voucher_expenses')
                .select('expense_id')
                .eq('voucher_id', voucherId);

            if (links?.length > 0) {
                await supabase
                    .from('expenses')
                    .update({ voucher_status: 'approved' })
                    .in('id', links.map(l => l.expense_id));
            }
        }

        // Add history
        await supabase.from('voucher_history').insert({
            voucher_id: voucherId,
            action,
            acted_by: user.id,
            comments: comments || null,
            previous_status: voucher.status,
            new_status: newStatus
        });

        return { success: true, newStatus };
    },

    async rejectVoucher(voucherId, reason) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        if (!reason || !reason.trim()) throw new Error('Rejection reason is required');

        const { data: voucher } = await supabase
            .from('vouchers')
            .select('status, manager_id, accountant_id')
            .eq('id', voucherId)
            .single();

        if (!voucher) throw new Error('Voucher not found');

        let action;
        if (voucher.status === 'pending_manager' && voucher.manager_id === user.id) {
            action = 'manager_rejected';
        } else if (['manager_approved', 'pending_accountant'].includes(voucher.status) && voucher.accountant_id === user.id) {
            action = 'accountant_rejected';
        } else {
            throw new Error('You are not authorized to reject this voucher in its current state');
        }

        // Update voucher to rejected
        const { error } = await supabase
            .from('vouchers')
            .update({
                status: 'rejected',
                rejection_reason: reason,
                rejected_by: user.id
            })
            .eq('id', voucherId);

        if (error) handleError(error, 'Reject voucher');

        // Update expense statuses back to rejected
        const { data: links } = await supabase
            .from('voucher_expenses')
            .select('expense_id')
            .eq('voucher_id', voucherId);

        if (links?.length > 0) {
            await supabase
                .from('expenses')
                .update({ voucher_status: 'rejected' })
                .in('id', links.map(l => l.expense_id));
        }

        // Add history
        await supabase.from('voucher_history').insert({
            voucher_id: voucherId,
            action,
            acted_by: user.id,
            comments: reason,
            previous_status: voucher.status,
            new_status: 'rejected'
        });

        return { success: true };
    },

    async resubmitVoucher(voucherId, notes = '') {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Update voucher back to pending_manager
        const { data: voucher, error } = await supabase
            .from('vouchers')
            .update({
                status: 'pending_manager',
                rejection_reason: null,
                rejected_by: null,
                submitted_at: new Date().toISOString()
            })
            .eq('id', voucherId)
            .eq('submitted_by', user.id)
            .select()
            .single();

        if (error) handleError(error, 'Resubmit voucher');

        // Update expense statuses
        const { data: links } = await supabase
            .from('voucher_expenses')
            .select('expense_id')
            .eq('voucher_id', voucherId);

        if (links?.length > 0) {
            await supabase
                .from('expenses')
                .update({ voucher_status: 'submitted' })
                .in('id', links.map(l => l.expense_id));
        }

        // Add history
        await supabase.from('voucher_history').insert({
            voucher_id: voucherId,
            action: 'resubmitted',
            acted_by: user.id,
            comments: notes || 'Voucher resubmitted after corrections',
            previous_status: 'rejected',
            new_status: 'pending_manager'
        });

        return { success: true, data: voucher };
    },

    async getOrgMembersByRole(orgId, role) {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('profiles')
            .select('id, name, email, employee_id, department, profile_picture')
            .eq('organization_id', orgId)
            .eq('role', role)
            .order('name');

        if (error) handleError(error, `Get ${role}s`);
        return data || [];
    },

    // ==============================================
    // BANK DETAILS & PAYMENTS
    // ==============================================

    async getBankDetails() {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) return null;
        const { data, error } = await supabase
            .from('employee_bank_details')
            .select('*')
            .eq('user_id', user.id)
            .single();
        if (error && error.code !== 'PGRST116') console.error('Get bank details error:', error);
        return data || null;
    },

    async saveBankDetails(details) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const row = {
            user_id: user.id,
            account_holder_name: details.holderName,
            account_number: details.accountNumber,
            ifsc_code: details.ifscCode.toUpperCase(),
            bank_name: details.bankName || null,
            upi_id: details.upiId || null,
            preferred_method: details.preferredMethod || 'neft'
        };

        // Upsert — insert or update if user_id already exists
        const { data, error } = await supabase
            .from('employee_bank_details')
            .upsert(row, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) handleError(error, 'Save bank details');
        return data;
    },

    async getBankDetailsForUser(userId) {
        // Accountant/admin only — fetch bank details for a specific employee
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('employee_bank_details')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error && error.code !== 'PGRST116') console.error('Get bank details for user error:', error);
        return data || null;
    },

    async createPaymentTransaction(advanceId, userId, orgId, amount, method, initiatedBy) {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('payment_transactions')
            .insert({
                advance_id: advanceId,
                user_id: userId,
                organization_id: orgId,
                amount: amount,
                status: 'pending',
                payment_method: method || 'manual',
                initiated_by: initiatedBy
            })
            .select()
            .single();
        if (error) handleError(error, 'Create payment transaction');
        return data;
    },

    async getPendingPayments(orgId) {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('payment_transactions')
            .select('*, advance:advance_id(project_name, visit_type)')
            .eq('organization_id', orgId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error) {
            // Fallback without join
            const res = await supabase
                .from('payment_transactions')
                .select('*')
                .eq('organization_id', orgId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
            return res.data || [];
        }
        return data || [];
    },

    async getPaymentHistory(orgId) {
        const supabase = getSupabase();
        const { data } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('organization_id', orgId)
            .in('status', ['completed', 'failed'])
            .order('completed_at', { ascending: false })
            .limit(50);
        return data || [];
    },

    async recordPayment(transactionId, advanceId, reference, method, notes) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        // Update transaction
        const { error: txnError } = await supabase
            .from('payment_transactions')
            .update({
                status: 'completed',
                payment_reference: reference,
                payment_method: method,
                notes: notes || null,
                completed_at: new Date().toISOString()
            })
            .eq('id', transactionId);
        if (txnError) handleError(txnError, 'Record payment');

        // Update advance payment_status
        await supabase
            .from('advances')
            .update({ payment_status: 'completed', payment_transaction_id: transactionId })
            .eq('id', advanceId);

        // Get advance details for notification
        const { data: advance } = await supabase.from('advances').select('user_id, amount, project_name').eq('id', advanceId).single();
        if (advance) {
            const amt = `₹${Number(advance.amount).toLocaleString('en-IN')}`;
            this.createNotification(advance.user_id, 'system', 'Payment completed!',
                `Your advance of ${amt} for ${advance.project_name} has been paid. Reference: ${reference}`, advanceId);
        }

        return { success: true };
    },

    // ==============================================
    // NOTIFICATIONS
    // ==============================================

    async getNotifications(limit = 30, unreadOnly = false) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (unreadOnly) query = query.eq('is_read', false);

        const { data, error } = await query;
        if (error) handleError(error, 'Get notifications');
        return data || [];
    },

    async getUnreadCount() {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) return 0;

        const { count, error } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (error) return 0;
        return count || 0;
    },

    async markNotificationRead(notificationId) {
        const supabase = getSupabase();

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) handleError(error, 'Mark notification read');
        return { success: true };
    },

    async markAllNotificationsRead() {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (error) handleError(error, 'Mark all read');
        return { success: true };
    },

    async createNotification(userId, type, title, message, relatedId = null) {
        try {
            const supabase = getSupabase();
            const user = await getCachedUser();
            if (!user) return;

            // Get org ID from current user's profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            // Pass type directly — DB constraint should include advance types
            // Falls back to 'system' only for truly unknown types
            const knownTypes = ['voucher_submitted', 'voucher_approved', 'voucher_rejected',
                'voucher_reimbursed', 'voucher_resubmitted',
                'advance_submitted', 'advance_approved', 'advance_rejected', 'advance_resubmitted',
                'expense_added', 'employee_joined', 'project_created', 'system'];
            const safeType = knownTypes.includes(type) ? type : 'system';

            const insertData = {
                user_id: userId,
                organization_id: profile?.organization_id || null,
                type: safeType,
                title: title,
                message: message,
                is_read: false
            };
            // Only add reference_id if it's a valid UUID
            if (relatedId && typeof relatedId === 'string' && relatedId.includes('-')) {
                insertData.reference_id = relatedId;
                insertData.reference_type = type.startsWith('advance') ? 'advance' : 'voucher';
            }

            const { error } = await supabase.from('notifications').insert(insertData);
            if (error) console.error('Create notification error:', error);
        } catch (e) {
            console.error('Failed to create notification:', e);
        }
    },

    async sendNotificationEmail(to, subject, message, voucherNumber = '') {
        try {
            const supabase = getSupabase();
            console.log('[Email] Sending to:', to, 'Subject:', subject);

            // Get current session token
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                console.warn('[Email] No auth session, skipping email');
                return { success: false, error: 'No auth session' };
            }

            // Call Edge Function with explicit auth header
            const response = await fetch('https://ynpquqlxafdvoealmfye.supabase.co/functions/v1/send-notification-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlucHF1cWx4YWZkdm9lYWxtZnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDA2MjQsImV4cCI6MjA4NTU3NjYyNH0.ib7e4Xql3UCJCeGtB9VYpxwR1nzxLZJlGQxXtzVdmec'
                },
                body: JSON.stringify({ to, subject, message, voucherNumber })
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('[Email] Edge Function error:', response.status, result);
                return { success: false, error: result.error || 'Email failed' };
            }

            console.log('[Email] Sent successfully:', result);
            return result || { success: true };
        } catch (e) {
            console.error('[Email] Exception:', e);
            return { success: false, error: e.message };
        }
    },

    // ==============================================
    // ACCOUNTANT DASHBOARD — TALLY EXPORT
    // ==============================================

    async getAllOrgVouchers(orgId, filters = {}) {
        const supabase = getSupabase();

        let query = supabase
            .from('vouchers')
            .select(`
                *,
                submitter:submitted_by(id, name, email, employee_id, department),
                manager:manager_id(id, name),
                accountant:accountant_id(id, name),
                project:project_id(id, project_code, project_name)
            `)
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(500);

        if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
        if (filters.dateFrom) query = query.gte('submitted_at', filters.dateFrom);
        if (filters.dateTo) query = query.lte('submitted_at', filters.dateTo + 'T23:59:59');
        if (filters.submittedBy) query = query.eq('submitted_by', filters.submittedBy);
        if (filters.projectId) query = query.eq('project_id', filters.projectId);
        if (filters.exported === 'yes') query = query.eq('tally_exported', true);
        if (filters.exported === 'no') query = query.eq('tally_exported', false);

        const { data, error } = await query;
        if (error) handleError(error, 'Get all org vouchers');
        return data || [];
    },

    async markVouchersExported(voucherIds) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('vouchers')
            .update({
                tally_exported: true,
                exported_at: new Date().toISOString(),
                exported_by: user.id
            })
            .in('id', voucherIds);

        if (error) handleError(error, 'Mark vouchers exported');
        return { success: true, count: voucherIds.length };
    },

    async getTallyLedgerMappings(orgId) {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('tally_ledger_mappings')
            .select('*')
            .eq('organization_id', orgId)
            .order('expense_category');

        if (error) handleError(error, 'Get ledger mappings');

        // Transform to lookup object
        const mappings = {};
        for (const row of (data || [])) {
            if (row.expense_subcategory) {
                mappings[`${row.expense_category}:${row.expense_subcategory}`] = row.tally_ledger_name;
            } else {
                mappings[row.expense_category] = row.tally_ledger_name;
            }
        }
        return { raw: data || [], lookup: mappings };
    },

    async saveTallyLedgerMapping(orgId, category, ledgerName, subcategory = null) {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('tally_ledger_mappings')
            .upsert({
                organization_id: orgId,
                expense_category: category,
                expense_subcategory: subcategory,
                tally_ledger_name: ledgerName
            }, { onConflict: 'organization_id,expense_category,expense_subcategory' })
            .select()
            .single();

        if (error) handleError(error, 'Save ledger mapping');
        return { success: true, data };
    },

    // ==============================================
    // PROFILE
    // ==============================================

    async updateProfile(updates) {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const allowed = {};
        if (updates.name !== undefined) allowed.name = updates.name;
        if (updates.monthly_budget !== undefined) allowed.monthly_budget = parseFloat(updates.monthly_budget) || 0;

        const { data, error } = await supabase
            .from('profiles')
            .update(allowed)
            .eq('id', user.id)
            .select()
            .single();

        if (error) handleError(error, 'Update profile');

        // Update localStorage
        const cached = JSON.parse(localStorage.getItem('user') || '{}');
        Object.assign(cached, allowed);
        localStorage.setItem('user', JSON.stringify(cached));

        return { success: true, data };
    },

    async changePassword(newPassword) {
        const supabase = getSupabase();
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(error.message);
        return { success: true };
    },

    async getMyVouchersSummary() {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('vouchers')
            .select('status, total_amount')
            .eq('submitted_by', user.id);

        if (error) return { total: 0, pending: 0, approved: 0, rejected: 0, reimbursed: 0, totalAmount: 0 };

        const summary = { total: data.length, pending: 0, approved: 0, rejected: 0, reimbursed: 0, totalAmount: 0 };
        data.forEach(v => {
            summary.totalAmount += parseFloat(v.total_amount) || 0;
            if (['pending_manager', 'pending_accountant', 'manager_approved'].includes(v.status)) summary.pending++;
            else if (v.status === 'approved') summary.approved++;
            else if (v.status === 'rejected') summary.rejected++;
            else if (v.status === 'reimbursed') summary.reimbursed++;
        });
        return summary;
    },

    // ==============================================
    // ANALYTICS (Admin)
    // ==============================================

    async getSpendByDepartment(orgId, startDate = null, endDate = null) {
        const supabase = getSupabase();
        const { data } = await supabase.rpc('get_org_spend_by_department', {
            p_org_id: orgId, p_start: startDate, p_end: endDate
        });
        return data || [];
    },

    async getSpendByProject(orgId, startDate = null, endDate = null) {
        const supabase = getSupabase();
        const { data } = await supabase.rpc('get_org_spend_by_project', {
            p_org_id: orgId, p_start: startDate, p_end: endDate
        });
        return data || [];
    },

    async getSpendByEmployee(orgId, startDate = null, endDate = null) {
        const supabase = getSupabase();
        const { data } = await supabase.rpc('get_org_spend_by_employee', {
            p_org_id: orgId, p_start: startDate, p_end: endDate
        });
        return data || [];
    },

    async getMonthlyTrend(orgId, months = 12) {
        const supabase = getSupabase();
        const { data } = await supabase.rpc('get_org_monthly_trend', {
            p_org_id: orgId, p_months: months
        });
        return data || [];
    },

    // ==============================================
    // REIMBURSEMENT TRACKING
    // ==============================================

    async markVoucherPaid(voucherId, paymentMethod, paymentReference = '') {
        const supabase = getSupabase();
        const user = await getCachedUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('vouchers')
            .update({
                status: 'reimbursed',
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: paymentMethod,
                payment_reference: paymentReference || null,
                paid_by: user.id
            })
            .eq('id', voucherId)
            .select()
            .single();

        if (error) handleError(error, 'Mark voucher paid');

        // Add history
        await supabase.from('voucher_history').insert({
            voucher_id: voucherId,
            action: 'reimbursed',
            acted_by: user.id,
            comments: `Paid via ${paymentMethod}${paymentReference ? ' (Ref: ' + paymentReference + ')' : ''}`,
            previous_status: 'approved',
            new_status: 'reimbursed'
        });

        return { success: true, data };
    }
};

// Export globally
window.api = api;

// Also export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
