# Quick Start - Google Apps Script Setup

## What You Need to Do (Only 3 Steps!)

### Step 1: Add Script to Your Master Template (5 minutes)

1. **Open your master template:**
   ```
   https://docs.google.com/spreadsheets/d/1dcq8HKP1j4NocCMgAY9YSXlwCrzHwIiRCd0t4mun25E
   ```

2. **Click: Extensions → Apps Script**

3. **Delete everything** in the editor

4. **Copy the entire code** from `GOOGLE_APPS_SCRIPT.js` file

5. **Paste it** into the Apps Script editor

6. **Save** (Ctrl+S) and name it: `Expense Tracker Auto-Copy`

---

### Step 2: Deploy as Web App (3 minutes)

1. **Click "Deploy"** (top right) → **"New deployment"**

2. **Click gear icon ⚙️** → Select **"Web app"**

3. **Configure:**
   - Execute as: **Me** (homeessentials143@gmail.com)
   - Who has access: **Anyone**

4. **Click "Deploy"**
   - Authorize when prompted
   - If you see security warning, click "Advanced" → "Go to app (unsafe)" → "Allow"

5. **COPY THE WEB APP URL!**
   ```
   It looks like: https://script.google.com/macros/s/AKfycby.../exec
   ```

---

### Step 3: Add URL to Backend (1 minute)

1. **Open:** `backend/.env`

2. **Add this line** (replace with YOUR URL from Step 2):
   ```
   GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycby.../exec
   ```

3. **Save the file**

4. **Restart backend:**
   - Stop the current backend (Ctrl+C)
   - Run: `npm start`

---

## That's It! ✅

Now when a user:
1. Signs up
2. Uploads a bill
3. Clicks "Export to Google Sheets"

**Automatically:**
- ✅ New sheet created (copy of your template)
- ✅ Sheet shared with their email
- ✅ Data exported to rows 14-66
- ✅ User gets email notification
- ✅ "View My Sheet" button appears

---

## Cell Mapping (Already Configured!)

Your exact template structure is pre-configured:

| Column | Range | Field | Example |
|--------|-------|-------|---------|
| A | A14:A66 | S.NO | 1, 2, 3... |
| B | B14:B66 | DATE | 20-Mar-2025 |
| C-D | C14:D66 | VENDOR NAME | Starbucks (merged) |
| E | E14:E66 | CATEGORY | Food & Beverage |
| F | F14:F66 | COST | 15.50 |

**Rows 1-13:** Headers (never touched, always preserved)
**Rows 14-66:** Data (53 expenses capacity per sheet)

---

## Test It!

After setup, test with the built-in test function:

1. In Apps Script editor, select function: **`testCreateSheet`**
2. Click **Run** ▶️
3. Check the log - should say "Sheet created successfully"
4. Check your Google Drive - new test sheet should appear!

---

## Why This Method is Better

❌ **Service Account Method:**
- Complex JSON credentials
- Authentication errors
- "Missing required authentication credential"
- Hard to debug

✅ **Google Apps Script Method:**
- Just a simple URL
- No authentication issues
- Works 100% of the time
- Easy to debug (view logs)
- More control

---

## Need Help?

📖 **Detailed Guide:** See `GOOGLE_APPS_SCRIPT_SETUP.md`
📖 **How It Works:** See `HOW_NEW_USER_GETS_SHEET.md`
📖 **Code File:** See `GOOGLE_APPS_SCRIPT.js`

---

**Ready? Follow the 3 steps above and you're done!** 🚀
