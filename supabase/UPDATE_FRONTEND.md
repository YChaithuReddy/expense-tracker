# Frontend Update Guide

This guide shows the changes needed to switch your frontend from the Railway backend to Supabase.

## Quick Summary

Replace these script includes in your HTML files:

**Before (Railway):**
```html
<script src="api.js"></script>
<script src="auth.js"></script>
```

**After (Supabase):**
```html
<!-- Supabase SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<!-- Your Supabase client files -->
<script src="supabase-client.js"></script>
<script src="supabase-api.js"></script>
<script src="supabase-auth.js"></script>
```

---

## Step-by-Step: index.html

### 1. Add Supabase SDK to `<head>`

In `frontend/index.html`, add after line 37 (after Flatpickr JS):

```html
<!-- Supabase SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### 2. Replace Script Includes

Find this section (around line 428-431):
```html
<!-- Load authentication files first -->
<script src="api.js"></script>
<script src="auth.js"></script>
<script src="script.js"></script>
```

Replace with:
```html
<!-- Load Supabase authentication files -->
<script src="supabase-client.js"></script>
<script src="supabase-api.js"></script>
<script src="supabase-auth.js"></script>
<script src="script.js"></script>
```

---

## Step-by-Step: login.html

### 1. Add Supabase SDK

In `frontend/login.html`, add before line 100:

```html
<!-- Supabase SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### 2. Replace Script Includes

Find this section (around line 100-102):
```html
<script src="api.js"></script>
<script src="auth.js"></script>
<script src="deep-link-handler.js"></script>
```

Replace with:
```html
<script src="supabase-client.js"></script>
<script src="supabase-api.js"></script>
<script src="supabase-auth.js"></script>
<script src="deep-link-handler.js"></script>
```

### 3. Update Login Form Handler

The login form handler in login.html uses `api.login()`. The new `supabase-api.js` provides the same interface, so this should work automatically.

However, update the response handling (around line 141-150):

**Before:**
```javascript
const response = await api.login(email, password);

if (response.status === 'success') {
    showMessage('Login successful! Redirecting...', 'success');

    // Save token and user info
    localStorage.setItem('authToken', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
```

**After:**
```javascript
const response = await api.login(email, password);

if (response.success) {
    showMessage('Login successful! Redirecting...', 'success');
    // Token and user are automatically saved by supabase-api.js
```

### 4. Update Google Login Function

Find the `loginWithGoogle()` function and update it:

**Before (if exists):**
```javascript
function loginWithGoogle() {
    window.location.href = `${api.API_BASE_URL}/auth/google?platform=web`;
}
```

**After:**
```javascript
async function loginWithGoogle() {
    try {
        const result = await api.loginWithGoogle();
        if (result.url) {
            window.location.href = result.url;
        }
    } catch (error) {
        showMessage('Google login failed: ' + error.message, 'error');
    }
}
```

---

## Step-by-Step: signup.html

Apply the same script changes as login.html:

1. Add Supabase SDK
2. Replace api.js/auth.js with supabase-*.js files
3. Update register call to use new response format

---

## Configure Supabase Client

Edit `frontend/supabase-client.js` and set your Supabase credentials:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

Get these values from:
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings > API
4. Copy "Project URL" and "anon/public" key

---

## API Changes Reference

Most API calls remain the same, but some response formats changed:

| Operation | Old Response | New Response |
|-----------|-------------|--------------|
| Login | `response.status === 'success'` | `response.success === true` |
| Register | `response.status === 'success'` | `response.success === true` |
| Get Expenses | `response.data` (array) | `response.data` (array) |
| Create Expense | `response.data` | `response.data` |
| Stats | `response.data` | `response.data` (same) |

The `api` object methods remain the same:
- `api.login(email, password)`
- `api.register(name, email, password)`
- `api.getCurrentUser()`
- `api.getExpenses(page, limit, category)`
- `api.createExpense(data, images)`
- `api.updateExpense(id, data, images)`
- `api.deleteExpense(id)`
- `api.getExpenseStats()`
- etc.

---

## Testing Checklist

After making changes, test these features:

- [ ] Login with email/password
- [ ] Login with Google
- [ ] Register new user
- [ ] View expenses list
- [ ] Create new expense
- [ ] Create expense with image
- [ ] Edit expense
- [ ] Delete expense
- [ ] View expense stats
- [ ] Export to Google Sheets
- [ ] WhatsApp integration (if using)
- [ ] Logout

---

## Troubleshooting

### "supabase is not defined"
- Make sure the Supabase CDN script is loaded BEFORE your supabase-client.js

### "Not authenticated" errors
- Check that SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Verify the session exists: `await window.supabaseClient.getSession()`

### Images not uploading
- Check Supabase Storage bucket exists (`expense-bills`)
- Verify storage policies are applied

### RLS policy errors
- Run `policies.sql` in SQL Editor
- Check user is authenticated before making requests
