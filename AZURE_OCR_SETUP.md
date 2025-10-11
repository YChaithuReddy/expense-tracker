# Azure Read OCR Setup Guide

## Overview
This expense tracker now uses **Microsoft Azure Read OCR** for bill scanning instead of Tesseract.js. Azure provides **95-97% accuracy** compared to Tesseract's 85-90%, especially for receipts.

## Benefits of Azure Read OCR
- ✅ **95-97% accuracy** (vs Tesseract's 85-90%)
- ✅ **5,000 free receipts per month**
- ✅ Better handwriting recognition
- ✅ Works with low-quality/crumpled receipts
- ✅ Receipt-specific model (extracts merchant, date, total automatically)
- ✅ Supports 160+ languages

---

## Step 1: Create Azure Account

1. Go to [Azure Portal](https://portal.azure.com/)
2. Sign up for free account
3. You get **$200 free credit** for 30 days
4. After that, use the **free tier**: 5,000 OCR calls/month

---

## Step 2: Create Computer Vision Resource

### In Azure Portal:

1. **Click "Create a resource"**
2. **Search for "Computer Vision"**
3. **Click "Create"**

### Configure Computer Vision:

```
Subscription: [Your subscription]
Resource Group: Create new → "expense-tracker-rg"
Region: East US (or nearest to you)
Name: expense-tracker-ocr
Pricing Tier: F0 (FREE)
  └─ 5,000 calls/month
  └─ 20 calls/minute
```

4. **Click "Review + Create"**
5. **Click "Create"**
6. Wait for deployment (~30 seconds)

---

## Step 3: Get API Keys

1. Go to your Computer Vision resource
2. Click **"Keys and Endpoint"** (left sidebar)
3. Copy the following:

```
KEY 1: [Copy this - keep it secret!]
Endpoint: https://expense-tracker-ocr.cognitiveservices.azure.com/
```

---

## Step 4: Add to Environment Variables

### For Local Development:

Create/update `backend/.env` file:

```bash
# Azure OCR Credentials
AZURE_VISION_ENDPOINT=https://expense-tracker-ocr.cognitiveservices.azure.com/
AZURE_VISION_KEY=your_key_here_from_step_3

# Existing variables...
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
GOOGLE_APPS_SCRIPT_URL=your_google_apps_script_url
FRONTEND_URL=http://localhost:3000
```

### For Railway Deployment:

1. Go to [Railway Dashboard](https://railway.app)
2. Select your project
3. Go to **"Variables"** tab
4. Add new variables:

```
AZURE_VISION_ENDPOINT = https://expense-tracker-ocr.cognitiveservices.azure.com/
AZURE_VISION_KEY = your_actual_key_from_azure
```

5. **Redeploy** your backend

---

## Step 5: Test OCR Locally

### Start Backend:
```bash
cd backend
npm start
```

### Start Frontend:
```bash
# In browser, open: http://localhost:3000
# OR use Live Server in VS Code
```

### Test Receipt Scanning:
1. Login to expense tracker
2. Upload a receipt image
3. Click "Scan Bills"
4. Check console for Azure OCR logs
5. Verify extracted data (amount, date, vendor)

---

## How It Works

### Old Flow (Tesseract - Client Side):
```
User → Browser → Tesseract.js (85-90% accuracy) → Form
```

### New Flow (Azure - Server Side):
```
User → Browser → Backend → Azure OCR (95-97% accuracy) → Backend → Form
```

### API Endpoint:
```
POST /api/ocr/scan
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body: images[] (array of files)

Response:
{
  "status": "success",
  "data": {
    "extractedData": {
      "amount": "150.50",
      "date": "2025-10-12",
      "vendor": "ABC Store",
      "category": "Shopping"
    },
    "combinedText": "Full OCR text...",
    "results": [...]
  }
}
```

---

## Pricing Information

### Free Tier (F0):
- **5,000 transactions/month** - FREE
- **20 transactions/minute** limit
- Perfect for personal use and small businesses

### Standard Tier (S1):
- After 5,000 transactions
- **$1.00 per 1,000 transactions**
- 30 transactions/second
- Can increase limits

### Cost Examples:
- 100 receipts/month: **FREE**
- 1,000 receipts/month: **FREE**
- 5,000 receipts/month: **FREE**
- 10,000 receipts/month: **$5.00**
- 50,000 receipts/month: **$45.00**

---

## Troubleshooting

### Error: "OCR service not configured"
**Solution**: Check that `AZURE_VISION_ENDPOINT` and `AZURE_VISION_KEY` are set in environment variables.

### Error: "401 Unauthorized"
**Solution**: Check that your API key is correct. Regenerate key in Azure Portal if needed.

### Error: "429 Too Many Requests"
**Solution**: You've hit the rate limit (20/min for free tier). Wait a minute or upgrade to S1.

### Error: "403 Forbidden"
**Solution**: Check your Azure subscription is active and resource is running.

### Low Accuracy Results
**Tips**:
1. Use good lighting for photos
2. Avoid blur and shadows
3. Capture full receipt
4. Try Azure Receipt Processor (automatically used)

---

## Monitoring Usage

### Check Usage in Azure Portal:
1. Go to Computer Vision resource
2. Click **"Metrics"** (left sidebar)
3. View transaction count graph
4. Set up alerts for usage limits

---

## Advanced: Receipt-Specific Model

Azure offers two OCR models:

### 1. Read Model (General Text)
- Used for any document
- Fast and accurate
- 95-97% accuracy

### 2. Receipt Model (Receipt-Specific)
- **Automatically used by our backend**
- Understands receipt structure
- Extracts: merchant name, date, total, tax, line items
- **Best for receipts** - 97-99% accuracy

Our implementation tries Receipt Model first, falls back to Read Model if needed.

---

## Security Best Practices

1. **Never commit API keys to Git**
   - Use `.env` file
   - Add `.env` to `.gitignore`

2. **Rotate keys regularly**
   - Azure allows 2 keys (KEY 1 and KEY 2)
   - Rotate every 90 days

3. **Use Railway/Vercel secrets**
   - Don't hardcode in code
   - Use environment variables

4. **Monitor usage**
   - Set up Azure alerts
   - Prevent unexpected charges

---

## Migration Complete! 🎉

You've successfully migrated from Tesseract.js to Azure Read OCR:

### Before:
- ❌ 85-90% accuracy
- ❌ Client-side processing (slow)
- ❌ Poor with handwriting
- ❌ Struggles with low-quality images

### After:
- ✅ 95-97% accuracy
- ✅ Server-side processing (faster)
- ✅ Excellent handwriting recognition
- ✅ Works with damaged receipts
- ✅ 5,000 free scans per month

---

## Support

For issues:
- **Azure Documentation**: https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/
- **Azure Support**: https://azure.microsoft.com/en-us/support/
- **Community**: Stack Overflow (tag: azure-cognitive-services)

---

**Happy Scanning! 📸**
