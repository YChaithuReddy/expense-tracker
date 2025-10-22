# 💰 Expense Tracker

A full-stack expense management system with OCR bill scanning, Google Sheets export, and automated reimbursement tracking.

![Status](https://img.shields.io/badge/status-production-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

**Live Demo:** https://expense-tracker-delta-ashy.vercel.app

---

## ✨ Features

### Core Functionality
- 🔐 **Secure Authentication** - JWT-based user authentication
- 📸 **OCR Bill Scanning** - Automatic data extraction from receipt images
- 📊 **Google Sheets Export** - Auto-populate expenses in Google Sheets with dynamic formulas
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- ☁️ **Cloud Storage** - Cloudinary integration for receipt images
- 🔄 **Real-time Sync** - MongoDB Atlas for instant data synchronization

### Advanced Features
- **Smart OCR**: Multi-tier amount detection (context-aware, currency symbols, word amounts)
- **Auto-categorization**: 10 predefined categories with intelligent keyword matching
- **Dynamic Exports**: Google Sheets formulas adapt to data size automatically
- **Image Management**: Orphaned image cleanup with 30-day expiry
- **Data Validation**: Comprehensive input validation and error handling
- **Health Monitoring**: 24/7 uptime tracking with UptimeRobot integration

---

## 🚀 Quick Start

### For Users

1. **Visit the app:** https://expense-tracker-delta-ashy.vercel.app
2. **Create account** or login
3. **Add expenses:**
   - Scan bills with OCR
   - Or add manually
4. **Export to Google Sheets** for reimbursement

### For Developers

```bash
# Clone repository
git clone https://github.com/YChaithuReddy/expense-tracker.git
cd expense-tracker

# Install backend
cd backend
npm install

# Set up environment variables (see Configuration)
cp .env.example .env

# Start backend
npm start

# Frontend is static HTML - open frontend/index.html
# Or use live server
```

---

## 🏗️ Architecture

```
┌─────────────────┐
│  Vercel         │  Static Frontend (HTML/CSS/JS)
│  (Frontend)     │  - Tesseract.js OCR
└────────┬────────┘  - ExcelJS, jsPDF
         │
         ↓ HTTPS/CORS
┌─────────────────┐
│  Railway        │  Node.js/Express Backend
│  (Backend)      │  - REST API
└────────┬────────┘  - JWT Auth
         │           - File uploads
         ↓
┌─────────────────────────────────┐
│  MongoDB Atlas  │  Database     │
│  Cloudinary     │  Image CDN    │
│  Google Apps    │  Sheets API   │
│  Script         │               │
└─────────────────────────────────┘
```

### Tech Stack

**Frontend:**
- HTML5, CSS3 (Glassmorphism design)
- Vanilla JavaScript (ES6+)
- Tesseract.js (OCR)
- ExcelJS, jsPDF

**Backend:**
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- Multer + Cloudinary
- Express Rate Limiting

**Deployment:**
- Frontend: Vercel
- Backend: Railway
- Database: MongoDB Atlas
- Images: Cloudinary
- Monitoring: UptimeRobot

---

## ⚙️ Configuration

### Environment Variables

Create `backend/.env`:

```env
# Server
PORT=5000
NODE_ENV=production

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/expense-tracker

# JWT
JWT_SECRET=your_super_secret_key_minimum_32_characters
JWT_EXPIRE=7d

# Cloudinary (Image Storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google Apps Script
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/your_script_id/exec

# Frontend URL (optional - CORS auto-allows all vercel.app)
FRONTEND_URL=https://your-app.vercel.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# UptimeRobot (Optional - for API monitoring)
# UPTIMEROBOT_API_KEY=your_api_key
```

### Frontend Configuration

Update `frontend/api.js`:

```javascript
const API_BASE_URL = 'https://expense-tracker-production-b501.up.railway.app/api';
```

---

## 📦 Installation & Deployment

### Local Development

```bash
# Backend
cd backend
npm install
npm run dev  # Uses nodemon for auto-reload

# Frontend
cd frontend
# Open index.html in browser
# Or use: npx http-server -p 3000
```

### Production Deployment

#### 1. MongoDB Atlas Setup
1. Create free cluster at https://cloud.mongodb.com
2. Create database user
3. Whitelist IP: `0.0.0.0/0`
4. Get connection string

#### 2. Cloudinary Setup
1. Sign up at https://cloudinary.com
2. Get cloud name, API key, API secret
3. Add to environment variables

#### 3. Railway Backend
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select repository
4. Add environment variables
5. Deploy (auto-deploys on git push)

#### 4. Vercel Frontend
1. Go to https://vercel.com
2. New Project → Import Git Repository
3. Root Directory: `frontend`
4. Deploy (auto-deploys on git push)

#### 5. Google Apps Script
1. Follow guide: `GOOGLE_APPS_SCRIPT_SETUP.md`
2. Deploy script as web app
3. Add URL to backend environment variables

---

## 🔍 OCR System

### Tesseract.js Integration

**Automatic Extraction:**
- ✅ **Amount**: 3-tier detection (context, currency, word amounts)
- ✅ **Date**: 8+ formats including Indian formats
- ✅ **Time**: 12/24-hour formats
- ✅ **Category**: Intelligent keyword matching
- ⚠️ **Vendor**: Must be entered manually (user preference)

**Quality Scoring:**
- 🌟 Excellent (80-100): All fields extracted
- ✅ Good (60-79): Most fields found
- ⚠️ Fair (40-59): Some missing
- ❌ Poor (0-39): Manual entry recommended

### Supported Categories
1. Fuel
2. Transportation
3. Accommodation
4. Meals
5. Office Supplies
6. Communication
7. Entertainment
8. Medical
9. Parking
10. Miscellaneous

---

## 📊 Google Sheets Export

### Features
- ✅ Auto-creates Google Sheet per user
- ✅ Professional reimbursement template
- ✅ Dynamic formulas that adapt to data size
- ✅ Accumulating exports (appends new data)
- ✅ Auto-formatting with borders and colors
- ✅ One-click PDF export from sheets

### How It Works

**First Export (35 bills):**
```
Rows 14-48: Expense data
Row 67: SUBTOTAL = SUM(F14:F48)
Row 68: Cash Advance
Row 69: TOTAL = F67-F68
```

**Second Export (70 bills total):**
```
Rows 14-83: Expense data (accumulates)
Row 84: SUBTOTAL = SUM(F14:F83)  ← Formula updates!
Row 85: Cash Advance
Row 86: TOTAL = F84-F85  ← Formula updates!
```

**Setup Guide:** See `GOOGLE_APPS_SCRIPT_SETUP.md`

---

## 🛡️ Monitoring & Health

### Backend Health Check

```bash
# Check if backend is running
npm run health

# Or visit:
https://expense-tracker-production-b501.up.railway.app/api/health
```

### 24/7 Monitoring

**UptimeRobot Setup (Free):**
1. Sign up at https://uptimerobot.com
2. Add monitor with health URL
3. Get email/SMS alerts when down

**Quick Setup:** See `UPTIMEROBOT_QUICKSTART.md`

### Monitoring Tools

```bash
# Health check
npm run health

# UptimeRobot status (requires API key)
npm run uptime:status
npm run uptime:list
```

---

## 📖 API Documentation

### Authentication

**POST** `/api/auth/register`
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**POST** `/api/auth/login`
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

### Expenses

**GET** `/api/expenses`
- Get all user expenses
- Query params: `?page=1&limit=50&category=all`

**POST** `/api/expenses`
- Create expense (multipart/form-data)
- Supports multiple image uploads

**PUT** `/api/expenses/:id`
- Update expense

**DELETE** `/api/expenses/:id`
- Delete expense

### Google Sheets

**GET** `/api/google-sheets/link`
- Get user's Google Sheet URL

**POST** `/api/google-sheets/export`
- Export expenses to Google Sheets

**POST** `/api/google-sheets/reset`
- Clear all data and reset template

**GET** `/api/google-sheets/export-pdf`
- Export Google Sheet as PDF (base64)

---

## 🗂️ Project Structure

```
expense-tracker/
├── frontend/
│   ├── index.html          # Main app
│   ├── style.css           # Glassmorphism design
│   ├── script.js           # App logic + OCR
│   ├── api.js              # Backend API wrapper
│   └── keep-alive.html     # Backend health monitor
│
├── backend/
│   ├── server.js           # Express server
│   ├── models/
│   │   ├── User.js         # User schema
│   │   └── Expense.js      # Expense schema
│   ├── routes/
│   │   ├── auth.js         # Auth endpoints
│   │   ├── expenses.js     # CRUD endpoints
│   │   └── google-sheets.js # Sheets integration
│   ├── middleware/
│   │   └── auth.js         # JWT middleware
│   ├── config/
│   │   └── cloudinary.js   # Image upload config
│   ├── monitor-health.js   # Health check script
│   ├── uptimerobot-api.js  # Monitoring API
│   ├── railway.json        # Railway config
│   └── render.yaml         # Backup deployment
│
├── GOOGLE_APPS_SCRIPT.js   # Google Sheets automation
├── GOOGLE_APPS_SCRIPT_SETUP.md
├── PREVENT_BACKEND_PROBLEMS.md
├── UPTIMEROBOT_QUICKSTART.md
└── README.md               # This file
```

---

## 🚨 Troubleshooting

### Backend Connection Issues

```bash
# 1. Check health
npm run health

# 2. Check Railway logs
# Visit: https://railway.app/dashboard

# 3. Force redeploy
git commit --allow-empty -m "Redeploy"
git push
```

### CORS Errors
✅ Already handled! Backend allows all `vercel.app` domains automatically.

### Google Sheets Export Fails
1. Verify Apps Script is deployed
2. Check GOOGLE_APPS_SCRIPT_URL in environment variables
3. See detailed guide: `GOOGLE_APPS_SCRIPT_SETUP.md`

### OCR Not Working
- Use clear, well-lit images
- JPG/PNG formats recommended
- Resolution: At least 800x600px
- Try different image angles

**Detailed Guides:**
- 📘 Backend issues: `backend/DEPLOYMENT_GUIDE.md`
- 📗 Monitoring: `PREVENT_BACKEND_PROBLEMS.md`

---

## 💡 Usage Tips

### Best Practices
- 📸 **Scan bills** immediately after purchase
- 🏷️ **Review OCR data** before saving
- 📤 **Export regularly** to Google Sheets for backup
- 🔄 **Keep receipts** until reimbursement approved

### OCR Tips
- Use **good lighting** when photographing bills
- Keep **receipts flat** (no crumples)
- **Center the text** in the image
- Higher **resolution** = better accuracy

### Google Sheets Tips
- **Export incrementally** (accumulates data)
- **Download PDF** for reimbursement submission
- **Use "Reset"** only to clear all data
- **Share sheet** with finance team

---

## 🤝 Contributing

Contributions welcome! Please follow these steps:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

**Code Style:**
- ES6+ syntax
- Async/await for promises
- Meaningful variable names
- Comments for complex logic

---

## 📄 License

MIT License - Copyright (c) 2025 Y Chaithu Reddy

See [LICENSE](LICENSE) file for details.

---

## 🌟 Features Roadmap

- [ ] Multi-currency support
- [ ] Receipt image enhancement (auto-crop, rotate)
- [ ] Expense analytics dashboard
- [ ] Budget tracking and alerts
- [ ] Mobile app (React Native)
- [ ] CSV import/export
- [ ] Team/organization support

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/YChaithuReddy/expense-tracker/issues)
- **Documentation:** See guides in repository
- **Backend Health:** https://expense-tracker-production-b501.up.railway.app/api/health

---

## 🎯 Live URLs

**Application:**
- Frontend: https://expense-tracker-delta-ashy.vercel.app
- Backend API: https://expense-tracker-production-b501.up.railway.app

**Monitoring:**
- Health Check: https://expense-tracker-production-b501.up.railway.app/api/health
- Visual Monitor: Open `frontend/keep-alive.html`

---

## 🔗 Resources

**Services Used:**
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) - Database
- [Railway](https://railway.app) - Backend hosting
- [Vercel](https://vercel.com) - Frontend hosting
- [Cloudinary](https://cloudinary.com) - Image CDN
- [UptimeRobot](https://uptimerobot.com) - Monitoring

**Libraries:**
- [Tesseract.js](https://tesseract.projectnaptha.com/) - OCR
- [ExcelJS](https://github.com/exceljs/exceljs) - Excel generation
- [jsPDF](https://github.com/parallax/jsPDF) - PDF generation

---

## ⚡ Quick Commands

```bash
# Backend
npm start              # Start production server
npm run dev            # Start development server (nodemon)
npm run health         # Check backend health
npm run uptime:status  # Check UptimeRobot monitors

# Git
git push              # Auto-deploy to Railway + Vercel
```

---

**Built with ❤️ by Y Chaithu Reddy**

⭐ Star this repo if you find it useful!
