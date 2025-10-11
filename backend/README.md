# Expense Tracker Backend API

RESTful API for the Expense Tracker application with user authentication, expense management, and image upload functionality.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JWT (JSON Web Tokens)
- **Image Storage**: Cloudinary
- **Security**: Helmet, CORS, Rate Limiting, bcrypt

## Features

- ✅ User authentication (Register, Login, JWT)
- ✅ Protected routes with JWT middleware
- ✅ CRUD operations for expenses
- ✅ Image upload to Cloudinary
- ✅ User-specific data isolation
- ✅ Input validation
- ✅ Rate limiting
- ✅ Security headers (Helmet)
- ✅ CORS support
- ✅ Error handling

## Prerequisites

Before running this application, make sure you have:

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas account)
- Cloudinary account (for image uploads)

## Installation

1. **Navigate to backend directory**:
```bash
cd backend
```

2. **Install dependencies**:
```bash
npm install
```

3. **Create .env file**:
```bash
cp .env.example .env
```

4. **Configure environment variables** in `.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/expense-tracker
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:3000
```

## Running the Application

### Development Mode (with auto-restart):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/register` | Register new user | Public |
| POST | `/api/auth/login` | Login user | Public |
| GET | `/api/auth/me` | Get current user | Private |
| PUT | `/api/auth/updateprofile` | Update user profile | Private |
| PUT | `/api/auth/updatepassword` | Update password | Private |

### Expense Routes (`/api/expenses`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/expenses` | Get all user expenses | Private |
| GET | `/api/expenses/:id` | Get single expense | Private |
| POST | `/api/expenses` | Create new expense | Private |
| PUT | `/api/expenses/:id` | Update expense | Private |
| DELETE | `/api/expenses/:id` | Delete expense | Private |
| DELETE | `/api/expenses/:id/image/:imagePublicId` | Delete expense image | Private |
| GET | `/api/expenses/stats/summary` | Get expense statistics | Private |

### Health Check

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/health` | Check API status | Public |

## Request/Response Examples

### Register User
**POST** `/api/auth/register`
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password123"
}
```

**Response**:
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d5ec49f1b2c72b8c8e4f1a",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### Login User
**POST** `/api/auth/login`
```json
{
  "email": "john@example.com",
  "password": "Password123"
}
```

### Create Expense
**POST** `/api/expenses`

Headers:
```
Authorization: Bearer <your_jwt_token>
Content-Type: multipart/form-data
```

Body (form-data):
```
date: 2025-01-15
time: 14:30
category: Meals
amount: 250.50
vendor: Restaurant ABC
description: Team lunch
images: [file1.jpg, file2.jpg]
```

**Response**:
```json
{
  "status": "success",
  "expense": {
    "_id": "60d5ec49f1b2c72b8c8e4f1b",
    "user": "60d5ec49f1b2c72b8c8e4f1a",
    "date": "2025-01-15T00:00:00.000Z",
    "time": "14:30",
    "category": "Meals",
    "amount": 250.50,
    "vendor": "Restaurant ABC",
    "description": "Team lunch",
    "images": [
      {
        "url": "https://res.cloudinary.com/.../image1.jpg",
        "publicId": "expense-tracker/bills/abc123",
        "filename": "file1.jpg"
      }
    ],
    "createdAt": "2025-01-15T10:35:00.000Z"
  }
}
```

### Get All Expenses
**GET** `/api/expenses?page=1&limit=20&category=Meals`

Headers:
```
Authorization: Bearer <your_jwt_token>
```

## Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

The token is returned upon successful login/registration and expires after 7 days (configurable).

## Error Handling

All errors return a consistent format:

```json
{
  "status": "error",
  "message": "Error description"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Server Error

## Security Features

1. **Password Hashing**: bcryptjs with salt rounds
2. **JWT Authentication**: Secure token-based auth
3. **Rate Limiting**: Prevents brute force attacks
4. **Helmet**: Sets security HTTP headers
5. **CORS**: Configured for specific origin
6. **Input Validation**: express-validator
7. **File Upload Limits**: Max 5MB per image, 5 images per expense

## Database Schema

### User Model
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (required, hashed),
  createdAt: Date,
  updatedAt: Date
}
```

### Expense Model
```javascript
{
  user: ObjectId (ref: User),
  date: Date (required),
  time: String (HH:MM format),
  category: String (enum),
  amount: Number (required),
  vendor: String,
  description: String (required),
  images: [{
    url: String,
    publicId: String,
    filename: String
  }],
  createdAt: Date,
  updatedAt: Date
}
```

## Deployment

### MongoDB Atlas Setup
1. Create account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free tier available)
3. Add your IP to whitelist
4. Create database user
5. Get connection string and update `MONGODB_URI` in `.env`

### Cloudinary Setup
1. Create account at [Cloudinary](https://cloudinary.com/)
2. Get credentials from dashboard
3. Update `.env` with credentials

### Deploy to Railway/Render
1. Push code to GitHub
2. Connect Railway/Render to GitHub repo
3. Add environment variables
4. Deploy

## Testing

Test the API using:
- Postman
- Thunder Client (VS Code extension)
- curl commands

Example curl command:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","password":"Password123"}'
```

## Troubleshooting

### MongoDB Connection Error
- Check if MongoDB is running locally
- Verify connection string in `.env`
- Ensure network access in MongoDB Atlas

### Cloudinary Upload Error
- Verify credentials in `.env`
- Check image file size (max 5MB)
- Ensure valid image format

### JWT Token Error
- Check if JWT_SECRET is set in `.env`
- Verify token is included in Authorization header
- Check token expiration

## License

MIT

## Author

Your Name

## Support

For issues and questions, please create an issue on GitHub.
