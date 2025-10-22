# UptimeRobot Setup Guide - Backend Monitoring

Get instant email/SMS alerts when your backend goes down!

---

## Step-by-Step Setup (5 minutes)

### Step 1: Create Account

1. **Go to:** https://uptimerobot.com
2. **Click:** "Sign Up" (top right)
3. **Enter:**
   - Email address
   - Password
4. **Click:** "Sign Up"
5. **Verify** your email (check inbox)

---

### Step 2: Add Your First Monitor

Once logged in:

1. **Click:** "+ Add New Monitor" (big button at top)

2. **Fill in the form:**

   **Monitor Type:** `HTTP(s)`

   **Friendly Name:** `Expense Tracker Backend`

   **URL (or IP):** `https://expense-tracker-production-b501.up.railway.app/api/health`

   **Monitoring Interval:** `5 minutes` (free tier allows this)

   **Monitor Timeout:** `30 seconds`

   **Advanced Settings (optional):**
   - HTTP Method: `GET`
   - Keyword Check: Leave blank (we check status code only)

3. **Click:** "Create Monitor"

✅ Done! Your monitor is now active.

---

### Step 3: Set Up Alerts

By default, alerts go to your email. To add more alert methods:

1. **Click:** "My Settings" (top right menu)
2. **Go to:** "Alert Contacts" tab
3. **Add contacts:**
   - Email (already added)
   - SMS (click "+ Add New Alert Contact")
   - Webhook
   - Slack
   - Discord
   - Telegram

**Recommended:** Add your phone number for SMS alerts!

---

### Step 4: Customize Alert Settings

**When to get alerts:**

1. **Go to:** Your monitor → Edit
2. **Scroll to:** "Alert Contacts to Notify"
3. **Choose:**
   - ✅ When monitor goes down
   - ✅ When monitor comes back up
   - ⬜ When monitor is still down (optional - can be spammy)

**How many checks before alerting:**

1. **Monitor settings** → "Send alerts when down for"
2. **Recommended:** `1 check` (get instant alerts)
   - Free tier checks every 5 minutes
   - You'll get alert within 5 minutes of downtime

---

## What You'll Get

### When Backend Goes Down:
```
🚨 UptimeRobot Alert

Monitor: Expense Tracker Backend
Status: DOWN
URL: https://expense-tracker-production-b501.up.railway.app/api/health
Time: 2025-10-22 15:30:45
Reason: Connection timeout

[View Details]
```

### When Backend Comes Back:
```
✅ UptimeRobot Alert

Monitor: Expense Tracker Backend
Status: UP
URL: https://expense-tracker-production-b501.up.railway.app/api/health
Downtime: 8 minutes
Time: 2025-10-22 15:38:12

[View Details]
```

---

## Optional: Add More Monitors

You can monitor multiple endpoints for free (up to 50 monitors):

### Additional Monitors to Add:

**1. Root Endpoint**
- URL: `https://expense-tracker-production-b501.up.railway.app/`
- Name: `Expense Tracker Backend Root`

**2. Frontend**
- URL: `https://expense-tracker-delta-ashy.vercel.app/`
- Name: `Expense Tracker Frontend`

**3. MongoDB Atlas (optional)**
- Can't directly monitor, but monitor API endpoints that use it

**4. Specific API Endpoints (optional)**
- URL: `https://expense-tracker-production-b501.up.railway.app/api/expenses`
- Requires auth token (advanced - not recommended for now)

---

## UptimeRobot Dashboard Features

### Stats You'll See:

1. **Uptime Percentage**
   - 24 hours, 7 days, 30 days, 90 days
   - Goal: >99.5%

2. **Response Time**
   - Average response time
   - Response time graph

3. **Downtime Log**
   - When it went down
   - How long it was down
   - Reason for downtime

4. **Incident History**
   - Full timeline of all incidents

---

## Understanding Alerts

### Common Alert Reasons:

**"Connection timeout"**
- Backend not responding
- Railway might be restarting
- Check Railway logs

**"Keyword not found"**
- Backend responding but wrong content
- Check if health endpoint changed

**"HTTP 500 error"**
- Backend crashed
- Check Railway logs for errors

**"HTTP 404 error"**
- Health endpoint path changed
- Verify URL is correct

**"DNS error"**
- Railway domain changed
- Update monitor URL

---

## Free Tier Limits

**UptimeRobot Free Plan:**
- ✅ 50 monitors
- ✅ 5-minute intervals
- ✅ Email alerts
- ✅ 2 months of logs
- ✅ Public status pages
- ✅ SMS alerts (limit: few per month)

**Paid Plan ($7/month) - Optional:**
- 1-minute intervals
- 6 months of logs
- More SMS alerts
- Advanced notifications

**Free tier is perfect for your needs!**

---

## Advanced: API Integration (Optional)

If you want to manage monitors programmatically:

1. **Get API Key:**
   - My Settings → API Settings
   - Copy "Main API Key"

2. **Use API script:**
   - See: `backend/uptimerobot-api.js`
   - Add monitors, check status, etc.

---

## Troubleshooting

### Issue: Too Many False Alerts

**Solution:**
- Change "Send alerts when down for" to `2 checks` (10 minutes)
- This prevents alerts during brief restarts

### Issue: Not Getting Alerts

**Solution:**
1. Check spam folder
2. Verify email in "Alert Contacts"
3. Check monitor is enabled

### Issue: Monitor Shows Down but Backend Works

**Solution:**
1. Test URL manually in browser
2. Check UptimeRobot status page (they might have issues)
3. Verify URL is exactly correct

---

## Public Status Page (Optional)

Create a public status page to share with others:

1. **Dashboard** → "Status Pages"
2. **Create** new status page
3. **Select** monitors to display
4. **Customize** design
5. **Get URL** like: `https://stats.uptimerobot.com/your-page`
6. **Share** with team or users

---

## Quick Links

- **Dashboard:** https://uptimerobot.com/dashboard
- **Add Monitor:** https://uptimerobot.com/dashboard#mainDashboard
- **My Settings:** https://uptimerobot.com/dashboard#mySettings
- **Documentation:** https://uptimerobot.com/api

---

## What to Do When You Get an Alert

**Step 1: Don't panic** - alerts help you catch issues early

**Step 2: Check health endpoint manually:**
```bash
cd backend
npm run health
```

**Step 3: Check Railway dashboard:**
- https://railway.app/dashboard
- Look for error logs

**Step 4: If backend is down:**
```bash
# Force redeploy
git commit --allow-empty -m "Redeploy backend"
git push
```

**Step 5: Monitor recovery:**
- UptimeRobot will send "UP" alert when fixed
- Typically resolves in 1-2 minutes

---

## Expected Uptime

**Realistic expectations:**

- **99.9% uptime** = ~43 minutes downtime per month ✅ Good
- **99.5% uptime** = ~3.6 hours downtime per month ✅ Acceptable
- **99.0% uptime** = ~7 hours downtime per month ⚠️ Check issues

**Your setup with Railway + MongoDB Atlas should achieve >99.5%**

---

## Monthly Routine (5 minutes)

Once set up, do this monthly:

1. ✅ Check UptimeRobot dashboard
2. ✅ Review uptime percentage (should be >99%)
3. ✅ Check incident log (any patterns?)
4. ✅ Verify alerts are working (test if needed)

---

## Summary

**After setup, you'll have:**

✅ **Automated monitoring** - Checks every 5 minutes
✅ **Instant alerts** - Email + SMS when down
✅ **Uptime tracking** - Historical data
✅ **Incident reports** - Full downtime logs
✅ **Peace of mind** - Know immediately if backend fails

**Setup time:** 5 minutes
**Maintenance:** Automatic
**Cost:** Free forever
**Value:** Priceless for production apps

---

**Now go set it up! 🚀**

Visit: https://uptimerobot.com
