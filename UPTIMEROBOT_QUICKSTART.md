# UptimeRobot Quick Start - 5 Minute Setup

Get instant alerts when your backend goes down!

---

## Step 1: Sign Up (2 minutes)

1. **Open:** https://uptimerobot.com

2. **Click:** "Sign Up" button (top right)

3. **Fill in:**
   ```
   Email: your-email@example.com
   Password: [create a password]
   ```

4. **Click:** "Sign Up"

5. **Check email** and verify your account

---

## Step 2: Add Monitor (2 minutes)

1. **Click:** "+ Add New Monitor" (big blue button)

2. **Fill in exactly:**

   | Field | Value |
   |-------|-------|
   | **Monitor Type** | HTTP(s) |
   | **Friendly Name** | Expense Tracker Backend |
   | **URL** | `https://expense-tracker-production-b501.up.railway.app/api/health` |
   | **Monitoring Interval** | Every 5 minutes |

3. **Click:** "Create Monitor"

✅ **Done! You'll now get email alerts when backend goes down.**

---

## Step 3: Add Phone Number (Optional - 1 minute)

Get SMS alerts too:

1. **Click:** Your email (top right) → "My Settings"

2. **Go to:** "Alert Contacts" tab

3. **Click:** "+ Add New Alert Contact"

4. **Select:** SMS

5. **Enter:** Your phone number

6. **Verify** with code sent to your phone

---

## What Happens Next?

### When Backend is Down:
```
🚨 Email from UptimeRobot:

Subject: Expense Tracker Backend is DOWN

Your monitor "Expense Tracker Backend" is DOWN.
URL: https://expense-tracker-production-b501.up.railway.app/api/health
Started: Oct 22, 2025 at 3:45 PM
Reason: Connection timeout

[View Monitor]
```

### When Backend Comes Back:
```
✅ Email from UptimeRobot:

Subject: Expense Tracker Backend is UP

Your monitor "Expense Tracker Backend" is UP.
Downtime: 7 minutes

[View Monitor]
```

---

## View Dashboard

**See stats anytime:**

1. Go to: https://uptimerobot.com/dashboard

2. **You'll see:**
   - ✅ or ❌ Status
   - Uptime % (should be >99%)
   - Response time graph
   - Last 24 hours activity

---

## Optional: Add More Monitors

Monitor your frontend too:

1. **Click:** "+ Add New Monitor"

2. **Fill in:**
   - **Name:** Expense Tracker Frontend
   - **URL:** `https://expense-tracker-delta-ashy.vercel.app`
   - **Interval:** Every 5 minutes

3. **Click:** "Create Monitor"

**You can add up to 50 monitors for free!**

---

## What to Do When You Get an Alert

**Don't panic! Follow these steps:**

### 1. Check if backend is really down
```bash
# Open in browser:
https://expense-tracker-production-b501.up.railway.app/api/health

# Or run:
cd backend
npm run health
```

### 2. Check Railway dashboard
- Go to: https://railway.app/dashboard
- Look at logs for errors

### 3. If backend is actually down
```bash
# Force redeploy
git commit --allow-empty -m "Redeploy backend"
git push
```

### 4. Wait for "UP" alert
- Usually fixes in 1-2 minutes
- UptimeRobot will email you when it's back up

---

## Free Plan Includes:

✅ **50 monitors** - More than you need
✅ **5-minute checks** - Fast enough
✅ **Email alerts** - Unlimited
✅ **SMS alerts** - Limited but useful
✅ **2 months logs** - See history
✅ **Public status page** - Optional

**This is all you need! No need to upgrade.**

---

## Advanced: API Management (Optional)

If you want to manage monitors via code:

### 1. Get API Key
- My Settings → API Settings
- Copy "Main API Key"

### 2. Add to .env file
```
UPTIMEROBOT_API_KEY=your_api_key_here
```

### 3. Use npm commands
```bash
# List all monitors
npm run uptime:list

# Check status
npm run uptime:status

# Create monitors automatically
npm run uptime:create
```

**But manual setup through website is easier!**

---

## Troubleshooting

### Not getting alerts?

1. Check spam folder
2. Go to My Settings → Alert Contacts
3. Make sure email is verified
4. Test alert: Edit monitor → Click "Test Alert"

### Too many false alerts?

- Edit monitor
- Change "Send alert when down for" to **2 checks** (10 minutes)
- This ignores brief restarts

### Monitor shows down but works in browser?

- UptimeRobot might be having issues
- Wait 10 minutes and check again
- Verify URL is exactly correct (copy-paste from above)

---

## That's It!

**You're all set! Your backend is now monitored 24/7.**

**What you have:**
- ✅ Checks every 5 minutes
- ✅ Email alerts when down
- ✅ Uptime tracking
- ✅ Free forever

**Maintenance:** Zero - it's all automatic!

---

## Quick Links

- **Dashboard:** https://uptimerobot.com/dashboard
- **Backend Health:** https://expense-tracker-production-b501.up.railway.app/api/health
- **Detailed Guide:** See `backend/SETUP_UPTIMEROBOT.md`

**Questions? Check the detailed guide in `backend/SETUP_UPTIMEROBOT.md`**
