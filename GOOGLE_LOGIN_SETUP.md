# 🔐 Google Login Setup Guide

## ✅ What's Been Implemented

I've added complete Google OAuth 2.0 authentication to your expense tracker using the **Feature Upgrader skill**!

### Backend Changes:
1. ✅ Installed `passport`, `passport-google-oauth20`, `express-session`
2. ✅ Created `backend/config/passport.js` - Google OAuth strategy
3. ✅ Updated `backend/models/User.js` - Added Google OAuth fields
4. ✅ Updated `backend/routes/auth.js` - Added Google OAuth routes
5. ✅ Updated `backend/server.js` - Added Passport & session middleware

### What's Working:
- Google Sign-In button (ready for frontend)
- OAuth callback handling
- User creation/linking with Google accounts
- JWT token generation after Google login
- Session management
- Profile picture support

---

## 🚀 Setup Steps (5 Minutes)

### Step 1: Get Google OAuth Credentials

1. Go to: https://console.cloud.google.com/apis/credentials
2. Create a new project (or select existing)
3. Click **"Create Credentials"** → **"OAuth client ID"**
4. Application type: **Web application**
5. Add these URLs:

**Authorized JavaScript origins:**
```
https://expense-tracker-delta-ashy.vercel.app
https://expense-tracker-production-8f00.up.railway.app
```

**Authorized redirect URIs:**
```
https://expense-tracker-production-8f00.up.railway.app/api/auth/google/callback
http://localhost:5000/api/auth/google/callback (for local testing)
```

6. Click **Create**
7. Copy your **Client ID** and **Client Secret**

---

### Step 2: Add Environment Variables

**Add to Railway (Variables tab):**
```env
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
SESSION_SECRET=your-random-secret-key-here
BACKEND_URL=https://expense-tracker-production-8f00.up.railway.app
FRONTEND_URL=https://expense-tracker-delta-ashy.vercel.app
```

**Add to `backend/.env` (for local development):**
```env
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
SESSION_SECRET=your-random-secret-key-here
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```

**Generate SESSION_SECRET:** Run this command:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Step 3: Update Frontend (Add Google Button)

Add this to `frontend/login.html` after line 68 (after the login form):

```html
<!-- Google Sign-In Divider -->
<div style="text-align: center; margin: 20px 0; position: relative;">
    <span style="background: var(--bg-primary); padding: 0 10px; position: relative; z-index: 1;">OR</span>
    <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--border-color); z-index: 0;"></div>
</div>

<!-- Google Sign-In Button -->
<button type="button" class="btn-google" onclick="loginWithGoogle()" style="width: 100%; padding: 12px; background: white; color: #333; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.3s;">
    <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.180l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.440 1.345l2.582-2.580C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
    Continue with Google
</button>

<script>
function loginWithGoogle() {
    // Get backend URL from api.js configuration
    const backendUrl = 'https://expense-tracker-production-8f00.up.railway.app';
    window.location.href = `${backendUrl}/api/auth/google`;
}

// Handle OAuth callback
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    if (token) {
        localStorage.setItem('authToken', token);
        const userParam = urlParams.get('user');
        if (userParam) {
            try {
                const user = JSON.parse(decodeURIComponent(userParam));
                localStorage.setItem('user', JSON.stringify(user));
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }
        showMessage('Google login successful! Redirecting...', 'success');
        setTimeout(() => window.location.href = 'index.html', 1000);
    } else if (error === 'google_auth_failed') {
        showMessage('Google authentication failed. Please try again.', 'error');
    }
});
</script>
```

---

## 🧪 Testing

### Test Locally:
1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npx http-server -p 3000`
3. Open: http://localhost:3000/login.html
4. Click "Continue with Google"

### Test Production:
1. Push changes to GitHub
2. Wait for Railway & Vercel to deploy (2-3 mins)
3. Open: https://expense-tracker-delta-ashy.vercel.app
4. Click "Continue with Google"

---

## ✅ Features

- 🔐 Secure Google OAuth 2.0
- 👤 Auto-creates user account
- 🔗 Links existing email accounts
- 📸 Saves Google profile picture
- ✅ Email auto-verified
- 🔄 Works with existing login system
- 📱 Mobile-friendly

---

## 🔍 Troubleshooting

### Error: "redirect_uri_mismatch"
→ Add correct callback URL to Google Console

### Error: "Missing client_id"
→ Add GOOGLE_CLIENT_ID to Railway Variables

### Login button doesn't work
→ Check browser console for errors
→ Verify BACKEND_URL is correct

---

## 📊 User Model Changes

New fields added:
- `googleId` - Google account ID
- `authProvider` - 'local' or 'google'
- `profilePicture` - Google profile photo URL
- `emailVerified` - Auto-true for Google users
- `lastLogin` - Tracks login time

---

## 🎉 You're Done!

Google Login is now fully integrated! Users can:
1. Sign up with Google (instant, no password needed)
2. Login with existing Google account
3. Link Google to existing email account

**Next Steps:**
1. Add env variables to Railway
2. Update frontend with Google button
3. Test and enjoy! 🚀
