# Expense Tracker

A full-stack web application for tracking expenses, scanning bills using OCR, and generating Excel/PDF reports for reimbursement.

![Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [OCR System](#ocr-system)
- [Excel Export](#excel-export)
- [Google Sheets Integration](#google-sheets-integration)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Core Features
- **User Authentication**: Secure login/signup with JWT tokens
- **Expense Management**: Add, edit, delete, and view expenses
- **Bill Scanning**: OCR-powered automatic data extraction from bill images
- **Excel Export**: Generate formatted Excel files for reimbursement
- **PDF Generation**: Create PDF reports from expenses
- **Google Sheets Integration**: Auto-export expenses to Google Sheets
- **Multi-category Support**: 10 predefined expense categories
- **Receipt Storage**: Upload and store receipt images
- **Bulk Operations**: Select multiple expenses for export

### Advanced Features
- **Smart OCR**: Enhanced Tesseract.js with confidence scoring
- **Indian Currency Support**: Handles ₹, Rs., lakhs, and Indian number formats
- **Auto-categorization**: Intelligent category detection based on vendor/keywords
- **Date/Time Extraction**: Supports 15+ date/time formats
- **Quality Scoring**: Real-time extraction quality assessment
- **Responsive Design**: Works on desktop, tablet, and mobile devices

---

## Tech Stack

### Frontend
- **HTML5/CSS3**: Modern UI with glassmorphism design
- **JavaScript (ES6+)**: Vanilla JS with async/await patterns
- **Tesseract.js**: Client-side OCR for bill scanning
- **ExcelJS**: Excel file generation
- **jsPDF**: PDF document generation
- **Vercel**: Frontend hosting

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **MongoDB**: NoSQL database for data persistence
- **Mongoose**: MongoDB ODM
- **JWT**: Authentication and authorization
- **bcrypt**: Password hashing
- **Multer**: File upload handling
- **express-validator**: Input validation
- **Railway**: Backend hosting

### Database
- **MongoDB Atlas**: Cloud database (Production)
- **Mongoose Schemas**: User and Expense models

---

## Architecture

```
expense-tracker/
├── frontend/                 # Frontend application
│   ├── index.html           # Main HTML file
│   ├── style.css            # Styles with glassmorphism
│   ├── script.js            # Main application logic
│   └── api.js               # API wrapper for backend calls
│
├── backend/                 # Backend API server
│   ├── server.js            # Express server setup
│   ├── models/              # Mongoose models
│   │   ├── User.js          # User schema
│   │   └── Expense.js       # Expense schema
│   ├── routes/              # API routes
│   │   ├── auth.js          # Authentication endpoints
│   │   ├── expenses.js      # Expense CRUD endpoints
│   │   └── google-sheets.js # Google Sheets integration
│   ├── middleware/          # Custom middleware
│   │   └── auth.js          # JWT authentication middleware
│   └── utils/               # Utility functions
│       └── validators.js    # Input validation rules
│
├── uploads/                 # Uploaded receipt images (gitignored)
├── .env                     # Environment variables (gitignored)
└── README.md               # This file
```

---

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- MongoDB Atlas account (or local MongoDB)
- Git

### Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/YChaithuReddy/expense-tracker.git
   cd expense-tracker
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies** (optional, for local development)
   ```bash
   cd ../frontend
   npm install -g http-server
   ```

4. **Create environment variables**

   Create a `.env` file in the `backend` directory:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=production

   # MongoDB Atlas
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/expense-tracker?retryWrites=true&w=majority

   # JWT Secret (generate a strong random string)
   JWT_SECRET=your_super_secret_jwt_key_here

   # CORS (for production)
   CORS_ORIGIN=https://your-frontend-url.vercel.app

   # File Upload
   MAX_FILE_SIZE=5242880  # 5MB in bytes
   ```

5. **Start the backend server**
   ```bash
   cd backend
   npm start
   ```
   Backend will run on `http://localhost:5000`

6. **Start the frontend server**
   ```bash
   cd frontend
   npx http-server -p 3000
   ```
   Frontend will run on `http://localhost:3000`

---

## Configuration

### Backend Configuration

#### MongoDB Connection
The application uses MongoDB Atlas for production. Update the `MONGODB_URI` in `.env`:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

#### JWT Configuration
Set a strong secret key for JWT token generation:
```env
JWT_SECRET=your_very_strong_secret_key_minimum_32_characters
```

#### CORS Configuration
Update allowed origins in `backend/server.js`:
```javascript
const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
};
```

#### Trust Proxy (Required for Railway/Heroku)
Already configured in `server.js`:
```javascript
app.set('trust proxy', 1);
```

### Frontend Configuration

Update the API base URL in `frontend/api.js`:
```javascript
const API_BASE_URL = 'https://your-backend-url.railway.app';
// For local development: 'http://localhost:5000'
```

---

## Usage

### 1. User Registration/Login
- Navigate to the application
- Click "Sign Up" to create a new account
- Enter username and password (min 6 characters)
- Login with your credentials

### 2. Scanning Bills with OCR
1. Click **"Scan Bills"** button
2. Select one or more bill/receipt images
3. Click **"Scan Bills"** to start OCR processing
4. Review extracted data:
   - Amount
   - Date
   - Category
   - Description
5. Fill in **Vendor** field manually (required)
6. Edit any auto-filled fields if needed
7. Click **"Add Expense"** to save

### 3. Manual Expense Entry
1. Click **"Add Expense Manually"** button
2. Fill in all fields:
   - Date
   - Category (10 options)
   - Vendor
   - Amount
   - Description (optional)
   - Receipt images (optional)
3. Click **"Add Expense"** to save

### 4. Managing Expenses
- **View**: All expenses displayed in list with details
- **Edit**: Click "Edit" button on any expense
- **Delete**: Click "Delete" button to remove expense
- **Search**: Filter expenses by date range or keyword

### 5. Exporting Data

#### Excel Export
1. Select expenses using checkboxes (or "Select All")
2. Click **"Export to Excel"** button
3. Excel file downloads with formatted template
4. Template includes:
   - Employee information section
   - Business purpose
   - Itemized expense table (53 rows)
   - Automatic totals and formulas

#### PDF Export
1. Select expenses using checkboxes
2. Click **"Generate PDF"**
3. PDF downloads with all expense details

#### Google Sheets Export
1. Click **"Export to Google Sheets"**
2. Follow authentication flow
3. Expenses automatically populate in Google Sheets

---

## API Documentation

### Authentication Endpoints

#### POST `/api/auth/signup`
Register a new user
```json
Request:
{
  "username": "john_doe",
  "password": "securepass123"
}

Response:
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST `/api/auth/login`
Login existing user
```json
Request:
{
  "username": "john_doe",
  "password": "securepass123"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "60d5ec49e1b2c3001f8e4567"
}
```

### Expense Endpoints

All expense endpoints require authentication (JWT token in Authorization header).

#### GET `/api/expenses`
Get all expenses for logged-in user
```json
Response:
{
  "status": "success",
  "data": [
    {
      "_id": "60d5ec49e1b2c3001f8e4567",
      "date": "2025-10-12",
      "time": "14:30",
      "category": "Fuel",
      "vendor": "HP Petrol Pump",
      "amount": 1500,
      "description": "Fuel - ₹1500",
      "receiptImages": ["1634567890123_receipt.jpg"],
      "userId": "60d5ec49e1b2c3001f8e4567",
      "createdAt": "2025-10-12T09:00:00.000Z"
    }
  ]
}
```

#### POST `/api/expenses`
Create new expense
```json
Request: multipart/form-data
- date: "2025-10-12"
- time: "14:30"
- category: "Fuel"
- vendor: "HP Petrol Pump"
- amount: 1500
- description: "Fuel expense"
- receipt: [File]

Response:
{
  "status": "success",
  "data": { /* expense object */ }
}
```

#### PUT `/api/expenses/:id`
Update existing expense
```json
Request: multipart/form-data
- Any fields to update

Response:
{
  "status": "success",
  "data": { /* updated expense */ }
}
```

#### DELETE `/api/expenses/:id`
Delete expense
```json
Response:
{
  "status": "success",
  "message": "Expense deleted successfully"
}
```

### Google Sheets Endpoints

#### POST `/api/google-sheets/export`
Export expenses to Google Sheets
```json
Request:
{
  "expenses": [ /* array of expense objects */ ],
  "userEmail": "user@example.com"
}

Response:
{
  "status": "success",
  "message": "Exported to Google Sheets",
  "sheetUrl": "https://docs.google.com/spreadsheets/d/..."
}
```

---

## Deployment

### Frontend Deployment (Vercel)

1. **Connect GitHub Repository**
   - Go to [Vercel Dashboard](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Select `expense-tracker` repository

2. **Configure Build Settings**
   ```
   Framework Preset: Other
   Root Directory: frontend
   Build Command: (leave empty)
   Output Directory: .
   Install Command: (leave empty)
   ```

3. **Deploy**
   - Click "Deploy"
   - Vercel auto-deploys on every git push to `main` branch

4. **Custom Domain** (optional)
   - Add custom domain in Vercel settings

### Backend Deployment (Railway)

1. **Create New Project**
   - Go to [Railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

2. **Configure Environment Variables**
   Add these in Railway dashboard:
   ```
   PORT=5000
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=your_secret_key
   CORS_ORIGIN=https://your-frontend.vercel.app
   ```

3. **Configure Build Settings**
   ```
   Root Directory: backend
   Start Command: npm start
   ```

4. **Deploy**
   - Railway auto-deploys on every git push
   - Get your Railway URL (e.g., `https://expense-tracker-production.up.railway.app`)

5. **Update Frontend API URL**
   - Update `API_BASE_URL` in `frontend/api.js` with your Railway URL
   - Commit and push changes

### MongoDB Atlas Setup

1. **Create Cluster**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create free M0 cluster
   - Choose cloud provider and region

2. **Create Database User**
   - Go to Database Access
   - Add new database user with username/password
   - Save credentials

3. **Whitelist IP Addresses**
   - Go to Network Access
   - Add IP: `0.0.0.0/0` (allow from anywhere)
   - Or add specific IPs for security

4. **Get Connection String**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy connection string
   - Replace `<password>` with your database password
   - Add to `.env` file

---

## OCR System

### Tesseract.js OCR Engine

The application uses **Tesseract.js** for client-side OCR (Optical Character Recognition) to extract data from bill/receipt images.

#### Features
- **Client-side processing**: No server load, privacy-friendly
- **Enhanced configuration**: Custom parameters for receipt scanning
- **Character whitelist**: Optimized for receipts (numbers, currency symbols)
- **Confidence tracking**: Quality assessment for extracted text
- **Multi-image support**: Scan multiple bills in one go

#### OCR Configuration
```javascript
await worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ₹Rs./-:,@&()',
    preserve_interword_spaces: '1',
});
```

### Data Extraction Logic

#### 1. Amount Extraction
**3-tier detection strategy:**

**Tier 1 - Context-aware patterns** (Highest priority):
- Looks for keywords: "Total", "Grand Total", "Amount Paid", "Bill Amount"
- Patterns: `total: ₹500`, `paid Rs.1234`, `bill amount 250`

**Tier 2 - Currency symbol patterns**:
- Detects: ₹, Rs., INR, Rupees
- Handles Indian number format: `1,00,000`, `12,345.50`
- If multiple amounts found, picks the largest (usually the total)

**Tier 3 - Word amounts**:
- Parses: "Rupees Eighty Only" → 80
- Supports: hundreds, thousands, lakhs

**Validation**:
- Range: ₹1 to ₹10,00,000
- Removes commas and handles decimal separators

#### 2. Vendor Extraction
**Smart confidence-based scoring:**

**Scoring system:**
- +50 points: Business keywords (Ltd, Pvt, Corp, Store, Restaurant)
- +20 points: Title Case formatting
- +15 points: ALL CAPS (common for business names)
- +10 points: Reasonable length (5-40 characters)
- -10 points: Multiple special characters
- -2 points per line position (vendors usually at top)

**Filters out:**
- Transaction IDs and reference numbers
- Payment keywords (UPI, Paytm, PhonePe, GPay)
- Lines with amounts or long numbers
- Common header/footer text

**Note**: Vendor field is **NOT auto-filled** by user preference. Vendor detection results are logged for debugging only.

#### 3. Category Detection
**10 categories with keyword matching:**

1. **Fuel**: petrol, diesel, hp, iocl, bpcl, shell, nayara
2. **Transportation**: uber, ola, taxi, metro, train, toll, rapido
3. **Accommodation**: hotel, oyo, airbnb, resort, lodge
4. **Meals**: restaurant, zomato, swiggy, dominos, kfc, mcdonald's, pizza
5. **Office Supplies**: stationery, office, paper, printer, toner
6. **Communication**: mobile, airtel, jio, vodafone, internet, recharge
7. **Entertainment**: movie, pvr, inox, cinema, theatre
8. **Medical**: hospital, pharmacy, apollo, medplus, clinic
9. **Parking**: parking, valet
10. **Miscellaneous**: Default fallback

**Scoring**: Each keyword match adds 10 points. Highest scoring category is selected.

#### 4. Date Extraction
**Supports 8+ date formats:**
- Month names: `04 September 2025`, `Sep 11, 2023`
- Numeric: `04/09/2025`, `2025-09-04`, `04.09.25`
- ISO format: `2025-09-04T18:21:30`
- Concatenated: `20250904`
- Context-aware: `Paid on 04/09/2025`

**Validation**: Year range 2000-2099, valid month/day combinations

#### 5. Time Extraction
**Supports 6+ time formats:**
- 12-hour: `6:21 PM`, `06:21:30 AM`
- 24-hour: `18:21`, `18:21:30`
- ISO format: `T18:21:30`
- Context-aware: `Time: 18:21`, `Paid at 6:21 PM`

### Quality Scoring

**Extraction quality assessment (0-100 points):**
- Amount: 40 points (most important)
- Vendor: 20 points
- Date: 20 points
- Category: 10 points
- Time: 10 points

**Quality levels:**
- 🌟 **Excellent** (80-100): All key fields extracted
- ✅ **Good** (60-79): Most fields found
- ⚠️ **Fair** (40-59): Some fields missing
- ❌ **Poor** (0-39): Manual entry recommended

**Console output example:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 EXTRACTION QUALITY SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 Overall Quality: Excellent (90/100)

Field Detection Results:
  💰 Amount:   ✅ 1500
  🏪 Vendor:   ✅ HP Petrol Pump
  📅 Date:     ✅ 2025-10-12
  ⏰ Time:     ✅ 14:30
  📂 Category: ✅ Fuel
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Excel Export

### Template Format

The Excel export uses a professional reimbursement template with the following structure:

#### Template Layout
```
Row 1:     EMPLOYEE REIMBURSEMENT REQUEST (Title, merged cells)
Row 2-3:   Empty
Row 4-6:   Employee Information Section
           - Employee Name | Employee ID
           - Department    | Location
           - Date          | Month
Row 7:     Empty
Row 8:     Business Purpose: [Text field]
Row 9-12:  Empty
Row 13:    Table Headers (S.No. | Date | Particulars | Amount)
Row 14-66: Expense Items (53 rows for data entry)
Row 67:    Subtotal (Formula: SUM of amounts)
Row 68:    Cash Advance
Row 69:    Total Amount Payable (Formula: Subtotal - Cash Advance)
```

#### Cell Formatting
- **Header**: Bold, size 16, cyan background
- **Labels**: Bold, cyan background
- **Table headers**: Bold, border, cyan background
- **Data cells**: Border, number format for amounts
- **Formulas**: Automatic calculation of totals

#### Generated Excel Features
- Merged cells for title and section headers
- Column widths auto-adjusted for content
- Border styling on all data cells
- Currency symbol (₹) in amount column
- Automatic formulas for subtotal and total
- Professional color scheme (cyan theme)

### Implementation

Uses **ExcelJS** library:
```javascript
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Expense Report');

// Set column widths
worksheet.columns = [
    { width: 8 },   // S.No.
    { width: 15 },  // Date
    { width: 50 },  // Particulars
    { width: 15 }   // Amount
];

// Add expense data
expenses.forEach((expense, index) => {
    const row = worksheet.getRow(14 + index);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = formatDate(expense.date);
    row.getCell(3).value = `${expense.category} - ${expense.vendor}`;
    row.getCell(4).value = expense.amount;
});

// Add total formula
worksheet.getCell('D67').value = {
    formula: 'SUM(D14:D66)'
};
```

---

## Google Sheets Integration

### Setup

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project
   - Enable Google Sheets API

2. **Create Service Account**
   - Go to IAM & Admin → Service Accounts
   - Create service account
   - Download JSON credentials

3. **Configure Backend**
   Place credentials JSON in `backend/config/google-credentials.json`

4. **Share Sheet**
   - Create Google Sheet
   - Share with service account email
   - Grant edit permissions

### Integration Flow

1. User clicks "Export to Google Sheets"
2. Frontend sends expense data to backend
3. Backend authenticates with Google API
4. Creates/updates spreadsheet
5. Populates data in formatted table
6. Returns sheet URL to frontend

### Export Format

Similar to Excel template with additional features:
- Auto-formatting with Google Sheets styles
- Formulas for automatic calculations
- Shareable link generation
- Version history tracking

---

## Contributing

### Development Workflow

1. **Fork the repository**
   ```bash
   git clone https://github.com/YChaithuReddy/expense-tracker.git
   cd expense-tracker
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make changes and test**
   - Follow existing code style
   - Test thoroughly on localhost
   - Ensure OCR works correctly
   - Verify Excel/PDF export

4. **Commit with descriptive message**
   ```bash
   git add .
   git commit -m "Add feature: description of what you added"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**
   - Go to GitHub repository
   - Click "New Pull Request"
   - Describe your changes
   - Wait for review

### Code Style Guidelines

- Use meaningful variable names
- Add comments for complex logic
- Follow ES6+ syntax
- Use async/await for promises
- Handle errors gracefully
- Log important events to console

### Testing Checklist

- [ ] User authentication works
- [ ] Expense CRUD operations successful
- [ ] OCR correctly extracts data from sample bills
- [ ] Excel export generates valid file
- [ ] PDF export creates readable document
- [ ] Google Sheets integration works
- [ ] Responsive design on mobile/tablet
- [ ] No console errors
- [ ] Receipt images upload correctly
- [ ] Date/time formatting accurate

---

## License

MIT License

Copyright (c) 2025 Y Chaithu Reddy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Acknowledgments

- **Tesseract.js**: OCR engine for bill scanning
- **ExcelJS**: Excel file generation library
- **MongoDB Atlas**: Cloud database hosting
- **Railway**: Backend deployment platform
- **Vercel**: Frontend deployment platform

---

## Support

For issues, questions, or suggestions:

- **GitHub Issues**: [Create an issue](https://github.com/YChaithuReddy/expense-tracker/issues)
- **Email**: your.email@example.com
- **Documentation**: Refer to inline code comments

---

## Changelog

### Version 2.0.0 (2025-10-12)
- ✅ Reverted from Azure OCR to enhanced Tesseract.js
- ✅ Improved OCR accuracy with multi-tier detection
- ✅ Added smart vendor extraction (debugging only)
- ✅ Expanded categories from 4 to 10
- ✅ Added extraction quality scoring
- ✅ Improved Indian currency format support
- ✅ Fixed amount display to remove unnecessary .00
- ✅ Added detailed console logging for debugging
- ✅ Enhanced form population logic

### Version 1.0.0 (2024-11-17)
- Initial release with core features
- User authentication
- Expense CRUD operations
- Basic OCR with Tesseract.js
- Excel/PDF export
- Google Sheets integration
- Railway + Vercel deployment

---

## Project Status

**Active Development** - The application is actively maintained and regularly updated with new features and improvements.

**Production Ready** - Currently deployed and being used for expense tracking and reimbursement management.

**Live URLs**:
- Frontend: https://expense-tracker-frontend.vercel.app
- Backend: https://expense-tracker-production.up.railway.app

---

**Built with ❤️ by Y Chaithu Reddy**
