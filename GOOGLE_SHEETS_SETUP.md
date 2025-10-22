# Google Sheets Auto-Copy Setup Guide

This guide will help you set up the Google Service Account for automatic template copying.

## Overview

With this setup, every user will automatically get their own copy of your master expense template. No configuration needed from users!

## Step 1: Create Google Service Account (5 minutes)

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Make sure you're logged in with your Google account

2. **Create or Select a Project:**
   - If you don't have a project, click "Create Project"
   - Name it: `Expense Tracker App` (or any name you prefer)
   - Click "Create"

3. **Enable Required APIs:**
   - In the left sidebar, go to: **APIs & Services** � **Library**
   - Search for and enable these two APIs:
     - **Google Sheets API**
     - **Google Drive API**
   - Click "Enable" for each one

4. **Create Service Account:**
   - In the left sidebar, go to: **IAM & Admin** � **Service Accounts**
   - Click **"+ CREATE SERVICE ACCOUNT"** at the top
   - Fill in the details:
     - **Service account name:** `expense-tracker-service`
     - **Service account ID:** (auto-filled, leave as is)
     - **Description:** `Service account for auto-copying expense templates`
   - Click **"CREATE AND CONTINUE"**
   - For role, select: **Editor** (or just skip this step)
   - Click **"DONE"**

5. **Generate JSON Key:**
   - Click on the service account you just created
   - Go to the **"KEYS"** tab
   - Click **"ADD KEY"** � **"Create new key"**
   - Select **JSON** format
   - Click **"CREATE"**
   - A JSON file will download automatically
   - **IMPORTANT:** Keep this file secure! It contains your credentials

## Step 2: Share Master Template with Service Account

1. **Find Service Account Email:**
   - Open the downloaded JSON file
   - Look for the `"client_email"` field
   - It will look like: `expense-tracker-service@your-project-id.iam.gserviceaccount.com`
   - Copy this email address

2. **Share Your Master Template:**
   - Open your master Google Sheets template
   - URL: https://docs.google.com/spreadsheets/d/1dcq8HKP1j4NocCMgAY9YSXlwCrzHwIiRCd0t4mun25E
   - Click the **"Share"** button in the top right
   - Paste the service account email
   - **IMPORTANT:** Set permission to **"Viewer"** (not Editor!)
   - Uncheck "Notify people" (no need to send email)
   - Click **"Share"**

## Step 3: Add Credentials to Railway

1. **Open the JSON file:**
   - Open the downloaded JSON key file in a text editor
   - Copy the ENTIRE contents (all the JSON, including the curly braces)

2. **Add to Railway Environment Variables:**
   - Go to your Railway project
   - Click on your backend service
   - Go to **"Variables"** tab
   - Click **"+ New Variable"**
   - Variable name: `GOOGLE_SERVICE_ACCOUNT_JSON`
   - Variable value: Paste the entire JSON contents
   - Click **"Add"**

3. **Redeploy:**
   - Railway will automatically redeploy with the new environment variable
   - Wait for deployment to complete (~2-3 minutes)

## Step 4: Verify Setup

1. **Check Backend Logs:**
   - In Railway, go to **"Deployments"** tab
   - Click on the latest deployment
   - Look for this log message:
     ```
      Google Sheets Service initialized successfully
     ```
   - If you see this, the service is working!

2. **Test with a User:**
   - Sign up a new test user in your app
   - Upload a test bill
   - Click "Export to Google Sheets"
   - You should see:
     - Success message
     - Link to the user's new sheet
     - Email notification sent to user

3. **Verify Template Copy:**
   - Click the sheet link
   - Confirm the sheet has the same format as your master template
   - Check that data appears in rows 14-66
   - Verify all columns (S.NO, DATE, VENDOR, CATEGORY, COST) are filled

## Troubleshooting

### Error: "Google Sheets service not initialized"

**Solution:**
- Check if `GOOGLE_SERVICE_ACCOUNT_JSON` environment variable is set in Railway
- Make sure the JSON is valid (use a JSON validator)
- Redeploy the backend

### Error: "Permission denied" or "Sheet not found"

**Solution:**
- Make sure you shared the master template with the service account email
- Permission should be **"Viewer"** (allows copying but not editing)
- Double-check the service account email matches the one in the JSON file

### Error: "Cannot copy template"

**Solution:**
- Verify Google Drive API is enabled in Google Cloud Console
- Make sure the service account has access to the master template
- Check Railway logs for detailed error messages

### Sheet created but data not exporting

**Solution:**
- Verify Google Sheets API is enabled
- Check that the tab name is "ExpenseReport" (case-sensitive)
- Ensure rows 14-66 are available for data

## Security Best Practices

1. **Never commit the JSON key file to Git**
   - It's already in `.gitignore`
   - Only store it in Railway environment variables

2. **Master template should be Viewer-only**
   - Service account can only copy, not modify
   - Your original template stays safe

3. **Rotate credentials periodically**
   - Create new service account key every 90 days
   - Delete old keys from Google Cloud Console

4. **Monitor usage**
   - Check Google Cloud Console for API usage
   - Free tier includes 100 requests/100 seconds per user

## Cell Mapping (Pre-configured)

The backend is **already configured** to match your exact template format. No changes needed!

**Template Structure:**
- **Tab Name:** `ExpenseReport` (case-sensitive)
- **Data Rows:** 14-66 (53 expense capacity)
- **Header Rows:** 1-13 (preserved, never modified)

**Column Mapping:**

| Column | Field | Format | Notes |
|--------|-------|--------|-------|
| A | S.NO | Sequential number | Auto-calculated (14, 15, 16...) |
| B | DATE | dd-MMM-yyyy | e.g., "15-Oct-2024" |
| C-D | VENDOR NAME | Text | Merged cells, data written to C |
| E | CATEGORY | Text | e.g., "Travel", "Food" |
| F | COST | Number | Currency format preserved |

**Automatic Features:**
- Finds the next empty row starting from row 14
- Formats dates consistently as dd-MMM-yyyy
- Handles merged cells (C-D) correctly
- Preserves all template formatting, formulas, and styles
- Never overwrites existing data

## What Happens Now?

**For every new user:**
1. User signs up → Backend auto-creates their personal sheet
2. Sheet is named: `[User Name] - Expense Report`
3. Sheet is shared with user's email (they get notification)
4. User can view, edit, download, and share their sheet
5. When they export expenses → Data appears instantly in rows 14-66

**User experience:**
- Zero configuration needed
- One-click export
- Professional-looking reports
- Template format is always preserved
- Full control of their data

## Need Help?

If you encounter any issues:
1. Check Railway logs for error messages
2. Verify all steps above
3. Test with the master template ID: `1dcq8HKP1j4NocCMgAY9YSXlwCrzHwIiRCd0t4mun25E`
4. Make sure both APIs are enabled in Google Cloud Console

---

**Setup Complete!** Users can now export expenses with zero configuration. <�
