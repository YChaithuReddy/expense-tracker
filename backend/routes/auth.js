const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');
const { sendTokenResponse, generateToken } = require('../utils/jwt');
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
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth login
 * @access  Public
 */
router.get('/google', (req, res, next) => {
    // Store platform info in session/state for callback
    const platform = req.query.platform || 'web';
    const state = Buffer.from(JSON.stringify({ platform })).toString('base64');

    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account',
        state: state
    })(req, res, next);
});

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get('/google/callback',
    passport.authenticate('google', {
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login.html?error=google_auth_failed`
    }),
    async (req, res) => {
        try {
            // Update last login
            await req.user.updateLastLogin();

            // Generate JWT token
            const token = generateToken(req.user._id);

            // Parse state to check platform
            let platform = 'web';
            if (req.query.state) {
                try {
                    const stateData = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
                    platform = stateData.platform || 'web';
                } catch (e) {
                    console.log('Could not parse state:', e);
                }
            }

            // Prepare user data for frontend
            const userData = {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                profilePicture: req.user.profilePicture || null,
                authProvider: 'google'
            };

            // Determine redirect URL based on platform
            let redirectUrl;
            if (platform === 'android' || platform === 'ios') {
                // Use custom URL scheme for mobile apps
                redirectUrl = `expensetracker://auth?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(userData))}&authProvider=google`;
            } else {
                // Use web URL for browser
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
                redirectUrl = `${frontendUrl}/login.html?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(userData))}&authProvider=google`;
            }

            res.redirect(redirectUrl);

        } catch (error) {
            console.error('Google callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login.html?error=auth_error`);
        }
    }
);

module.exports = router;
