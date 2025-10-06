# Google Sheets Integration Setup Guide

This guide will help you set up Google Sheets integration for your expense tracker.

## Prerequisites

- A Google account
- Access to your expense Google Sheet
- Google Cloud Console access

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note down your project ID

## Step 2: Enable Google Sheets API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click on it and press "Enable"

## Step 3: Create API Credentials

### Create API Key
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the API key (you'll need this for the expense tracker)
4. **Optional**: Restrict the API key:
   - Click on the API key to edit it
   - Under "API restrictions", select "Restrict key"
   - Choose "Google Sheets API"

### Create OAuth 2.0 Client ID
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in the required app information
   - Add your email as a test user
4. Select "Web application" as the application type
5. Add authorized JavaScript origins:
   - `http://localhost:3000` (if running locally)
   - Your actual domain (if deployed)
6. Copy the Client ID (you'll need this for the expense tracker)

## Step 4: Configure Your Expense Tracker

1. Open your expense tracker application
2. Click "📊 Configure Google Sheets"
3. Enter the credentials you created:
   - **Google Client ID**: The OAuth 2.0 Client ID from Step 3
   - **Google API Key**: The API key from Step 3
   - **Google Sheet ID**: `1LDdO1WPcYjeDh8uMn3myxQXjN3CTPrf9` (already filled)
   - **Sheet Name/Tab**: Usually "Sheet1" (verify in your Google Sheet)
4. Click "💾 Save Configuration"

## Step 5: Authenticate and Test

1. Click "🔐 Connect to Google" to authenticate
2. Follow the Google OAuth flow to grant permissions
3. Once authenticated, click "🧪 Test Connection" to verify everything works
4. You should see a success message with your sheet name

## Step 6: Grant Access to Your Sheet

1. Open your [Google Sheet](https://docs.google.com/spreadsheets/d/1LDdO1WPcYjeDh8uMn3myxQXjN3CTPrf9/edit)
2. Click the "Share" button
3. Add the service account email (if you created one) or ensure the sheet is accessible to your Google account

## How the Integration Works

### Cell Mapping
Your expense data will be automatically mapped to specific cells:

- **SL NO** (A13:A66): Auto-incrementing serial numbers
- **DATE** (B13:B66): Expense dates from your bills
- **VENDOR NAME & DESCRIPTION** (C13:C66): Combined vendor name and description
- **CATEGORY** (D13:D66): Expense categories (Transportation, Meals, etc.)
- **COST** (E13:E66): Expense amounts

### Data Flow
1. Upload and scan your bills using OCR
2. Review and edit the extracted expense details
3. Submit the expenses to your local list
4. Click "📊 Export to Google Sheets" to send data to your sheet
5. The system finds the next empty row and populates your template

## Troubleshooting

### Common Issues

**"Not authenticated" error:**
- Make sure you've completed the OAuth flow
- Check that your Client ID is correct

**"Connection failed" error:**
- Verify your API Key is correct
- Ensure Google Sheets API is enabled in your project
- Check that the Sheet ID is correct

**"Access denied" error:**
- Make sure your Google Sheet is accessible
- Verify you're signed in with the correct Google account

**"Not enough empty rows" error:**
- Your sheet rows A13:A66 might be full
- Clear some rows or expand the range

### Security Notes

- Keep your API Key and Client ID secure
- Don't share these credentials publicly
- Consider restricting your API Key to specific domains
- The OAuth flow ensures secure access to your sheets

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Google Cloud Console settings
3. Ensure all APIs are properly enabled
4. Test with a simple sheet first

## Features

- ✅ Automatic cell mapping to your template
- ✅ Serial number auto-increment
- ✅ Date formatting (DD/MM/YYYY)
- ✅ Vendor and description combination
- ✅ Preserves existing data (adds to empty rows)
- ✅ Batch export of multiple expenses
- ✅ Real-time authentication status
- ✅ Connection testing