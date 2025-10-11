const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { sendTokenResponse } = require('../utils/jwt');
const { registerValidation, loginValidation } = require('../utils/validators');
const { protect } = require('../middleware/auth');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerValidation, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'User with this email already exists'
            });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password
        });

        // Send token response
        sendTokenResponse(user, 201, res);

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error registering user. Please try again.'
        });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginValidation, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists (include password for comparison)
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password'
            });
        }

        // Check if password matches
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password'
            });
        }

        // Send token response
        sendTokenResponse(user, 200, res);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error logging in. Please try again.'
        });
    }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(200).json({
            status: 'success',
            user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching user data'
        });
    }
});

/**
 * @route   PUT /api/auth/updateprofile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/updateprofile', protect, async (req, res) => {
    try {
        const { name, email } = req.body;

        const fieldsToUpdate = {};
        if (name) fieldsToUpdate.name = name;
        if (email) {
            // Check if email is already taken by another user
            const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
            if (existingUser) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Email is already in use'
                });
            }
            fieldsToUpdate.email = email;
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            fieldsToUpdate,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            status: 'success',
            user
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating profile'
        });
    }
});

/**
 * @route   PUT /api/auth/updatepassword
 * @desc    Update user password
 * @access  Private
 */
router.put('/updatepassword', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide current and new password'
            });
        }

        // Get user with password
        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                status: 'error',
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        // Send token response
        sendTokenResponse(user, 200, res);

    } catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating password'
        });
    }
});

/**
 * @route   GET /api/auth/google-sheets-config
 * @desc    Get user's Google Sheets configuration
 * @access  Private
 */
router.get('/google-sheets-config', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(200).json({
            status: 'success',
            config: user.googleSheetsConfig || {
                apiKey: '',
                clientId: '',
                spreadsheetId: '',
                isConfigured: false,
                lastSync: null
            }
        });
    } catch (error) {
        console.error('Get Google Sheets config error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching Google Sheets configuration'
        });
    }
});

/**
 * @route   PUT /api/auth/google-sheets-config
 * @desc    Update user's Google Sheets configuration
 * @access  Private
 */
router.put('/google-sheets-config', protect, async (req, res) => {
    try {
        const { apiKey, clientId, spreadsheetId } = req.body;

        // Validate required fields
        if (!apiKey || !clientId || !spreadsheetId) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide API Key, Client ID, and Spreadsheet ID'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                googleSheetsConfig: {
                    apiKey,
                    clientId,
                    spreadsheetId,
                    isConfigured: true,
                    lastSync: user.googleSheetsConfig?.lastSync || null
                }
            },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            status: 'success',
            message: 'Google Sheets configuration saved successfully',
            config: user.googleSheetsConfig
        });
    } catch (error) {
        console.error('Update Google Sheets config error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating Google Sheets configuration'
        });
    }
});

/**
 * @route   PUT /api/auth/google-sheets-sync
 * @desc    Update last sync timestamp
 * @access  Private
 */
router.put('/google-sheets-sync', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user.googleSheetsConfig || !user.googleSheetsConfig.isConfigured) {
            return res.status(400).json({
                status: 'error',
                message: 'Google Sheets not configured'
            });
        }

        user.googleSheetsConfig.lastSync = new Date();
        await user.save();

        res.status(200).json({
            status: 'success',
            message: 'Sync timestamp updated',
            lastSync: user.googleSheetsConfig.lastSync
        });
    } catch (error) {
        console.error('Update sync timestamp error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating sync timestamp'
        });
    }
});

module.exports = router;
