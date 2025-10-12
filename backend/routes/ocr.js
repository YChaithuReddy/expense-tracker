/**
 * OCR Routes
 * Handles bill/receipt scanning with Azure OCR
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const azureOcrService = require('../services/azureOcrService');
const axios = require('axios');

/**
 * @route   POST /api/ocr/scan
 * @desc    Scan receipt images and extract text using Azure OCR
 * @access  Private
 */
router.post('/scan', protect, upload.array('images', 5), async (req, res) => {
    try {
        // Check if service is ready
        if (!azureOcrService.isReady()) {
            return res.status(503).json({
                status: 'error',
                message: 'OCR service not configured. Please contact administrator.'
            });
        }

        // Validate uploaded files
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No images uploaded. Please select at least one receipt image.'
            });
        }

        console.log(`📸 Processing ${req.files.length} images for user ${req.user.email}`);

        // Process each image
        const results = [];
        let combinedText = '';

        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            console.log(`   Processing image ${i + 1}/${req.files.length}: ${file.originalname}`);

            try {
                // Download image from Cloudinary as buffer
                console.log(`   Downloading from Cloudinary: ${file.path}`);
                const response = await axios.get(file.path, {
                    responseType: 'arraybuffer'
                });
                const imageBuffer = Buffer.from(response.data);
                console.log(`   Downloaded ${imageBuffer.length} bytes`);

                // Try receipt-specific extraction with downloaded buffer
                const receiptResult = await azureOcrService.extractReceiptData(imageBuffer);

                if (receiptResult.success) {
                    results.push({
                        filename: file.originalname,
                        ...receiptResult
                    });

                    // Combine text from all images
                    combinedText += receiptResult.rawText || receiptResult.text || '';
                    combinedText += '\n\n'; // Separator between images
                }
            } catch (error) {
                console.error(`   Error processing ${file.originalname}:`, error.message);
                results.push({
                    filename: file.originalname,
                    success: false,
                    error: error.message
                });
            }
        }

        // Parse the combined text to extract expense fields
        const extractedData = parseReceiptText(combinedText, results);

        console.log('✅ OCR processing complete');
        console.log(`   Successfully processed: ${results.filter(r => r.success).length}/${req.files.length}`);
        console.log(`   Extracted data: amount=${extractedData.amount}, date=${extractedData.date}, vendor=${extractedData.vendor}`);

        res.status(200).json({
            status: 'success',
            message: `Successfully processed ${results.filter(r => r.success).length} images`,
            data: {
                extractedData: extractedData,
                combinedText: combinedText.trim(),
                results: results,
                imageUrls: req.files.map(f => f.path) // Cloudinary URLs
            }
        });

    } catch (error) {
        console.error('❌ OCR scan error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process images. Please try again.',
            error: error.message
        });
    }
});

/**
 * Parse receipt text to extract expense fields
 * @param {String} text - Combined text from all receipts
 * @param {Array} results - Array of OCR results from Azure
 * @returns {Object} - Extracted expense data
 */
function parseReceiptText(text, results = []) {
    const extractedData = {
        amount: '',
        date: '',
        vendor: '', // Leave empty - user will fill manually
        category: '', // Leave empty - user will select from dropdown
        description: '',
        time: ''
    };

    // Try to get structured data from Azure receipt processor first
    if (results.length > 0) {
        const firstReceipt = results.find(r => r.success);
        if (firstReceipt) {
            // Use Azure's structured extraction (but NOT merchant name)
            // DON'T extract vendor - let user fill manually
            if (firstReceipt.transactionDate) {
                extractedData.date = formatDate(firstReceipt.transactionDate);
            }
            if (firstReceipt.total) {
                extractedData.amount = parseAmount(firstReceipt.total);
            }
        }
    }

    // Fallback to text parsing if structured data not available
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const fullText = text.toLowerCase();

    // Extract amount if not found
    if (!extractedData.amount) {
        const amountPatterns = [
            /total[:\s]*\$?(\d+\.?\d*)/i,
            /amount[:\s]*\$?(\d+\.?\d*)/i,
            /\$\s*(\d+\.?\d+)/,
            /rs\.?\s*(\d+\.?\d+)/i,
            /₹\s*(\d+\.?\d+)/
        ];

        for (const pattern of amountPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                extractedData.amount = match[1];
                break;
            }
        }
    }

    // Extract date if not found
    if (!extractedData.date) {
        const datePatterns = [
            /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
            /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/,
            /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})/i
        ];

        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                extractedData.date = formatDate(match[1]);
                break;
            }
        }
    }

    // DON'T extract vendor - user will fill manually

    // Intelligently guess category based on OCR text keywords
    const textLower = text.toLowerCase();

    // Transport categories
    if (textLower.match(/cab|taxi|ola|uber|rapido/i)) {
        extractedData.category = 'Cab';
    } else if (textLower.match(/bus|ksrtc|msrtc|tsrtc|apsrtc|state transport/i)) {
        extractedData.category = 'Bus';
    } else if (textLower.match(/metro|train|railway|irctc|local train|suburban/i)) {
        extractedData.category = 'Metro';
    } else if (textLower.match(/auto|rickshaw|auto rickshaw/i)) {
        extractedData.category = 'Auto';
    } else if (textLower.match(/petrol|diesel|fuel|gas station|bunk|pump/i)) {
        extractedData.category = 'Fuel';
    } else if (textLower.match(/parking|valet/i)) {
        extractedData.category = 'Parking';
    }
    // Food & Dining
    else if (textLower.match(/restaurant|cafe|coffee|food|pizza|burger|dining|swiggy|zomato|hotel|dhaba|biryani|meal/i)) {
        extractedData.category = 'Food';
    }
    // Accommodation
    else if (textLower.match(/hotel|lodge|stay|accommodation|resort|motel|guest house/i)) {
        extractedData.category = 'Accommodation';
    }
    // Entertainment
    else if (textLower.match(/cinema|movie|theatre|pvr|inox|entertainment|ticket/i)) {
        extractedData.category = 'Entertainment';
    }
    // Shopping
    else if (textLower.match(/shop|store|mall|mart|retail|supermarket|grocery|big bazaar|reliance|dmart/i)) {
        extractedData.category = 'Shopping';
    }
    // Healthcare
    else if (textLower.match(/hospital|clinic|pharmacy|medical|doctor|medicine|apollo|fortis/i)) {
        extractedData.category = 'Healthcare';
    }
    // Default to Miscellaneous if no match
    else {
        extractedData.category = 'Miscellaneous';
    }

    // Extract time
    const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
    if (timeMatch) {
        extractedData.time = timeMatch[1];
    }

    return extractedData;
}

/**
 * Format date to YYYY-MM-DD
 * @param {String} dateString - Date in various formats
 * @returns {String} - Formatted date YYYY-MM-DD
 */
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    } catch (error) {
        console.warn('Date parsing failed:', dateString);
    }
    return '';
}

/**
 * Parse amount from string
 * @param {String} amountString - Amount with currency symbols
 * @returns {String} - Clean number string
 */
function parseAmount(amountString) {
    if (!amountString) return '';
    // Remove currency symbols and extra characters
    const cleaned = amountString.replace(/[^\d.]/g, '');
    return cleaned;
}

/**
 * @route   GET /api/ocr/health
 * @desc    Check if OCR service is available
 * @access  Private
 */
router.get('/health', protect, async (req, res) => {
    const isReady = azureOcrService.isReady();

    res.status(isReady ? 200 : 503).json({
        status: isReady ? 'success' : 'error',
        service: 'Azure OCR',
        ready: isReady,
        message: isReady
            ? 'OCR service is ready'
            : 'OCR service not configured. Please set AZURE_VISION_ENDPOINT and AZURE_VISION_KEY environment variables.'
    });
});

module.exports = router;
