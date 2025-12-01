const Tesseract = require('tesseract.js');

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

        // Perform OCR using Tesseract.js
        const { data } = await Tesseract.recognize(imageUrl, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                }
            }
        });

        if (!data || !data.text) {
            console.log('No text detected in image');
            return result;
        }

        // Get full text from the image
        const fullText = data.text;
        result.rawText = fullText;
        console.log('📝 OCR Raw Text:', fullText.substring(0, 200) + '...');

        // Extract amount
        result.amount = extractAmount(fullText);

        // Extract date
        result.date = extractDate(fullText);

        // Extract vendor
        result.vendor = extractVendor(fullText);

        // Generate description
        result.description = generateDescription(result);

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
 * Extract amount from text
 */
function extractAmount(text) {
    // Common patterns for amounts on Indian bills
    const patterns = [
        // Total patterns (prioritize these)
        /(?:total|grand\s*total|net\s*amount|amount\s*payable|bill\s*amount|final\s*amount|net\s*payable|amount\s*due)[:\s]*(?:rs\.?|₹|inr|\?)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
        /(?:total|grand\s*total)[:\s]*([0-9,]+(?:\.[0-9]{2})?)/gi,
        // Amount with currency symbol
        /(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
        // Plain numbers that look like amounts
        /\b([0-9]{2,6}(?:\.[0-9]{2})?)\b/g
    ];

    // Try total patterns first (get all matches and take the largest)
    for (let i = 0; i < 2; i++) {
        const matches = [...text.matchAll(patterns[i])];
        if (matches.length > 0) {
            const amounts = matches
                .map(m => parseFloat(m[1].replace(/,/g, '')))
                .filter(a => a > 0 && a < 100000)
                .sort((a, b) => b - a);

            if (amounts.length > 0) {
                return amounts[0];
            }
        }
    }

    // Find all amounts with currency symbols
    const currencyMatches = [...text.matchAll(patterns[2])];
    if (currencyMatches.length > 0) {
        const amounts = currencyMatches
            .map(m => parseFloat(m[1].replace(/,/g, '')))
            .filter(a => a > 0 && a < 100000)
            .sort((a, b) => b - a);

        if (amounts.length > 0) {
            return amounts[0];
        }
    }

    // Fallback: find largest reasonable number
    const allNumbers = [...text.matchAll(patterns[3])]
        .map(m => parseFloat(m[1].replace(/,/g, '')))
        .filter(n => n >= 10 && n < 50000)
        .sort((a, b) => b - a);

    return allNumbers.length > 0 ? allNumbers[0] : null;
}

/**
 * Extract date from text
 */
function extractDate(text) {
    // Common date patterns
    const patterns = [
        // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,
        // DD MMM YYYY (01 Dec 2025)
        /(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*(\d{2,4})/i,
        // MMM DD, YYYY (Dec 01, 2025)
        /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})[\s,]*(\d{2,4})/i,
        // YYYY-MM-DD
        /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/
    ];

    const monthMap = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };

    // Try DD/MM/YYYY format
    const match1 = text.match(patterns[0]);
    if (match1) {
        const day = parseInt(match1[1]);
        const month = parseInt(match1[2]) - 1;
        let year = parseInt(match1[3]);
        if (year < 100) year += 2000;

        if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }

    // Try DD MMM YYYY format
    const match2 = text.match(patterns[1]);
    if (match2) {
        const day = parseInt(match2[1]);
        const month = monthMap[match2[2].toLowerCase().substring(0, 3)];
        let year = parseInt(match2[3]);
        if (year < 100) year += 2000;

        if (day >= 1 && day <= 31 && month !== undefined) {
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }

    // Try MMM DD, YYYY format
    const match3 = text.match(patterns[2]);
    if (match3) {
        const month = monthMap[match3[1].toLowerCase().substring(0, 3)];
        const day = parseInt(match3[2]);
        let year = parseInt(match3[3]);
        if (year < 100) year += 2000;

        if (day >= 1 && day <= 31 && month !== undefined) {
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }

    // Try YYYY-MM-DD format
    const match4 = text.match(patterns[3]);
    if (match4) {
        const year = parseInt(match4[1]);
        const month = parseInt(match4[2]) - 1;
        const day = parseInt(match4[3]);

        if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }

    // Default to today if no date found
    return new Date();
}

/**
 * Extract vendor/shop name from text
 */
function extractVendor(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);

    // Known vendor patterns
    const knownVendors = [
        'swiggy', 'zomato', 'uber', 'ola', 'rapido', 'amazon', 'flipkart',
        'bigbasket', 'blinkit', 'zepto', 'dunzo', 'dominos', 'pizza hut',
        'mcdonalds', 'kfc', 'subway', 'starbucks', 'cafe coffee day', 'ccd',
        'reliance', 'dmart', 'big bazaar', 'more', 'spencer', 'apollo',
        'medplus', 'netmeds', 'pharmeasy', 'myntra', 'ajio', 'nykaa',
        'haldiram', 'barbeque nation', 'mainland china', 'taj', 'marriott',
        'oyo', 'fab hotel', 'treebo', 'airtel', 'jio', 'vodafone', 'vi',
        'petrol', 'hp', 'indian oil', 'bharat petroleum', 'shell'
    ];

    // Check for known vendors
    const textLower = text.toLowerCase();
    for (const vendor of knownVendors) {
        if (textLower.includes(vendor)) {
            return vendor.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
    }

    // First few non-empty lines often contain shop name
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i];

        // Skip lines that are just numbers, dates, or common headers
        if (/^[\d\s\-\/\.\,\:\+]+$/.test(line)) continue;
        if (/^(tax|invoice|bill|receipt|gst|gstin|cash|memo|no|number|date|time|tel|ph|mobile|fax|email)/i.test(line)) continue;
        if (/^(total|amount|subtotal|discount|cgst|sgst|igst|vat)/i.test(line)) continue;
        if (line.length < 3 || line.length > 40) continue;

        // Check if line looks like a name (has letters)
        if (/[a-zA-Z]{2,}/.test(line)) {
            // Clean up the line
            let vendorName = line
                .replace(/[^a-zA-Z\s&']/g, '')
                .trim()
                .substring(0, 30);

            if (vendorName.length >= 3) {
                return vendorName;
            }
        }
    }

    return null;
}

/**
 * Generate description based on extracted data
 */
function generateDescription(result) {
    if (result.vendor) {
        return `Bill from ${result.vendor}`;
    }
    return 'Bill expense';
}

/**
 * Check if OCR is configured (Tesseract is always available)
 */
function isConfigured() {
    return true; // Tesseract.js doesn't need any configuration
}

module.exports = {
    extractFromBill,
    isConfigured
};
