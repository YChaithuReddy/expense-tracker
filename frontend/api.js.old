/**
 * API Wrapper for Expense Tracker Backend
 * Handles all communication with the backend API
 * Production Backend: Railway
 */

// For LOCAL TESTING: Use localhost
// For PRODUCTION: Use Railway URL
// const API_BASE_URL = 'http://localhost:5000/api';
const API_BASE_URL = 'https://expense-tracker-production-8f00.up.railway.app/api';

// Make API_BASE_URL available globally for offline manager
window.API_BASE_URL = API_BASE_URL;

// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('authToken');
}

// Create headers with auth token
function getHeaders(includeAuth = false, isFormData = false) {
    const headers = {};

    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    if (includeAuth) {
        const token = getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    return headers;
}

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000  // 10 seconds
};

// Fetch with retry logic
async function fetchWithRetry(url, options = {}, retries = RETRY_CONFIG.maxRetries) {
    let lastError;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            // Check if online
            if (!navigator.onLine) {
                throw new Error('You are offline. Please check your internet connection.');
            }

            const response = await fetch(url, {
                ...options,
                // Add timeout using AbortController
                signal: AbortSignal.timeout(30000) // 30 second timeout
            });

            // If server error (5xx), retry
            if (response.status >= 500 && attempt < retries - 1) {
                throw new Error(`Server error: ${response.status}`);
            }

            return response;
        } catch (error) {
            lastError = error;
            console.warn(`Fetch attempt ${attempt + 1}/${retries} failed:`, error.message);

            // Don't retry on certain errors
            if (error.name === 'AbortError' ||
                error.message.includes('offline') ||
                error.message.includes('401')) {
                break;
            }

            // Wait before retrying (exponential backoff)
            if (attempt < retries - 1) {
                const delay = Math.min(
                    RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
                    RETRY_CONFIG.maxDelay
                );
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

// Handle API errors
function handleApiError(error) {
    console.error('API Error:', error);

    // Offline error
    if (!navigator.onLine || error.message === 'Failed to fetch') {
        const offlineError = new Error('You are offline. Changes will be saved locally and synced when you\'re back online.');
        offlineError.isOffline = true;
        throw offlineError;
    }

    // Timeout error
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
    }

    // Network error
    if (error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check your internet connection.');
    }

    throw error;
}

// API object with all methods
const api = {
    API_BASE_URL: API_BASE_URL, // Export API_BASE_URL for use in other scripts
    /**
     * Authentication APIs
     */

    // Register new user
    async register(name, email, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: getHeaders(false),
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Login user
    async login(email, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: getHeaders(false),
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Get current user
    async getCurrentUser() {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                method: 'GET',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to get user data');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Update user profile
    async updateProfile(name, email) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/updateprofile`, {
                method: 'PUT',
                headers: getHeaders(true),
                body: JSON.stringify({ name, email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update profile');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Update password
    async updatePassword(currentPassword, newPassword) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/updatepassword`, {
                method: 'PUT',
                headers: getHeaders(true),
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update password');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    /**
     * Expense APIs
     */

    // Get all expenses (with offline support)
    async getExpenses(page = 1, limit = 50, category = 'all') {
        try {
            let url = `${API_BASE_URL}/expenses?page=${page}&limit=${limit}`;
            if (category !== 'all') {
                url += `&category=${category}`;
            }

            const response = await fetchWithRetry(url, {
                method: 'GET',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch expenses');
            }

            // Cache expenses for offline viewing
            if (window.offlineManager && data.data) {
                window.offlineManager.cacheExpenses(data.data);
            }

            return data;
        } catch (error) {
            // If offline, try to return cached expenses
            if (!navigator.onLine && window.offlineManager) {
                console.log('Offline: Loading cached expenses...');
                const cachedExpenses = await window.offlineManager.getCachedExpenses();
                if (cachedExpenses.length > 0) {
                    return {
                        success: true,
                        data: cachedExpenses,
                        cached: true,
                        message: 'Showing cached data (offline)'
                    };
                }
            }
            return handleApiError(error);
        }
    },

    // Get single expense
    async getExpense(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
                method: 'GET',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch expense');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Create new expense (with offline support)
    async createExpense(expenseData, images = []) {
        // If offline and no images, save locally
        if (!navigator.onLine && images.length === 0 && window.offlineManager) {
            console.log('Offline: Saving expense locally...');
            await window.offlineManager.savePendingExpense(expenseData);
            return {
                success: true,
                offline: true,
                message: 'Expense saved offline. Will sync when online.'
            };
        }

        try {
            const formData = new FormData();

            // Add expense data
            formData.append('date', expenseData.date);
            formData.append('category', expenseData.category);
            formData.append('amount', parseFloat(expenseData.amount) || 0);
            formData.append('description', expenseData.description || 'N/A');

            if (expenseData.vendor) {
                formData.append('vendor', expenseData.vendor);
            }

            if (expenseData.time) {
                formData.append('time', expenseData.time);
            }

            // Add images
            for (let i = 0; i < images.length; i++) {
                formData.append('images', images[i]);
            }

            const response = await fetchWithRetry(`${API_BASE_URL}/expenses`, {
                method: 'POST',
                headers: getHeaders(true, true),
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                // Log the full error details for debugging
                console.error('Backend validation error:', data);

                // Extract detailed error message if available
                let errorMessage = data.message || 'Failed to create expense';
                if (data.error) {
                    errorMessage = data.error;
                }
                if (data.errors && Array.isArray(data.errors)) {
                    errorMessage = data.errors.join(', ');
                }
                if (data.details) {
                    errorMessage += ` - ${data.details}`;
                }

                throw new Error(errorMessage);
            }

            return data;
        } catch (error) {
            // If network error and no images, save offline
            if ((error.message.includes('fetch') || error.message.includes('offline') || !navigator.onLine)
                && images.length === 0 && window.offlineManager) {
                console.log('Network error: Saving expense locally...');
                await window.offlineManager.savePendingExpense(expenseData);
                return {
                    success: true,
                    offline: true,
                    message: 'Expense saved offline. Will sync when online.'
                };
            }
            return handleApiError(error);
        }
    },

    // Update expense
    async updateExpense(id, expenseData, images = []) {
        try {
            const formData = new FormData();

            // Add expense data
            if (expenseData.date) formData.append('date', expenseData.date);
            if (expenseData.category) formData.append('category', expenseData.category);
            if (expenseData.amount) formData.append('amount', parseFloat(expenseData.amount) || 0);
            if (expenseData.description) formData.append('description', expenseData.description);
            if (expenseData.vendor !== undefined) formData.append('vendor', expenseData.vendor);
            if (expenseData.time !== undefined) formData.append('time', expenseData.time);

            // Add new images if any
            for (let i = 0; i < images.length; i++) {
                formData.append('images', images[i]);
            }

            const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
                method: 'PUT',
                headers: getHeaders(true, true),
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update expense');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Delete expense
    async deleteExpense(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
                method: 'DELETE',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete expense');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Delete image from expense
    async deleteExpenseImage(expenseId, imagePublicId) {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/${expenseId}/image/${imagePublicId}`, {
                method: 'DELETE',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete image');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Get expense statistics
    async getExpenseStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/stats/summary`, {
                method: 'GET',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch statistics');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    /**
     * Google Sheets APIs - Simplified
     * All sheet management now handled by backend
     */

    // Get user's Google Sheet link
    async getGoogleSheetLink() {
        try {
            const response = await fetch(`${API_BASE_URL}/google-sheets/link`, {
                method: 'GET',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to get Google Sheet link');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Export expenses to Google Sheets
    async exportToGoogleSheets(expenseIds) {
        try {
            const response = await fetch(`${API_BASE_URL}/google-sheets/export`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify({ expenseIds })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to export to Google Sheets');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Create Google Sheet for user (optional - done automatically on first export)
    async createGoogleSheet() {
        try {
            const response = await fetch(`${API_BASE_URL}/google-sheets/create`, {
                method: 'POST',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to create Google Sheet');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Export Google Sheet as PDF (base64)
    async exportGoogleSheetAsPdf() {
        try {
            const response = await fetch(`${API_BASE_URL}/google-sheets/export-pdf`, {
                method: 'GET',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to export Google Sheet as PDF');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Reset Google Sheet to master template format
    async resetGoogleSheet() {
        try {
            const response = await fetch(`${API_BASE_URL}/google-sheets/reset`, {
                method: 'POST',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to reset Google Sheet');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Update employee information in Google Sheet
    async updateEmployeeInfo(employeeData) {
        try {
            const response = await fetch(`${API_BASE_URL}/google-sheets/update-employee-info`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify(employeeData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update employee information');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    /**
     * Selective Clear APIs
     */

    // Clear only expense data (preserve images)
    async clearExpenseDataOnly() {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/clear/data-only`, {
                method: 'DELETE',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to clear expense data');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Clear only orphaned images
    async clearImagesOnly() {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/clear/images-only`, {
                method: 'DELETE',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to clear images');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Clear everything (expenses and images)
    async clearAll() {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/clear/all`, {
                method: 'DELETE',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                // Log the full error details for debugging
                console.error('Backend clear all error:', data);
                throw new Error(data.message || 'Failed to clear all data');
            }

            // Log success details for debugging
            console.log('Clear all successful:', data);

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    /**
     * Orphaned Images APIs
     */

    // Get all orphaned images
    async getOrphanedImages() {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/orphaned-images`, {
                method: 'GET',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch orphaned images');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Delete specific orphaned image
    async deleteOrphanedImage(imageId) {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/orphaned-images/${imageId}`, {
                method: 'DELETE',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete orphaned image');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Extend orphaned image expiry
    async extendOrphanedImageExpiry(imageId, days = 30) {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/orphaned-images/${imageId}/extend`, {
                method: 'PUT',
                headers: getHeaders(true),
                body: JSON.stringify({ days })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to extend image expiry');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    /**
     * WhatsApp APIs
     */

    // Get WhatsApp configuration status
    async getWhatsAppStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/whatsapp/status`, {
                method: 'GET',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to get WhatsApp status');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Setup WhatsApp number
    async setupWhatsApp(phoneNumber, enableNotifications = true) {
        try {
            const response = await fetch(`${API_BASE_URL}/whatsapp/setup`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify({ phoneNumber, enableNotifications })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to setup WhatsApp');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Send expense summary via WhatsApp
    async sendWhatsAppSummary(period = 'month') {
        try {
            const response = await fetch(`${API_BASE_URL}/whatsapp/send-summary`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify({ period })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to send WhatsApp summary');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Test WhatsApp connection
    async testWhatsApp() {
        try {
            const response = await fetch(`${API_BASE_URL}/whatsapp/test`, {
                method: 'POST',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to send test message');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
