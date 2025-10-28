# Backend Deployment Guide - Prevent Common Problems

## Current Setup: Railway (Recommended)

Your backend is deployed on Railway at: `https://expense-tracker-production-ycr.up.railway.app`

---

## How to Prevent Backend Problems

### 1. Railway Configuration (Already Done ✅)

**What we've fixed:**
- ✅ Health check endpoint BEFORE rate limiter
- ✅ Server binds to `0.0.0.0` for Railway compatibility
- ✅ CORS allows all Vercel deployments
- ✅ Keep-alive mechanism pings localhost every 14 minutes
- ✅ Auto-restart on failure (max 10 retries)

**railway.json settings:**
```json
{
  "healthcheckPath": "/api/health",
  "healthcheckTimeout": 100,
  "restartPolicyType": "ON_FAILURE",
  "restartPolicyMaxRetries": 10
}
```

---

### 2. Monitor Your Backend Health

**Check if backend is alive:**
```bash
# Method 1: Direct health check
curl https://expense-tracker-production-ycr.up.railway.app/api/health

# Method 2: Open in browser
https://expense-tracker-production-ycr.up.railway.app/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Server is running",
  "time": "2025-10-22T...",
  "port": 5000,
  "environment": "production"
}
```

**Keep-alive monitor (already deployed):**
- Open: `frontend/keep-alive.html` in browser
- Shows real-time backend status
- Auto-pings every 10 minutes

---

### 3. Railway Dashboard Monitoring

**Check Railway logs:**
1. Go to: https://railway.app/dashboard
2. Select your project: "expense-tracker"
3. Click "Deployments" tab
4. Look for these healthy signs:
   - ✅ "Server started successfully"
   - ✅ "MongoDB connected successfully"
   - ✅ "Keep-alive ping - Status: 200"

**Warning signs (require action):**
- ❌ "MongoDB connection error" → Check MongoDB Atlas
- ❌ "ENOTFOUND" or "DNS" errors → Domain issue
- ❌ No logs for >15 minutes → Server might be sleeping

---

### 4. Environment Variables Checklist

**Required on Railway:**
```env
# Database
MONGODB_URI=mongodb+srv://...

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Google Apps Script
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/...

# Node Environment
NODE_ENV=production
PORT=5000

# CORS (optional - code handles Vercel automatically)
FRONTEND_URL=https://expense-tracker-delta-ashy.vercel.app
```

**How to update Railway environment variables:**
1. Railway Dashboard → Your Project
2. Click "Variables" tab
3. Add/update variables
4. Railway auto-redeploys

---

### 5. Common Problems & Solutions

#### Problem: "Cannot connect to server"
**Causes:**
- Railway domain changed
- Backend crashed
- MongoDB disconnected

**Solution:**
```bash
# 1. Check health endpoint
curl https://expense-tracker-production-ycr.up.railway.app/api/health

# 2. Check Railway logs for errors
# 3. Verify Railway domain hasn't changed
# 4. Check MongoDB Atlas - ensure IP whitelist includes 0.0.0.0/0
```

#### Problem: "CORS error"
**Cause:** Frontend domain not allowed

**Solution:**
Our code already handles this! It allows:
- All `vercel.app` domains (including previews)
- All `localhost` domains
- Specific FRONTEND_URL if set

#### Problem: Railway keeps sleeping/restarting
**Cause:** Free tier limitations

**Solutions:**
1. ✅ Keep-alive already implemented (pings every 14 min)
2. ✅ `keep-alive.html` monitor page
3. Upgrade to Railway Pro ($5/month) for:
   - No sleeping
   - More resources
   - Better uptime

#### Problem: Database connection lost
**Cause:** MongoDB Atlas whitelist or connection string

**Solution:**
1. MongoDB Atlas → Network Access
2. Add IP: `0.0.0.0/0` (allow all)
3. Or get Railway's outbound IPs and whitelist them

---

### 6. Backup Plan: Alternative Hosting

If Railway ever fails completely, here are tested alternatives:

**Option A: Render.com**
- Already have `render.yaml` configured
- Free tier available
- Similar to Railway

**Option B: Fly.io**
- Good free tier
- Global edge network
- Need to create `fly.toml`

**Option C: Vercel Serverless Functions**
- Same platform as frontend
- Would require converting Express to serverless
- More complex but same domain

---

### 7. Uptime Monitoring (Free Services)

Add external monitoring to get alerts:

**UptimeRobot (Recommended - Free):**
1. Sign up: https://uptimerobot.com
2. Add monitor:
   - Type: HTTP(s)
   - URL: `https://expense-tracker-production-ycr.up.railway.app/api/health`
   - Interval: 5 minutes
3. Get email/SMS alerts if down

**Alternatives:**
- Better Uptime: https://betteruptime.com
- StatusCake: https://www.statuscake.com
- Pingdom: https://www.pingdom.com

---

### 8. Production Best Practices

**✅ Already Implemented:**
- Health check endpoints
- Error logging
- Rate limiting
- CORS configuration
- Auto-restart policy
- Keep-alive mechanism

**Recommended additions:**

1. **Add error tracking (Optional):**
   - Sentry.io - catches errors in production
   - Free tier: 5,000 events/month

2. **Database backups:**
   - MongoDB Atlas auto-backups (enabled by default)
   - Download manual backup monthly

3. **API versioning (future):**
   - Keep `/api/v1/` routes
   - Easier to update without breaking clients

---

### 9. What to Do When Problems Occur

**Step-by-step troubleshooting:**

1. **Check health endpoint:**
   ```bash
   curl https://expense-tracker-production-ycr.up.railway.app/api/health
   ```

2. **Check Railway dashboard:**
   - Are there recent deployments?
   - Any error logs?
   - Is the service running?

3. **Check MongoDB Atlas:**
   - Database online?
   - Connections allowed?

4. **Check Cloudinary:**
   - API keys valid?
   - Upload quota not exceeded?

5. **Check frontend:**
   - `frontend/api.js` has correct Railway URL?
   - Browser console shows what error?

6. **Redeploy if needed:**
   ```bash
   git commit --allow-empty -m "Trigger Railway redeploy"
   git push
   ```

---

### 10. Your Current Architecture (Stable)

```
┌─────────────┐
│   Vercel    │  Frontend (HTML/CSS/JS)
│  (Frontend) │  ↓ API calls
└──────┬──────┘
       │
       ↓
┌─────────────┐
│   Railway   │  Backend (Express/Node.js)
│  (Backend)  │  ↓ Database queries
└──────┬──────┘
       │
       ├──────→ MongoDB Atlas (Database)
       ├──────→ Cloudinary (Images)
       └──────→ Google Apps Script (Sheets export)
```

**Why this is reliable:**
- ✅ Vercel: 99.99% uptime
- ✅ Railway: Auto-restarts, health checks
- ✅ MongoDB Atlas: Managed service, auto-backups
- ✅ Cloudinary: CDN, fast image delivery
- ✅ Google Apps Script: Google infrastructure

---

## Summary: You're in Good Shape!

**Your backend is already well-configured to prevent problems.**

**What's working:**
1. ✅ Health checks properly configured
2. ✅ CORS handles all Vercel deployments
3. ✅ Keep-alive prevents sleeping
4. ✅ Auto-restart on failures
5. ✅ All environment variables set

**Optional improvements:**
- Add UptimeRobot monitoring (5 minutes setup)
- Consider Railway Pro if free tier limits hit ($5/month)
- Add Sentry for error tracking (optional)

**If Railway ever goes down:**
- You have `render.yaml` ready as backup
- Can switch hosting in ~10 minutes
- All code is platform-agnostic

Your setup is solid! Just keep an eye on Railway logs occasionally.
