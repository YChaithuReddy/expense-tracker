# Quick Start Guide - Expense Tracker Full Stack

## What We've Built

A complete full-stack expense tracker with:
- ✅ **Backend API** (Node.js + Express + MongoDB)
- ✅ **User Authentication** (JWT-based)
- ✅ **Image Uploads** (Cloudinary)
- ✅ **Complete CRUD** operations
- ✅ **Security** (Rate limiting, CORS, Helmet)

## Project Structure

```
expense-tracker/
├── backend/                 # Backend API (NEW!)
│   ├── config/             # Database configuration
│   ├── models/             # MongoDB schemas (User, Expense)
│   ├── routes/             # API routes (auth, expenses)
│   ├── middleware/         # Auth & upload middleware
│   ├── utils/              # JWT, validators
│   ├── server.js           # Main server file
│   ├── package.json        # Dependencies
│   └── .env.example        # Environment template
│
├── frontend/               # (Will be created next)
│   ├── login.html         # Login page (TO BE CREATED)
│   ├── signup.html        # Signup page (TO BE CREATED)
│   ├── index.html         # Main app (EXISTING)
│   ├── styles.css         # Styles (EXISTING)
│   ├── script.js          # App logic (TO BE MODIFIED)
│   ├── auth.js            # Auth logic (TO BE CREATED)
│   └── api.js             # API wrapper (TO BE CREATED)
│
├── .gitignore             # Git ignore file
└── FULL_STACK_DEPLOYMENT_GUIDE.md  # Complete deployment guide
```

## Next Steps

### Phase 1: Test Backend Locally (30 minutes)

1. **Install Dependencies**:
```bash
cd backend
npm install
```

2. **Setup Environment Variables**:
```bash
# Copy .env.example to .env
copy .env.example .env

# Edit .env file with these values:
# - Use local MongoDB: mongodb://localhost:27017/expense-tracker
# - Or skip to Phase 2 and use MongoDB Atlas
# - Generate JWT_SECRET: any random 32+ character string
# - Cloudinary credentials: from cloudinary.com dashboard
```

3. **Start Backend**:
```bash
npm run dev
```

4. **Test API**:
Open browser: `http://localhost:5000/api/health`

Should see:
```json
{
  "status": "success",
  "message": "Expense Tracker API is running"
}
```

### Phase 2: Setup Cloud Services (1 hour)

Follow detailed instructions in `FULL_STACK_DEPLOYMENT_GUIDE.md`:

1. **MongoDB Atlas** (5 minutes)
   - Create free cluster
   - Get connection string
   - Update .env

2. **Cloudinary** (5 minutes)
   - Create free account
   - Get credentials
   - Update .env

3. **Test with cloud services**:
```bash
npm run dev
```

### Phase 3: Create Frontend Authentication Pages (Next Session)

We need to create:
1. `frontend/login.html` - Login page
2. `frontend/signup.html` - Signup page
3. `frontend/auth.js` - Authentication logic
4. `frontend/api.js` - API communication
5. Modify `frontend/script.js` - Connect to backend

**Would you like me to create these frontend files now?**

### Phase 4: Deploy to Production (1 hour)

Follow `FULL_STACK_DEPLOYMENT_GUIDE.md` for:
1. Push code to GitHub
2. Deploy backend to Railway
3. Deploy frontend to Vercel
4. Configure environment variables
5. Test production deployment

## Testing the Backend API

### Using curl (Command Line)

**Health Check**:
```bash
curl http://localhost:5000/api/health
```

**Register User**:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"John Doe\",\"email\":\"john@example.com\",\"password\":\"Password123\"}"
```

**Login User**:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"john@example.com\",\"password\":\"Password123\"}"
```

Save the token from response!

**Create Expense** (replace YOUR_TOKEN):
```bash
curl -X POST http://localhost:5000/api/expenses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2025-01-15\",\"category\":\"Meals\",\"amount\":250.50,\"description\":\"Team lunch\",\"vendor\":\"Restaurant ABC\",\"time\":\"14:30\"}"
```

**Get All Expenses**:
```bash
curl -X GET http://localhost:5000/api/expenses \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using Postman (Recommended)

1. Download Postman: https://www.postman.com/downloads/
2. Import API collection (I can create one)
3. Test all endpoints visually

## API Endpoints Quick Reference

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires token)

### Expenses
- `GET /api/expenses` - Get all user expenses (requires token)
- `POST /api/expenses` - Create expense (requires token)
- `PUT /api/expenses/:id` - Update expense (requires token)
- `DELETE /api/expenses/:id` - Delete expense (requires token)

All endpoints return JSON.

## Environment Variables Needed

```env
# Backend (.env file in backend/ directory)
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/expense-tracker  # or MongoDB Atlas
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_EXPIRE=7d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:3000  # or production URL
```

## Common Issues & Solutions

### Backend won't start
```
Error: Cannot find module 'express'
Solution: Run 'npm install' in backend directory
```

### MongoDB connection error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
Solution:
1. Install MongoDB locally, OR
2. Use MongoDB Atlas (see deployment guide)
```

### Cloudinary upload fails
```
Error: Invalid API credentials
Solution:
1. Verify credentials in .env
2. Check for extra spaces or quotes
3. Get new credentials from cloudinary.com
```

## What's Different from Before?

### Before (Client-Side Only):
- ❌ Data stored in browser localStorage
- ❌ No authentication
- ❌ Single user only
- ❌ Data lost if cache cleared
- ❌ No cloud storage

### Now (Full-Stack):
- ✅ Data stored in cloud database (MongoDB)
- ✅ User authentication with JWT
- ✅ Multi-user support
- ✅ Data persists across devices
- ✅ Images stored in cloud (Cloudinary)
- ✅ Secure API endpoints
- ✅ Ready for public deployment

## Cost Breakdown

**Free Tier (0-100 users)**: **$0/month**
- MongoDB Atlas: 512MB free
- Railway: 500 hours free
- Vercel: Unlimited deployments
- Cloudinary: 25GB free

**Paid Tier (100-1000 users)**: **~$30/month**
- MongoDB Atlas M2: $9/month
- Railway Starter: $5/month
- Cloudinary: $10/month
- Vercel Pro: $7/month (optional)

## Timeline Completed ✅

- ✅ Phase 1: Backend Setup (DONE - 100%)
- ⏳ Phase 2: Frontend Integration (NEXT - 0%)
- ⏳ Phase 3: Deployment (After Phase 2)
- ⏳ Phase 4: Testing & Launch (Final step)

## Current Status

**What's Ready**:
1. ✅ Complete backend API with authentication
2. ✅ Database models (User, Expense)
3. ✅ JWT authentication system
4. ✅ Image upload to Cloudinary
5. ✅ API security (CORS, rate limiting, validation)
6. ✅ Deployment documentation

**What's Next**:
1. ⏳ Create login/signup pages
2. ⏳ Integrate frontend with backend API
3. ⏳ Replace localStorage with API calls
4. ⏳ Add authentication flow
5. ⏳ Deploy to production

## Decision Point

**Would you like to**:
1. **Test the backend locally first** (recommended)
2. **Go straight to frontend integration** (create login/signup pages)
3. **Deploy backend to production first** (then work on frontend)

Let me know which path you'd like to take! 🚀
