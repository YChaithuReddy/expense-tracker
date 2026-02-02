# Supabase Setup Guide for Expense Tracker

This guide walks you through migrating from Railway to Supabase.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - Project name: `expense-tracker`
   - Database password: (save this securely!)
   - Region: Choose closest to your users
4. Wait for project to be created (~2 minutes)

## Step 2: Get Your API Keys

1. Go to Project Settings > API
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`
   - **service_role key**: (for Edge Functions only, keep secret!)

## Step 3: Run Database Schema

1. Go to SQL Editor in Supabase Dashboard
2. Open and run these files in order:
   ```
   1. supabase/schema.sql
   2. supabase/policies.sql
   3. supabase/storage.sql
   ```
3. Check that tables are created in Table Editor

## Step 4: Configure Authentication

### Email/Password Auth (default enabled)
1. Go to Authentication > Providers
2. Email is enabled by default
3. Optionally enable "Confirm email" for verification

### Google OAuth
1. Go to Authentication > Providers > Google
2. Enable Google provider
3. Go to [Google Cloud Console](https://console.cloud.google.com)
4. Create OAuth 2.0 credentials:
   - Authorized redirect URIs: `https://xxxxx.supabase.co/auth/v1/callback`
5. Copy Client ID and Client Secret to Supabase

## Step 5: Configure Storage

1. Go to Storage in Supabase Dashboard
2. Verify `expense-bills` bucket was created (by storage.sql)
3. If not, create bucket:
   - Name: `expense-bills`
   - Public bucket: Yes
   - File size limit: 5MB
   - Allowed MIME types: `image/jpeg, image/png, image/gif, image/webp`

## Step 6: Update Frontend

1. Open `frontend/supabase-client.js`
2. Replace placeholder values:
   ```javascript
   const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key-here';
   ```

3. Update `frontend/index.html` to include Supabase scripts:
   ```html
   <!-- Add before other scripts -->
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="supabase-client.js"></script>
   <script src="supabase-api.js"></script>
   <script src="supabase-auth.js"></script>
   ```

4. Remove or comment out old scripts:
   ```html
   <!-- Remove these -->
   <!-- <script src="api.js"></script> -->
   <!-- <script src="auth.js"></script> -->
   ```

## Step 7: Deploy Edge Functions (Optional - for WhatsApp/Sheets)

### Prerequisites
1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link to your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

### Deploy Functions
```bash
# Deploy WhatsApp webhook
supabase functions deploy whatsapp-webhook

# Deploy Google Sheets export
supabase functions deploy google-sheets-export
```

### Set Environment Variables
```bash
# Twilio (for WhatsApp)
supabase secrets set TWILIO_ACCOUNT_SID=your_sid
supabase secrets set TWILIO_AUTH_TOKEN=your_token
supabase secrets set TWILIO_WHATSAPP_NUMBER=your_number

# Google Sheets
supabase secrets set GOOGLE_APPS_SCRIPT_URL=your_apps_script_url
```

## Step 8: Update Twilio Webhook (for WhatsApp)

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to WhatsApp Sandbox settings
3. Update webhook URL to:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook
   ```

## Step 9: Migrate Existing Data

If you have existing data in MongoDB, run the migration script:

```bash
cd supabase
npm install
node migrate-data.js
```

Make sure to set environment variables first:
```bash
export MONGODB_URI=your_mongodb_connection_string
export SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_KEY=your_service_role_key
```

## Step 10: Deploy Frontend

1. Update your Vercel deployment
2. Or host anywhere (it's just static files now!)
3. The frontend no longer needs a backend server for most operations

## Architecture After Migration

```
Frontend (Vercel/anywhere)
    ↓
Supabase
    ├── Auth (authentication)
    ├── Database (PostgreSQL)
    ├── Storage (images)
    └── Edge Functions (WhatsApp, Sheets)
```

## Free Tier Limits

| Resource | Free Limit |
|----------|------------|
| Database | 500 MB |
| Storage | 1 GB |
| Edge Function invocations | 500K/month |
| Bandwidth | 5 GB/month |
| Auth | Unlimited users |

## Troubleshooting

### "permission denied" errors
- Check RLS policies are correctly applied
- Verify user is authenticated
- Check the `auth.uid()` matches the `user_id` in queries

### Images not uploading
- Verify storage bucket exists and is public
- Check storage policies allow uploads
- Verify file size is under 5MB

### Auth not working
- Check Supabase URL and anon key are correct
- Verify redirect URLs in OAuth providers
- Check browser console for errors

### Edge Functions not responding
- Check function logs in Supabase Dashboard
- Verify environment secrets are set
- Check function is deployed successfully

## Support

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
