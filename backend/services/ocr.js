const Tesseract = require('tesseract.js');

// Reusable worker for better performance
let worker = null;

/**
 * Initialize Tesseract worker
 */
async function initWorker() {
    if (!worker) {
        console.log('🔧 Initializing Tesseract worker...');
        worker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                }
            }
        });

        // Configure for better receipt accuracy (same as frontend)
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ₹Rs./-:,@&()',
            preserve_interword_spaces: '1',
        });

        console.log('✅ Tesseract worker ready');
    }
    return worker;
}

/**
 * Extract text from image using Tesseract.js OCR (FREE - no API key needed)
 * @param {string} imageUrl - URL of the image to process
 * @returns {Promise<{amount: number|null, vendor: string|null, date: Date|null, rawText: string}>}
 */
async function extractFromBill(imageUrl) {
    const result = {
        amount: null,
        vendor: null,
        date: null,
        description: null,
        rawText: '',
        success: false
    };

    try {
        console.log('🔍 Starting Tesseract OCR...');

        // Initialize worker
        const ocrWorker = await initWorker();

        // Perform OCR with timeout
        const ocrPromise = ocrWorker.recognize(imageUrl);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('OCR timeout (60s)')), 60000)
        );

        const { data } = await Promise.race([ocrPromise, timeoutPromise]);

        if (!data || !data.text) {
            console.log('No text detected in image');
            return result;
        }

        // Get full text from the image
        const fullText = data.text;
        result.rawText = fullText;
        console.log('📝 OCR Raw Text:', fullText.substring(0, 300) + '...');
        console.log(`📊 OCR Confidence: ${data.confidence?.toFixed(2)}%`);

        // Parse the receipt text (same logic as frontend)
        const parsed = parseReceiptText(fullText);

        result.amount = parsed.amount;
        result.vendor = parsed.vendor;
        result.date = parsed.date;
        result.description = parsed.vendor ? `Bill from ${parsed.vendor}` : 'Bill expense';
        result.success = result.amount !== null;

        console.log('✅ OCR Result:', {
            amount: result.amount,
            vendor: result.vendor,
            date: result.date?.toLocaleDateString(),
            description: result.description
        });

        return result;
    } catch (error) {
        console.error('OCR Error:', error.message);
        return result;
    }
}

/**
 * Parse receipt text to extract amount, vendor, date
 * (Same logic as frontend parseReceiptText)
 */
function parseReceiptText(text) {
    const data = {
        amount: null,
        vendor: null,
        date: new Date()
    };

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const fullText = text.toLowerCase();

    // ========== AMOUNT EXTRACTION ==========

    // Text number mapping for word amounts
    const textNumbers = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
        'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
        'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
        'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
        'hundred': 100, 'thousand': 1000, 'lakh': 100000, 'lakhs': 100000
    };

    // Priority 1: Context-aware amount patterns (highest priority)
    const contextPatterns = [
        /(?:grand\s*)?total[\s:]*(?:amount)?[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,
        /(?:net|final)\s*(?:amount|total)[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,
        /(?:bill|invoice)\s*(?:amount|total)[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,
        /(?:amount\s*)?(?:paid|payable|due)[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,
        /(?:to\s*be\s*)?paid[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,
        /(?:total\s*)?(?:charge|sum)s?[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,
        // Payment successful patterns (PhonePe, GPay, Paytm, etc.)
        /payment\s*successful[\s\S]*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
        /(?:you\s*)?(?:paid|sent|received)[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,
    ];

    // Priority 2: Currency symbol patterns
    const currencyPatterns = [
        /₹\s*(\d+[,\d]*\.?\d*)/g,
        /(\d+[,\d]*\.?\d*)\s*₹/g,
        /\brs\.?\s*(\d+[,\d]*\.?\d*)/gi,
        /(\d+[,\d]*\.?\d*)\s*rs\.?/gi,
        /\binr\s*(\d+[,\d]*\.?\d*)/gi,
        /\brupees?\s*(\d+[,\d]*\.?\d*)/gi,
    ];

    // Priority 3: Comma-formatted amounts (very common: 2,000 or 10,500)
    const commaAmountPatterns = [
        /(\d{1,2},\d{3}(?:\.\d{2})?)/g,  // 2,000 or 10,500
        /(\d{1,3},\d{2},\d{3})/g,         // Indian format: 1,00,000
    ];

    // Priority 4: Standalone amounts (common in UPI payment screenshots)
    // Look for amounts like "2,000" or "₹2000" on their own line
    const standaloneAmountPatterns = [
        /^\s*₹?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*$/gm,
        /\n\s*₹?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*\n/g,
    ];

    // Helper function to clean and parse amount
    const cleanAmount = (amountStr) => {
        if (!amountStr) return null;
        let cleaned = amountStr.replace(/,/g, '');
        cleaned = cleaned.replace(/,(\d{1,2})$/, '.$1');
        const value = parseFloat(cleaned);
        if (value > 0 && value <= 1000000) {
            return value;
        }
        return null;
    };

    // Try context patterns first
    for (const pattern of contextPatterns) {
        const match = fullText.match(pattern);
        if (match) {
            const amount = cleanAmount(match[1]);
            if (amount) {
                data.amount = amount;
                console.log('✅ Amount found (context):', data.amount);
                break;
            }
        }
    }

    // Try currency patterns if context search failed
    if (!data.amount) {
        const foundAmounts = [];
        for (const pattern of currencyPatterns) {
            let match;
            const regex = new RegExp(pattern.source, pattern.flags);
            while ((match = regex.exec(fullText)) !== null) {
                const amount = cleanAmount(match[1]);
                if (amount) {
                    foundAmounts.push(amount);
                }
            }
        }
        if (foundAmounts.length > 0) {
            data.amount = Math.max(...foundAmounts);
            console.log('✅ Amount found (currency):', data.amount);
        }
    }

    // Try comma-formatted amounts (2,000 or 10,500)
    if (!data.amount) {
        const foundAmounts = [];
        for (const pattern of commaAmountPatterns) {
            let match;
            const regex = new RegExp(pattern.source, pattern.flags);
            while ((match = regex.exec(text)) !== null) {
                const amount = cleanAmount(match[1]);
                if (amount && amount >= 100) {
                    foundAmounts.push(amount);
                }
            }
        }
        if (foundAmounts.length > 0) {
            data.amount = Math.max(...foundAmounts);
            console.log('✅ Amount found (comma format):', data.amount);
        }
    }

    // Try word amounts (e.g., "Rupees Five Hundred Only")
    if (!data.amount) {
        const wordAmountPattern = /rupees?\s+([\sa-z]+)\s*only/gi;
        let match;
        while ((match = wordAmountPattern.exec(fullText)) !== null) {
            const words = match[1].trim().toLowerCase().split(/\s+/);
            let total = 0;
            let currentNumber = 0;

            for (const word of words) {
                if (textNumbers[word] !== undefined) {
                    const value = textNumbers[word];
                    if (value >= 100) {
                        if (currentNumber === 0) {
                            currentNumber = value;
                        } else {
                            currentNumber *= value;
                        }
                        total += currentNumber;
                        currentNumber = 0;
                    } else {
                        currentNumber += value;
                    }
                }
            }
            total += currentNumber;

            if (total > 0) {
                data.amount = total;
                console.log('✅ Amount found (word):', data.amount);
                break;
            }
        }
    }

    // Try standalone amounts (UPI payment screenshots)
    if (!data.amount) {
        for (const pattern of standaloneAmountPatterns) {
            const regex = new RegExp(pattern.source, pattern.flags);
            let match;
            const foundAmounts = [];
            while ((match = regex.exec(text)) !== null) {
                const amount = cleanAmount(match[1]);
                if (amount && amount >= 100) { // Minimum ₹100 for standalone
                    foundAmounts.push(amount);
                }
            }
            if (foundAmounts.length > 0) {
                data.amount = Math.max(...foundAmounts);
                console.log('✅ Amount found (standalone):', data.amount);
                break;
            }
        }
    }

    // Fallback: any number near bill/payment keywords
    if (!data.amount) {
        for (const line of lines) {
            if (/(?:bill|payment|charge|total|successful)/i.test(line)) {
                const match = line.match(/(\d+[,\d]*\.?\d*)/);
                if (match) {
                    const amount = cleanAmount(match[1]);
                    if (amount && amount > 10) {
                        data.amount = amount;
                        console.log('✅ Amount found (fallback):', data.amount);
                        break;
                    }
                }
            }
        }
    }

    // Last resort: find any reasonable amount (₹100 - ₹50,000)
    // But exclude numbers that look like dates (1-31) or times
    if (!data.amount) {
        const allNumbers = [];
        const numberPattern = /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
        let match;
        while ((match = numberPattern.exec(text)) !== null) {
            const amount = cleanAmount(match[1]);
            // Skip small numbers (likely dates/times) and very large numbers
            if (amount && amount >= 100 && amount <= 50000) {
                allNumbers.push(amount);
            }
        }
        if (allNumbers.length > 0) {
            // Pick the largest reasonable amount
            data.amount = Math.max(...allNumbers);
            console.log('✅ Amount found (last resort):', data.amount);
        }
    }


    // ========== VENDOR EXTRACTION ==========

    const skipKeywords = /^(amount|to|from|paid|payment|paytm|phonepe|gpay|googlepay|upi|bank|ref|reference|date|time|bill|invoice|receipt|thank|thanks|total|subtotal|tax|gst|cgst|sgst|igst|cashier|customer)/i;
    const businessKeywords = /(limited|ltd|pvt|private|corp|corporation|company|inc|llp|station|store|stores|mart|shop|restaurant|hotel|cafe|petrol|pump|mall|center|centre)/i;

    // Known vendors (with word boundary check for short names)
    const knownVendors = [
        { name: 'swiggy', needsWordBoundary: false },
        { name: 'zomato', needsWordBoundary: false },
        { name: 'uber', needsWordBoundary: true },
        { name: 'ola', needsWordBoundary: true },
        { name: 'rapido', needsWordBoundary: false },
        { name: 'amazon', needsWordBoundary: false },
        { name: 'flipkart', needsWordBoundary: false },
        { name: 'bigbasket', needsWordBoundary: false },
        { name: 'blinkit', needsWordBoundary: false },
        { name: 'zepto', needsWordBoundary: false },
        { name: 'dunzo', needsWordBoundary: false },
        { name: 'dominos', needsWordBoundary: false },
        { name: 'pizza hut', needsWordBoundary: false },
        { name: 'mcdonalds', needsWordBoundary: false },
        { name: 'kfc', needsWordBoundary: true },
        { name: 'subway', needsWordBoundary: false },
        { name: 'starbucks', needsWordBoundary: false },
        { name: 'cafe coffee day', needsWordBoundary: false },
        { name: 'ccd', needsWordBoundary: true },
        { name: 'reliance', needsWordBoundary: false },
        { name: 'dmart', needsWordBoundary: false },
        { name: 'big bazaar', needsWordBoundary: false },
        { name: 'more', needsWordBoundary: true },
        { name: 'spencer', needsWordBoundary: false },
        { name: 'apollo', needsWordBoundary: false },
        { name: 'medplus', needsWordBoundary: false },
        { name: 'netmeds', needsWordBoundary: false },
        { name: 'pharmeasy', needsWordBoundary: false },
        { name: 'myntra', needsWordBoundary: false },
        { name: 'ajio', needsWordBoundary: false },
        { name: 'nykaa', needsWordBoundary: false },
        { name: 'haldiram', needsWordBoundary: false },
        { name: 'barbeque nation', needsWordBoundary: false },
        { name: 'mainland china', needsWordBoundary: false },
        { name: 'taj', needsWordBoundary: true },
        { name: 'marriott', needsWordBoundary: false },
        { name: 'oyo', needsWordBoundary: true },
        { name: 'fab hotel', needsWordBoundary: false },
        { name: 'treebo', needsWordBoundary: false },
        { name: 'airtel', needsWordBoundary: false },
        { name: 'jio', needsWordBoundary: true },
        { name: 'vodafone', needsWordBoundary: false },
        { name: 'phonepe', needsWordBoundary: false },
        { name: 'paytm', needsWordBoundary: false },
        { name: 'google pay', needsWordBoundary: false },
        { name: 'gpay', needsWordBoundary: true },
        { name: 'hp petrol', needsWordBoundary: false },
        { name: 'indian oil', needsWordBoundary: false },
        { name: 'bharat petroleum', needsWordBoundary: false },
        { name: 'shell', needsWordBoundary: true },
    ];

    // Check for known vendors first (with word boundary for short names)
    for (const { name, needsWordBoundary } of knownVendors) {
        let found = false;
        if (needsWordBoundary) {
            // Use word boundary for short names to avoid false matches
            const regex = new RegExp(`\\b${name}\\b`, 'i');
            found = regex.test(fullText);
        } else {
            found = fullText.includes(name);
        }

        if (found) {
            data.vendor = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            console.log('✅ Vendor found (known):', data.vendor);
            break;
        }
    }

    // For UPI payments, try to extract recipient name
    if (!data.vendor) {
        // Pattern: "Paid to NAME" or "To NAME" or just a name after Payment Successful
        const upiPatterns = [
            /(?:paid\s*to|to|sent\s*to)\s+([A-Z][A-Za-z\s]+?)(?:\n|,|@)/i,
            /payment\s*successful[\s\S]*?\n([A-Z][A-Za-z\s]+?)(?:\n|,|@)/i,
        ];

        for (const pattern of upiPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                let name = match[1].trim();
                // Clean up the name
                name = name.replace(/\s+/g, ' ').substring(0, 30);
                if (name.length >= 2 && !/^(market|view|share|details|receipt|android)/i.test(name)) {
                    data.vendor = name;
                    console.log('✅ Vendor found (UPI recipient):', data.vendor);
                    break;
                }
            }
        }
    }

    // Smart vendor extraction from first lines
    if (!data.vendor) {
        const vendorCandidates = [];

        for (let i = 0; i < Math.min(lines.length, 10); i++) {
            const line = lines[i];

            if (
                skipKeywords.test(line) ||
                /₹|\d{4,}/.test(line) ||
                line.length < 3 ||
                line.length > 50 ||
                /^\d+$/.test(line) ||
                /^[^a-zA-Z]+$/.test(line) ||
                /transaction|order\s*id|ref/i.test(line)
            ) {
                continue;
            }

            let confidence = 0;

            // Bonus for business keywords
            if (businessKeywords.test(line)) {
                confidence += 50;
            }

            // Bonus for Title Case
            if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*/.test(line)) {
                confidence += 30;
            }

            // Bonus for being in first 3 lines
            if (i < 3) {
                confidence += 20;
            }

            // Bonus for reasonable length
            if (line.length >= 5 && line.length <= 30) {
                confidence += 10;
            }

            if (confidence > 0) {
                vendorCandidates.push({ text: line, confidence });
            }
        }

        // Pick highest confidence vendor
        if (vendorCandidates.length > 0) {
            vendorCandidates.sort((a, b) => b.confidence - a.confidence);
            let vendorName = vendorCandidates[0].text
                .replace(/[^a-zA-Z\s&']/g, '')
                .trim()
                .substring(0, 30);

            if (vendorName.length >= 3) {
                data.vendor = vendorName;
                console.log('✅ Vendor found (smart):', data.vendor);
            }
        }
    }

    // ========== DATE EXTRACTION ==========

    const datePatterns = [
        // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        { regex: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/, type: 'dmy' },
        // YYYY-MM-DD
        { regex: /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, type: 'ymd' },
        // DD MMM YYYY
        { regex: /(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*(\d{2,4})/i, type: 'dmy_text' },
    ];

    const monthMap = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };

    for (const { regex, type } of datePatterns) {
        const match = text.match(regex);
        if (match) {
            let day, month, year;

            if (type === 'dmy') {
                day = parseInt(match[1]);
                month = parseInt(match[2]) - 1;
                year = parseInt(match[3]);
            } else if (type === 'ymd') {
                year = parseInt(match[1]);
                month = parseInt(match[2]) - 1;
                day = parseInt(match[3]);
            } else if (type === 'dmy_text') {
                day = parseInt(match[1]);
                month = monthMap[match[2].toLowerCase().substring(0, 3)];
                year = parseInt(match[3]);
            }

            if (year < 100) year += 2000;

            if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000) {
                const date = new Date(year, month, day);
                if (!isNaN(date.getTime())) {
                    data.date = date;
                    console.log('✅ Date found:', date.toLocaleDateString());
                    break;
                }
            }
        }
    }

    return data;
}

/**
 * Check if OCR is configured (Tesseract is always available)
 */
function isConfigured() {
    return true;
}

module.exports = {
    extractFromBill,
    isConfigured
};
