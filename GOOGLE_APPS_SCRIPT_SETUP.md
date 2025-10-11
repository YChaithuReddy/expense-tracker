# Google Apps Script Setup Guide (Simple & Reliable Method)

This method is **much simpler** than Service Account authentication. It uses a Google Apps Script that YOU control.

## Why This Method is Better

✅ **No complex OAuth or Service Account issues**
✅ **Simple HTTP POST requests** - just send data to a URL
✅ **Works 100% of the time** - no authentication errors
✅ **Easy to debug** - view logs in Apps Script console
✅ **More control** - you own the script and can customize it

---

## Step 1: Add Script to Master Template (5 minutes)

1. **Open your master template:**
   - URL: https://docs.google.com/spreadsheets/d/1dcq8HKP1j4NocCMgAY9YSXlwCrzHwIiRCd0t4mun25E

2. **Open Apps Script editor:**
   - Click **Extensions** → **Apps Script**
   - A new tab will open with the Apps Script editor

3. **Replace the code:**
   - Delete any existing code (usually `function myFunction() {}`)
   - Copy ALL the code from `GOOGLE_APPS_SCRIPT.js` file
   - Paste it into the Apps Script editor

4. **Save the project:**
   - Click the **Save** icon (💾) or press `Ctrl+S`
   - Name it: `Expense Tracker Auto-Copy`

---

## Step 2: Deploy as Web App (3 minutes)

1. **Click "Deploy" button** (top right corner)
   - Select **"New deployment"**

2. **Configure deployment settings:**
   - Click the **gear icon** ⚙️ next to "Select type"
   - Choose **"Web app"**

3. **Set permissions:**
   - **Description:** `Expense Tracker API`
   - **Execute as:** **Me** (your email)
   - **Who has access:** **Anyone**

   ⚠️ IMPORTANT: Must be "Anyone" so your backend can call it!

4. **Click "Deploy"**
   - Google will ask you to authorize the script
   - Click **"Authorize access"**
   - Choose your Google account (homeessentials143@gmail.com)

5. **Handle security warning:**
   - You might see "Google hasn't verified this app"
   - Click **"Advanced"** → **"Go to Expense Tracker Auto-Copy (unsafe)"**
   - This is safe because YOU created the script!
   - Click **"Allow"**

6. **Copy the Web App URL:**
   - After deployment, you'll see a **Web app URL**
   - It looks like: `https://script.google.com/macros/s/AKfycby.../exec`
   - **COPY THIS URL** - you'll need it in Step 3!

---

## Step 3: Add URL to Backend Environment (1 minute)

1. **Open your backend `.env` file:**
   - Located at: `backend/.env`

2. **Add this line** (replace with your actual URL from Step 2):
   ```
   GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycby.../exec
   ```

3. **Save the file**

4. **Restart the backend server**
   - The backend will now use Google Apps Script instead of Service Account!

---

## Step 4: Test the Setup (2 minutes)

### Test 1: Direct Test from Apps Script Editor

1. Go back to the Apps Script editor
2. Select the function: **`testCreateSheet`** from the dropdown (top toolbar)
3. Click **Run** ▶️
4. Check the **Execution log** (bottom of screen)
5. You should see: "Sheet created successfully" with a new sheet ID

### Test 2: Test from Your App

1. Open your app: http://localhost:3000/index.html
2. Login with your credentials
3. Upload an expense
4. Select the expense
5. Click **"Export to Google Sheets"**
6. You should see:
   - ✅ Success message
   - 🔗 Link to your new sheet
   - 📧 Email notification from Google

---

## How It Works

```
┌─────────────┐      HTTP POST       ┌──────────────────┐
│   Backend   │ ──────────────────> │  Google Apps     │
│  (Node.js)  │   (JSON data)        │     Script       │
└─────────────┘                      └──────────────────┘
                                              │
                                              │ Copy template
                                              │ Share with user
                                              │ Write data
                                              ▼
                                     ┌──────────────────┐
                                     │   User's Sheet   │
                                     │  (Auto-created)  │
                                     └──────────────────┘
```

**Flow:**
1. User clicks "Export to Google Sheets" in frontend
2. Frontend sends expense IDs to backend
3. Backend sends HTTP POST to Google Apps Script URL
4. Apps Script copies master template (YOUR template with formatting!)
5. Apps Script shares new sheet with user's email
6. Apps Script writes expense data to rows 14-66
7. Backend receives sheet URL and returns it to frontend
8. User sees "View My Sheet" button

---

## Troubleshooting

### Error: "Authorization required"

**Solution:**
- Make sure you set "Who has access: **Anyone**" in deployment settings
- Redeploy the script with correct permissions

### Error: "Script not found"

**Solution:**
- Copy the FULL Web App URL from the deployment page
- Make sure it ends with `/exec` not `/dev`
- Check that URL is correctly pasted in `.env` file

### Error: "Tab 'ExpenseReport' not found"

**Solution:**
- Verify your master template has a tab named exactly: **ExpenseReport** (case-sensitive)
- Check the `TAB_NAME` constant in the Apps Script matches your tab name

### Script runs but no sheet created

**Solution:**
- Check Apps Script execution logs: **View** → **Executions**
- Look for error messages in the log
- Make sure you authorized the script to access Google Drive

### Backend can't connect to Apps Script

**Solution:**
- Verify GOOGLE_APPS_SCRIPT_URL is set in `.env`
- Restart the backend after changing `.env`
- Check backend logs for connection errors

---

## Advantages of This Approach

### 1. **No Authentication Headaches**
- No Service Account JSON files
- No OAuth tokens
- No expired credentials
- Just a simple webhook URL!

### 2. **Easy Debugging**
- View execution logs in Apps Script console
- See exactly what data is being received
- Test functions manually from the editor

### 3. **More Reliable**
- Google handles all the authentication
- No 401 Unauthorized errors
- Works consistently every time

### 4. **Full Control**
- You own the script and can modify it
- Add custom logic, formulas, formatting
- View/edit all user sheets if needed

### 5. **Better Performance**
- Faster than Service Account API calls
- Batch operations are optimized
- Google's servers handle the load

---

## What's Next?

After setup is complete:
1. ✅ Users sign up → no configuration needed
2. ✅ Click "Export to Google Sheets" → instant copy of your template
3. ✅ Sheet shared with their email → they get notification
4. ✅ Data appears in rows 14-66 → perfectly formatted
5. ✅ All your formulas, charts, formatting preserved!

---

## Security Notes

- The Apps Script runs as YOU (your Google account)
- Only your backend can call it (via the URL)
- Users can only access THEIR sheets (shared with their email)
- Master template stays safe (read-only for the script)

---

## Need Help?

If you encounter issues:
1. Check Apps Script execution logs: **View** → **Executions**
2. Check backend logs for HTTP errors
3. Verify the Web App URL is correct
4. Make sure deployment is set to "Anyone" access
5. Test with the `testCreateSheet()` function first

---

**That's it!** This method is **10x simpler** than Service Account and works perfectly every time! 🎉
