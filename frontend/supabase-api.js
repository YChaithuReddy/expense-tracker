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

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/login.html`
            }
        });

        if (error) handleError(error, 'Google login');

        return { success: true, url: data.url };
    },

    // Get current user
    async getCurrentUser() {
        const supabase = getSupabase();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            throw new Error('Not authenticated');
        }

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

    // Update user profile
    async updateProfile(name, email) {
        const supabase = getSupabase();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Update profile table
        const { data, error } = await supabase
            .from('profiles')
            .update({ name, email, updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .select()
            .single();

        if (error) handleError(error, 'Update profile');

        // Update localStorage
        const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...userInfo, name, email }));

        return { success: true, data };
    },

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

        const { data: { user } } = await supabase.auth.getUser();
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

        const { data: { user } } = await supabase.auth.getUser();
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
        const { data: expense, error: expenseError } = await supabase
            .from('expenses')
            .insert({
                user_id: user.id,
                date: expenseData.date,
                time: expenseData.time || null,
                category: expenseData.category,
                amount: parseFloat(expenseData.amount) || 0,
                vendor: expenseData.vendor || 'N/A',
                description: expenseData.description || 'N/A'
            })
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

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Build update object
        const updateObj = {};
        if (expenseData.date) updateObj.date = expenseData.date;
        if (expenseData.time !== undefined) updateObj.time = expenseData.time;
        if (expenseData.category) updateObj.category = expenseData.category;
        if (expenseData.amount) updateObj.amount = parseFloat(expenseData.amount);
        if (expenseData.vendor !== undefined) updateObj.vendor = expenseData.vendor;
        if (expenseData.description) updateObj.description = expenseData.description;
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

        const { data: { user } } = await supabase.auth.getUser();
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

        // Delete from storage
        await window.supabaseClient.deleteImage(storagePath);

        // Delete record
        const { error } = await supabase
            .from('expense_images')
            .delete()
            .eq('storage_path', storagePath);

        if (error) handleError(error, 'Delete image');

        return { success: true, message: 'Image deleted' };
    },

    // Get expense statistics
    async getExpenseStats() {
        const supabase = getSupabase();

        const { data: { user } } = await supabase.auth.getUser();
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

        const { data: { user } } = await supabase.auth.getUser();
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

        return {
            success: true,
            message: 'Expense data cleared. Images preserved.',
            orphanedCount: expenseImages?.length || 0
        };
    },

    // Clear images only
    async clearImagesOnly() {
        const supabase = getSupabase();

        const { data: { user } } = await supabase.auth.getUser();
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

        // Delete records
        await supabase
            .from('orphaned_images')
            .delete()
            .eq('user_id', user.id);

        return { success: true, message: 'Orphaned images cleared' };
    },

    // Clear all data
    async clearAll() {
        const supabase = getSupabase();

        const { data: { user } } = await supabase.auth.getUser();
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

        // Delete expenses (cascades to expense_images)
        await supabase.from('expenses').delete().eq('user_id', user.id);

        // Delete orphaned images
        await supabase.from('orphaned_images').delete().eq('user_id', user.id);

        return { success: true, message: 'All data cleared' };
    },

    // ==============================================
    // ORPHANED IMAGES
    // ==============================================

    async getOrphanedImages() {
        const supabase = getSupabase();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('orphaned_images')
            .select('*')
            .eq('user_id', user.id)
            .order('upload_date', { ascending: false });

        if (error) handleError(error, 'Get orphaned images');

        // Get storage stats
        const { data: stats } = await supabase
            .rpc('get_user_storage_stats', { p_user_id: user.id });

        return {
            success: true,
            data: data.map(img => ({
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
            })),
            stats
        };
    },

    async deleteOrphanedImage(imageId) {
        const supabase = getSupabase();

        // Get image path first
        const { data: img } = await supabase
            .from('orphaned_images')
            .select('storage_path')
            .eq('id', imageId)
            .single();

        if (img) {
            // Delete from storage
            await supabase.storage.from('expense-bills').remove([img.storage_path]);
        }

        // Delete record
        const { error } = await supabase
            .from('orphaned_images')
            .delete()
            .eq('id', imageId);

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
    // GOOGLE SHEETS (via Edge Functions)
    // ==============================================

    async getGoogleSheetLink() {
        const supabase = getSupabase();

        const { data: { user } } = await supabase.auth.getUser();
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

    async exportToGoogleSheets(expenseIds) {
        const supabase = getSupabase();

        const { data, error } = await supabase.functions.invoke('google-sheets-export', {
            body: { expenseIds }
        });

        if (error) handleError(error, 'Export to sheets');

        return data;
    },

    async createGoogleSheet() {
        const supabase = getSupabase();

        const { data, error } = await supabase.functions.invoke('google-sheets-create', {});

        if (error) handleError(error, 'Create sheet');

        return data;
    },

    async exportGoogleSheetAsPdf() {
        const supabase = getSupabase();

        const { data, error } = await supabase.functions.invoke('google-sheets-pdf', {});

        if (error) handleError(error, 'Export PDF');

        return data;
    },

    async resetGoogleSheet() {
        const supabase = getSupabase();

        const { data, error } = await supabase.functions.invoke('google-sheets-reset', {});

        if (error) handleError(error, 'Reset sheet');

        return data;
    },

    async updateEmployeeInfo(employeeData) {
        const supabase = getSupabase();

        const { data, error } = await supabase.functions.invoke('google-sheets-employee', {
            body: employeeData
        });

        if (error) handleError(error, 'Update employee info');

        return data;
    },

    // ==============================================
    // WHATSAPP (via Edge Functions)
    // ==============================================

    async getWhatsAppStatus() {
        const supabase = getSupabase();

        const { data: { user } } = await supabase.auth.getUser();
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

        const { data: { user } } = await supabase.auth.getUser();
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
    }
};

// Export globally
window.api = api;

// Also export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
