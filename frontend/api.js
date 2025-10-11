/**
 * API Wrapper for Expense Tracker Backend
 * Handles all communication with the backend API
 * Production Backend: Railway
 */

const API_BASE_URL = 'https://expense-tracker-production-2538.up.railway.app/api';

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

// Handle API errors
function handleApiError(error) {
    console.error('API Error:', error);

    if (error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check if backend is running.');
    }

    throw error;
}

// API object with all methods
const api = {
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

    // Get all expenses
    async getExpenses(page = 1, limit = 50, category = 'all') {
        try {
            let url = `${API_BASE_URL}/expenses?page=${page}&limit=${limit}`;
            if (category !== 'all') {
                url += `&category=${category}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch expenses');
            }

            return data;
        } catch (error) {
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

    // Create new expense
    async createExpense(expenseData, images = []) {
        try {
            const formData = new FormData();

            // Add expense data
            formData.append('date', expenseData.date);
            formData.append('category', expenseData.category);
            formData.append('amount', expenseData.amount);
            formData.append('description', expenseData.description);

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

            const response = await fetch(`${API_BASE_URL}/expenses`, {
                method: 'POST',
                headers: getHeaders(true, true),
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to create expense');
            }

            return data;
        } catch (error) {
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
            if (expenseData.amount) formData.append('amount', expenseData.amount);
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
     * Google Sheets Configuration APIs
     */

    // Get Google Sheets configuration
    async getGoogleSheetsConfig() {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/google-sheets-config`, {
                method: 'GET',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch Google Sheets config');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Save Google Sheets configuration
    async saveGoogleSheetsConfig(apiKey, clientId, spreadsheetId) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/google-sheets-config`, {
                method: 'PUT',
                headers: getHeaders(true),
                body: JSON.stringify({ apiKey, clientId, spreadsheetId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save Google Sheets config');
            }

            return data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Update last sync timestamp
    async updateGoogleSheetsSync() {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/google-sheets-sync`, {
                method: 'PUT',
                headers: getHeaders(true)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update sync timestamp');
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
