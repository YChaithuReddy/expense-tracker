# 🚀 Expense Tracker - Production Deployment Guide

## Prerequisites

Before deploying, make sure you have:
- ✅ MongoDB Atlas database (already configured)
- ✅ Cloudinary account (already configured)
- ✅ GitHub repository with latest code
- ✅ Railway account (for backend) - Sign up at https://railway.app
- ✅ Vercel account (for frontend) - Sign up at https://vercel.com

---

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Account
1. Go to https://railway.app
2. Click "Login with GitHub"
3. Authorize Railway to access your repositories

### 1.2 Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository: `YChaithuReddy/expense-tracker`
4. Railway will detect the `backend` folder

### 1.3 Configure Backend Service
1. Click on the deployed service
2. Go to "Settings" tab
3. Set **Root Directory**: `backend`
4. Set **Start Command**: `npm start`

### 1.4 Add Environment Variables
Go to "Variables" tab and add these:

```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://chaithanya_db_expensetracker:ynMlxPUyPQb0HNc4@expense-tracker.ygrtsmh.mongodb.net/expense-tracker?retryWrites=true&w=majority
JWT_SECRET=e3c984bae5c4f632dd67b490a2e0fe69504dc4b0057d6578150b9416efa10b92
JWT_EXPIRE=7d
CLOUDINARY_CLOUD_NAME=dqfycr809
CLOUDINARY_API_KEY=892476647199981
CLOUDINARY_API_SECRET=gZZlw4vkzVrH1F2_Onn2PNu5-y8
FRONTEND_URL=https://your-frontend-url.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**IMPORTANT**: You'll update `FRONTEND_URL` after deploying frontend in Step 2

### 1.5 Deploy
1. Click "Deploy"
2. Wait for deployment to complete (2-3 minutes)
3. Copy your backend URL (e.g., `https://your-app.up.railway.app`)
4. Test it: Open `https://your-app.up.railway.app/api/health` - should return JSON

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Account
1. Go to https://vercel.com
2. Click "Sign Up"
3. Sign up with GitHub

### 2.2 Import Project
1. Click "Add New..." → "Project"
2. Import your GitHub repository: `YChaithuReddy/expense-tracker`
3. Click "Import"

### 2.3 Configure Frontend
1. **Root Directory**: Set to `frontend`
2. **Framework Preset**: Select "Other" (vanilla JavaScript)
3. **Build Command**: Leave empty (static site)
4. **Output Directory**: Leave as `.` (current directory)

### 2.4 Deploy
1. Click "Deploy"
2. Wait for deployment (1-2 minutes)
3. Copy your frontend URL (e.g., `https://expense-tracker-abc123.vercel.app`)

---

## Step 3: Update Configuration

### 3.1 Update Backend CORS (Railway)
1. Go back to Railway dashboard
2. Click on your backend service
3. Go to "Variables" tab
4. Update `FRONTEND_URL` to your Vercel URL:
   ```
   FRONTEND_URL=https://expense-tracker-abc123.vercel.app
   ```
5. Save changes (Railway will auto-redeploy)

### 3.2 Update Frontend API URL
1. Open your local project
2. Edit `frontend/api.js`
3. Change line 1:
   ```javascript
   // OLD:
   const API_BASE_URL = 'http://localhost:5000/api';

   // NEW:
   const API_BASE_URL = 'https://your-app.up.railway.app/api';
   ```
4. Save the file

### 3.3 Commit and Push Changes
```bash
git add frontend/api.js
git commit -m "Update API URL for production deployment

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

### 3.4 Vercel Auto-Deploy
- Vercel will automatically detect the change and redeploy
- Wait 1-2 minutes for the new deployment
- Your frontend will now connect to the production backend

---

## Step 4: Test Production Deployment

### 4.1 Test Backend
1. Open: `https://your-app.up.railway.app/api/health`
2. Should return:
   ```json
   {
     "status": "success",
     "message": "Expense Tracker API is running",
     "timestamp": "2025-10-11T..."
   }
   ```

### 4.2 Test Frontend
1. Open: `https://expense-tracker-abc123.vercel.app`
2. Should redirect to login page
3. Try signing up with a new account
4. Login and test the full flow:
   - Upload bill
   - OCR scan
   - Add expense
   - View expenses
   - Configure Google Sheets
   - Export to Google Sheets

---

## Step 5: Configure Custom Domain (Optional)

### For Railway Backend:
1. Go to Railway dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as instructed

### For Vercel Frontend:
1. Go to Vercel dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as instructed

---

## 🎉 Deployment Complete!

Your app is now live and accessible to anyone!

**Your Live URLs:**
- Frontend: `https://expense-tracker-abc123.vercel.app`
- Backend: `https://your-app.up.railway.app`
- Database: MongoDB Atlas (secure cloud)
- Images: Cloudinary (secure cloud)

---

## Monitoring & Logs

### Railway (Backend Logs):
1. Go to Railway dashboard
2. Click on your service
3. Go to "Deployments" tab
4. Click "View Logs"

### Vercel (Frontend Logs):
1. Go to Vercel dashboard
2. Click on your project
3. Go to "Deployments" tab
4. Click on any deployment to see logs

---

## Troubleshooting

### Backend Issues:
- Check Railway logs for errors
- Verify environment variables are set correctly
- Test MongoDB connection
- Check Cloudinary credentials

### Frontend Issues:
- Check browser console for errors
- Verify API_BASE_URL is correct
- Check CORS settings in backend
- Test API health endpoint

### Common Errors:

**CORS Error:**
- Update `FRONTEND_URL` in Railway environment variables
- Make sure it matches your Vercel URL exactly (no trailing slash)

**MongoDB Connection Error:**
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas network access (allow all IPs: 0.0.0.0/0)

**Cloudinary Upload Error:**
- Verify Cloudinary credentials
- Check Cloudinary quota (free tier: 25GB)

---

## Free Tier Limits

### Railway:
- $5 credit per month (usually enough for small apps)
- 500 hours of compute
- Auto-sleeps after inactivity (wakes on request)

### Vercel:
- 100GB bandwidth per month
- Unlimited deployments
- Auto-scaling

### MongoDB Atlas:
- 512MB storage (free forever)
- Shared cluster

### Cloudinary:
- 25GB storage
- 25GB bandwidth per month

---

## Security Notes

### Important Security Measures Already in Place:
- ✅ JWT authentication
- ✅ Password hashing (bcrypt)
- ✅ Rate limiting
- ✅ CORS protection
- ✅ Helmet security headers
- ✅ Input validation
- ✅ Environment variables for secrets

### Additional Recommendations:
- Use strong JWT_SECRET (already done)
- Enable MongoDB IP whitelist (optional, can add specific IPs)
- Monitor Railway logs for suspicious activity
- Keep dependencies updated: `npm audit fix`

---

## Sharing with Friends

Your friends can now:
1. Go to your Vercel URL
2. Sign up with their email
3. Start using the app immediately
4. Configure their own Google Sheets
5. Export to their own spreadsheets

Each user has:
- ✅ Their own account
- ✅ Their own expenses
- ✅ Their own Google Sheets config
- ✅ Complete data isolation

---

## Need Help?

If you encounter any issues during deployment:
1. Check the troubleshooting section above
2. Review Railway/Vercel logs
3. Test each component individually
4. Verify all environment variables

---

🎊 **Congratulations! Your app is live and ready for the world!** 🎊
