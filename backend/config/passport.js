/**
 * Passport.js Configuration for Google OAuth 2.0
 * Handles Google Sign-In authentication
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Configure Google OAuth Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('🔐 Google OAuth callback received');
                console.log('Profile:', profile.displayName, profile.emails[0].value);

                // Check if user already exists
                let user = await User.findOne({
                    $or: [
                        { googleId: profile.id },
                        { email: profile.emails[0].value }
                    ]
                });

                if (user) {
                    // User exists - update Google ID if needed
                    if (!user.googleId) {
                        user.googleId = profile.id;
                        user.authProvider = 'google';
                        user.profilePicture = profile.photos[0]?.value;
                        await user.save();
                        console.log('✅ Linked Google account to existing user');
                    }
                    return done(null, user);
                }

                // Create new user with Google account
                user = await User.create({
                    googleId: profile.id,
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    authProvider: 'google',
                    profilePicture: profile.photos[0]?.value,
                    emailVerified: true
                });

                console.log('✅ Created new user via Google OAuth');
                done(null, user);

            } catch (error) {
                console.error('❌ Google OAuth error:', error);
                done(error, null);
            }
        }
    )
);

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id).select('-password');
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
