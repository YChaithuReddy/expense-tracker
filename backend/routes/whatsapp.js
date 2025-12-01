const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/auth');
const whatsappService = require('../services/whatsapp');
const ocrService = require('../services/ocr');
const { cloudinary } = require('../middleware/upload');
const User = require('../models/User');
const Expense = require('../models/Expense');
const PendingWhatsAppExpense = require('../models/PendingWhatsAppExpense');

// Category auto-detection keywords with proper format matching your sheet
const CATEGORY_KEYWORDS = {
    'Meals - Food': ['lunch', 'dinner', 'breakfast', 'food', 'meal', 'eat', 'biryani', 'canteen'],
    'Meals - Snacks': ['snack', 'coffee', 'tea', 'cafe', 'juice', 'samosa'],
    'Meals - Restaurant': ['restaurant', 'hotel', 'pizza', 'burger', 'swiggy', 'zomato', 'dine'],
    'Transportation - Cab (Uber/Rapido)': ['uber', 'ola', 'cab', 'taxi', 'rapido'],
    'Transportation - Auto': ['auto', 'rickshaw'],
    'Transportation - Bus': ['bus', 'metro', 'train'],
    'Fuel - Petrol': ['fuel', 'petrol', 'diesel', 'gas station'],
    'Shopping - Online': ['amazon', 'flipkart', 'myntra', 'online'],
    'Shopping - Clothes': ['clothes', 'shoes', 'dress', 'shirt', 'wear'],
    'Shopping - General': ['shop', 'mall', 'buy', 'purchase', 'store'],
    'Utilities - Bills': ['electricity', 'water', 'gas', 'internet', 'wifi', 'bill'],
    'Utilities - Recharge': ['recharge', 'mobile', 'phone', 'jio', 'airtel', 'vi'],
    'Entertainment - Movies': ['movie', 'cinema', 'pvr', 'inox', 'film'],
    'Entertainment - Subscription': ['netflix', 'spotify', 'prime', 'hotstar', 'subscription'],
    'Health - Medicine': ['medicine', 'pharmacy', 'medical', 'tablet'],
    'Health - Doctor': ['doctor', 'hospital', 'clinic', 'apollo', 'consultation'],
    'Groceries': ['grocery', 'vegetables', 'fruits', 'milk', 'supermarket', 'bigbasket', 'blinkit', 'zepto', 'dmart']
};

// Auto-detect category from description
function detectCategory(description) {
    const desc = description.toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(keyword => desc.includes(keyword))) {
            return category;
        }
    }
    return 'Miscellaneous';
}

// Extract vendor from description
// For "Lunch at St Martha" -> extract "St Martha"
// For "Coffee at Starbucks" -> extract "Starbucks"
// For "Amazon order" -> extract "Amazon"
function extractVendor(description) {
    const desc = description.trim();

    // Pattern 1: "X at Y" or "X from Y" -> extract Y as vendor
    const atMatch = desc.match(/(?:at|from|@)\s+(.+)/i);
    if (atMatch && atMatch[1]) {
        return capitalizeWords(atMatch[1].trim());
    }

    // Pattern 2: Known vendor names in description
    const knownVendors = ['amazon', 'flipkart', 'swiggy', 'zomato', 'uber', 'ola', 'rapido',
                          'starbucks', 'ccd', 'dominos', 'mcdonalds', 'kfc', 'subway',
                          'bigbasket', 'blinkit', 'zepto', 'dmart', 'reliance', 'apollo'];
    const descLower = desc.toLowerCase();
    for (const vendor of knownVendors) {
        if (descLower.includes(vendor)) {
            return capitalizeWords(vendor);
        }
    }

    // Pattern 3: If description is just one or two words and not a common expense word, use it
    const words = desc.split(/\s+/);
    const commonExpenseWords = ['lunch', 'dinner', 'breakfast', 'coffee', 'tea', 'snack',
                                 'food', 'grocery', 'medicine', 'fuel', 'petrol', 'recharge'];
    if (words.length <= 2 && !commonExpenseWords.includes(words[0].toLowerCase())) {
        return capitalizeWords(desc);
    }

    return 'N/A';
}

// Helper to capitalize words
function capitalizeWords(str) {
    return str.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// Upload image from URL to Cloudinary
async function uploadToCloudinary(imageUrl) {
    try {
        // Download image from Twilio (requires auth)
        const response = await axios.get(imageUrl, {
            auth: {
                username: process.env.TWILIO_ACCOUNT_SID,
                password: process.env.TWILIO_AUTH_TOKEN
            },
            responseType: 'arraybuffer'
        });

        // Convert to base64
        const base64Image = Buffer.from(response.data).toString('base64');
        const dataUri = `data:image/jpeg;base64,${base64Image}`;

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'expense-tracker/bills',
            transformation: [
                { width: 1000, height: 1000, crop: 'limit' },
                { quality: 'auto:good' }
            ]
        });

        return {
            url: result.secure_url,
            publicId: result.public_id
        };
    } catch (error) {
        console.error('Error uploading to Cloudinary:', error.message);
        return null;
    }
}

// @route   GET /api/whatsapp/status
router.get('/status', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({
            success: true,
            configured: whatsappService.isConfigured(),
            userPhone: user.whatsappNumber || null,
            notificationsEnabled: user.whatsappNotifications || false
        });
    } catch (error) {
        console.error('WhatsApp status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/whatsapp/setup
router.post('/setup', protect, async (req, res) => {
    try {
        const { phoneNumber, enableNotifications } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        let formattedNumber = phoneNumber.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
        if (!formattedNumber.startsWith('+')) {
            formattedNumber = '+91' + formattedNumber.replace(/^0+/, '');
        }

        await User.findByIdAndUpdate(req.user.id, {
            whatsappNumber: formattedNumber,
            whatsappNotifications: enableNotifications || false
        });

        if (whatsappService.isConfigured()) {
            try {
                await whatsappService.sendMessage(formattedNumber,
                    '✅ *Expense Tracker Connected!*\n\n' +
                    '*Quick Add (3 steps):*\n' +
                    '1️⃣ Send *add* to start\n' +
                    '2️⃣ Enter amount\n' +
                    '3️⃣ Enter description\n' +
                    '📷 Optional: Send photo first!\n\n' +
                    '*Or use instant add:*\n' +
                    '⚡ Send: *500 lunch*\n\n' +
                    '📊 Send *summary* for reports'
                );
            } catch (msgError) {
                console.log('Could not send welcome message:', msgError.message);
            }
        }

        res.json({ success: true, message: 'WhatsApp setup complete', phoneNumber: formattedNumber });
    } catch (error) {
        console.error('WhatsApp setup error:', error);
        res.status(500).json({ success: false, message: 'Failed to setup WhatsApp' });
    }
});

// @route   POST /api/whatsapp/send-summary
router.post('/send-summary', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user.whatsappNumber) {
            return res.status(400).json({ success: false, message: 'WhatsApp number not configured' });
        }

        const { period } = req.body;
        let startDate = new Date(0);
        let periodLabel = 'All Time';

        const now = new Date();
        if (period === 'today') {
            startDate = new Date(now.setHours(0, 0, 0, 0));
            periodLabel = 'Today';
        } else if (period === 'week') {
            startDate = new Date(now.setDate(now.getDate() - 7));
            periodLabel = 'Last 7 Days';
        } else if (period === 'month') {
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            periodLabel = 'Last 30 Days';
        }

        const expenses = await Expense.find({ user: req.user.id, date: { $gte: startDate } });
        const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const byCategory = expenses.reduce((acc, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
            return acc;
        }, {});

        await whatsappService.sendExpenseSummary(user.whatsappNumber, {
            period: periodLabel,
            total,
            count: expenses.length,
            byCategory
        });

        res.json({ success: true, message: 'Summary sent to WhatsApp' });
    } catch (error) {
        console.error('Send summary error:', error);
        res.status(500).json({ success: false, message: 'Failed to send summary' });
    }
});

// @route   POST /api/whatsapp/webhook
// Main webhook handler - SIMPLIFIED 3-STEP FLOW
router.post('/webhook', async (req, res) => {
    try {
        const { From, Body, NumMedia, MediaUrl0, MediaContentType0 } = req.body;
        console.log('📱 WhatsApp webhook:', { From, Body, NumMedia });

        const phoneNumber = From.replace('whatsapp:', '');
        const user = await User.findOne({ whatsappNumber: phoneNumber });

        if (!user) {
            await whatsappService.sendMessage(From,
                '❌ *Number Not Registered*\n\n' +
                'Register at: expense-tracker-delta-ashy.vercel.app\n' +
                'Then add your WhatsApp in Settings.'
            );
            return res.status(200).send('OK');
        }

        const messageText = Body?.trim();
        const messageLower = messageText?.toLowerCase();

        // === COMMANDS ===

        // Cancel
        if (messageLower === 'cancel' || messageLower === 'exit') {
            await PendingWhatsAppExpense.deleteOne({ user: user._id });
            await whatsappService.sendMessage(From, '❌ Cancelled.\n\nSend *add* to start again.');
            return res.status(200).send('OK');
        }

        // Help
        if (messageLower === 'help' || messageLower === '?') {
            await whatsappService.sendMessage(From,
                '📱 *Expense Tracker*\n\n' +
                '*Quick Add (3 steps):*\n' +
                '📝 *add* - Start adding expense\n\n' +
                '*Instant Add:*\n' +
                '⚡ Just send: *500 lunch*\n\n' +
                '*With Photo:*\n' +
                '📷 Send photo → then amount & description\n\n' +
                '*Reports:*\n' +
                '📊 *summary* - Today\n' +
                '📅 *week* - This week\n' +
                '📆 *month* - This month\n\n' +
                '❌ *cancel* - Cancel current'
            );
            return res.status(200).send('OK');
        }

        // Summary commands
        if (messageLower === 'summary' || messageLower === 'today') {
            await sendSummary(From, user._id, 'today');
            return res.status(200).send('OK');
        }
        if (messageLower === 'week') {
            await sendSummary(From, user._id, 'week');
            return res.status(200).send('OK');
        }
        if (messageLower === 'month') {
            await sendSummary(From, user._id, 'month');
            return res.status(200).send('OK');
        }

        // Start new expense (3-step flow)
        if (messageLower === 'add' || messageLower === 'new') {
            await PendingWhatsAppExpense.deleteOne({ user: user._id });
            const pending = new PendingWhatsAppExpense({
                user: user._id,
                whatsappNumber: phoneNumber,
                step: 'amount'
            });
            await pending.save();

            await whatsappService.sendMessage(From,
                '📝 *New Expense*\n\n' +
                '*Step 1/4: Amount*\n' +
                'Enter the amount:\n\n' +
                '_Example: 500_\n\n' +
                '💡 _Tip: Send photo anytime to attach receipt_'
            );
            return res.status(200).send('OK');
        }

        // Check for pending expense
        let pending = await PendingWhatsAppExpense.findOne({ user: user._id });

        // === PHOTO HANDLING WITH OCR ===
        if (NumMedia && parseInt(NumMedia) > 0 && MediaContentType0?.startsWith('image/')) {
            console.log('📷 Processing image upload...');

            // Upload to Cloudinary first
            const cloudinaryImage = await uploadToCloudinary(MediaUrl0);
            const imageUrl = cloudinaryImage?.url || MediaUrl0;

            // Try OCR to extract bill data
            let ocrResult = { success: false };
            if (ocrService.isConfigured()) {
                await whatsappService.sendMessage(From, '🔍 _Scanning bill..._');
                ocrResult = await ocrService.extractFromBill(imageUrl);
            }

            if (ocrResult.success && ocrResult.amount) {
                // OCR successful - save amount and date, ask user for description
                pending = await PendingWhatsAppExpense.findOneAndUpdate(
                    { user: user._id },
                    {
                        user: user._id,
                        whatsappNumber: phoneNumber,
                        step: 'description', // Ask user to enter description
                        amount: ocrResult.amount,
                        date: ocrResult.date || new Date(),
                        billImage: cloudinaryImage || { url: imageUrl, publicId: '' }
                    },
                    { upsert: true, new: true }
                );

                // Show extracted amount and ask for description
                await whatsappService.sendMessage(From,
                    '📷 *Bill Scanned!*\n\n' +
                    `✅ Amount: ₹${pending.amount}\n` +
                    `✅ Date: ${pending.date.toLocaleDateString()}\n\n` +
                    '*Step 2/4: Description*\n' +
                    'What was this expense for?\n\n' +
                    '_Example: Lunch at Cafe Coffee Day_'
                );
            } else {
                // OCR failed or not configured - fallback to manual entry
                if (!pending) {
                    pending = new PendingWhatsAppExpense({
                        user: user._id,
                        whatsappNumber: phoneNumber,
                        step: 'amount',
                        billImage: cloudinaryImage || { url: imageUrl, publicId: '' }
                    });
                    await pending.save();

                    const ocrMsg = ocrService.isConfigured()
                        ? '⚠️ _Could not read bill clearly_\n\n'
                        : '';

                    await whatsappService.sendMessage(From,
                        '📷 *Receipt Saved!*\n\n' +
                        ocrMsg +
                        '*Step 1/4: Amount*\n' +
                        'Enter the amount:\n\n' +
                        '_Example: 500_'
                    );
                } else {
                    // Attach photo to existing pending expense
                    pending.billImage = cloudinaryImage || { url: imageUrl, publicId: '' };
                    await pending.save();

                    await whatsappService.sendMessage(From,
                        `📷 *Receipt Attached!*\n\nContinue with Step ${pending.step === 'amount' ? '1' : pending.step === 'description' ? '2' : '3'}/4`
                    );
                }
            }
            return res.status(200).send('OK');
        }

        // === INSTANT ADD (no "add" command needed) ===
        // Format: "500 lunch" or "lunch 500"
        if (!pending) {
            const parsed = whatsappService.parseExpenseFromMessage(messageText);
            if (parsed) {
                const expense = new Expense({
                    user: user._id,
                    amount: parsed.amount,
                    description: parsed.description,
                    category: detectCategory(parsed.description),
                    vendor: extractVendor(parsed.description),
                    date: new Date()
                });
                await expense.save();

                await whatsappService.sendMessage(From,
                    '⚡ *Expense Added!*\n\n' +
                    `💰 ₹${expense.amount}\n` +
                    `📝 ${expense.description}\n` +
                    `📁 ${expense.category}\n` +
                    `🏪 ${expense.vendor}\n` +
                    `📅 ${expense.date.toLocaleDateString()}\n\n` +
                    '_Send another or type *summary*_'
                );
                return res.status(200).send('OK');
            }

            // Unknown message
            await whatsappService.sendMessage(From,
                '👋 *Hi!*\n\n' +
                '⚡ Send: *500 lunch* to add expense\n' +
                '📝 Send: *add* for step-by-step\n' +
                '📷 Send: photo to start with receipt\n' +
                '❓ Send: *help* for all commands'
            );
            return res.status(200).send('OK');
        }

        // === 3-STEP FLOW PROCESSING ===
        await processStep(From, user, pending, messageText);
        res.status(200).send('OK');

    } catch (error) {
        console.error('WhatsApp webhook error:', error);
        res.status(200).send('OK');
    }
});

// Process 3-step flow
async function processStep(from, user, pending, message) {
    const input = message?.trim();

    switch (pending.step) {
        case 'amount':
            const inputLowerAmt = input?.toLowerCase();

            // Allow skip if editing (amount already exists)
            if ((inputLowerAmt === 'skip' || inputLowerAmt === 's') && pending.amount) {
                pending.step = 'description';
                await pending.save();

                await whatsappService.sendMessage(from,
                    `✅ Amount: ₹${pending.amount} (kept)\n\n` +
                    '*Step 2/4: Description*\n' +
                    (pending.description ? `Current: ${pending.description}\n\n` : '') +
                    'Enter description or *skip* to keep current:'
                );
                return;
            }

            const amount = parseFloat(input.replace(/[₹,Rs\s]/gi, ''));
            if (isNaN(amount) || amount <= 0) {
                await whatsappService.sendMessage(from,
                    '❌ Please enter a valid amount.\n\n_Example: 500_'
                );
                return;
            }
            pending.amount = amount;
            pending.step = 'description';
            await pending.save();

            await whatsappService.sendMessage(from,
                `✅ Amount: ₹${amount}\n\n` +
                '*Step 2/4: Description*\n' +
                (pending.description ? `Current: ${pending.description}\n\n` : '') +
                'What was this for?\n\n' +
                '_Example: Lunch at Cafe Coffee Day_' +
                (pending.description ? '\n\nOr send *skip* to keep current' : '')
            );
            break;

        case 'description':
            const inputLowerDesc = input?.toLowerCase();

            // Allow skip if editing (description already exists)
            if ((inputLowerDesc === 'skip' || inputLowerDesc === 's') && pending.description) {
                pending.step = 'date';
                await pending.save();

                await whatsappService.sendMessage(from,
                    `✅ Description: ${pending.description} (kept)\n\n` +
                    '*Step 3/4: Date*\n' +
                    (pending.date ? `Current: ${pending.date.toLocaleDateString()}\n\n` : '') +
                    '• *today* - Today\n' +
                    '• *yesterday* - Yesterday\n' +
                    '• *skip* - Keep current\n' +
                    '• Or enter: *25/11*'
                );
                return;
            }

            if (!input || input.length < 2) {
                await whatsappService.sendMessage(from,
                    '❌ Please enter a description.\n\n_Example: Lunch at office_'
                );
                return;
            }

            // Auto-detect category and vendor
            const category = detectCategory(input);
            const vendor = extractVendor(input);

            // Save to pending
            pending.description = input;
            pending.category = category;
            pending.vendor = vendor;
            pending.step = 'date';
            await pending.save();

            // Ask for date
            await whatsappService.sendMessage(from,
                `✅ Description: ${input}\n\n` +
                '*Step 3/4: Date*\n' +
                (pending.date ? `Current: ${pending.date.toLocaleDateString()}\n\n` : '') +
                '• *today* - Today\'s date\n' +
                '• *yesterday* - Yesterday\n' +
                (pending.date ? '• *skip* - Keep current\n' : '') +
                '• Or enter: *25/11* or *25/11/2024*'
            );
            break;

        case 'date':
            let expenseDate = new Date();
            const inputLowerDate = input?.toLowerCase();

            // Allow skip if editing (date already exists)
            if ((inputLowerDate === 'skip' || inputLowerDate === 's') && pending.date) {
                expenseDate = pending.date;
            } else if (inputLowerDate === 'today' || inputLowerDate === 't') {
                expenseDate = new Date();
            } else if (inputLowerDate === 'yesterday' || inputLowerDate === 'y') {
                expenseDate = new Date();
                expenseDate.setDate(expenseDate.getDate() - 1);
            } else {
                // Try to parse date: DD/MM, DD/MM/YY, DD/MM/YYYY, DD-MM-YYYY
                const dateMatch = input.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
                if (dateMatch) {
                    const day = parseInt(dateMatch[1]);
                    const month = parseInt(dateMatch[2]) - 1; // JS months are 0-indexed
                    let year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
                    if (year < 100) year += 2000; // Convert 24 to 2024

                    expenseDate = new Date(year, month, day);

                    // Validate date
                    if (isNaN(expenseDate.getTime()) || day > 31 || month > 11) {
                        await whatsappService.sendMessage(from,
                            '❌ Invalid date.\n\n' +
                            'Use: *today*, *yesterday*, or *DD/MM* format\n' +
                            '_Example: 25/11 or 25/11/2024_'
                        );
                        return;
                    }
                } else {
                    await whatsappService.sendMessage(from,
                        '❌ Invalid date format.\n\n' +
                        'Use: *today*, *yesterday*, or *DD/MM* format\n' +
                        '_Example: 25/11 or 25/11/2024_'
                    );
                    return;
                }
            }

            pending.date = expenseDate;
            pending.step = 'confirm';
            await pending.save();

            // Show confirmation
            await whatsappService.sendMessage(from,
                '📋 *Step 4/4: Confirm*\n\n' +
                `💰 Amount: ₹${pending.amount}\n` +
                `📝 Description: ${pending.description}\n` +
                `📁 Category: ${pending.category}\n` +
                `🏪 Vendor: ${pending.vendor}\n` +
                `📅 Date: ${pending.date.toLocaleDateString()}\n` +
                `📷 Receipt: ${pending.billImage?.url ? 'Attached' : 'None'}\n\n` +
                'Reply:\n' +
                '✅ *yes* - Save expense\n' +
                '❌ *no* - Cancel'
            );
            break;

        case 'confirm':
            const inputLower = input?.toLowerCase();

            if (inputLower === 'yes' || inputLower === 'y' || inputLower === 'ok' || inputLower === 'confirm') {
                // Create expense
                const expenseData = {
                    user: user._id,
                    amount: pending.amount,
                    description: pending.description,
                    category: pending.category,
                    vendor: pending.vendor,
                    date: pending.date
                };

                // Add image if present
                if (pending.billImage?.url) {
                    expenseData.images = [{
                        url: pending.billImage.url,
                        publicId: pending.billImage.publicId || 'whatsapp-upload',
                        filename: 'receipt.jpg'
                    }];
                }

                const expense = new Expense(expenseData);
                await expense.save();

                // Delete pending
                await PendingWhatsAppExpense.deleteOne({ user: user._id });

                await whatsappService.sendMessage(from,
                    '✅ *Expense Saved!*\n\n' +
                    `💰 ₹${expense.amount}\n` +
                    `📝 ${expense.description}\n` +
                    `📁 ${expense.category}\n` +
                    `🏪 ${expense.vendor}\n` +
                    `📅 ${expense.date.toLocaleDateString()}\n` +
                    `📷 ${pending.billImage?.url ? 'Receipt attached' : 'No receipt'}\n\n` +
                    '_Send *add* for another or *summary* for report_'
                );
            } else if (inputLower === 'edit' || inputLower === 'e' || inputLower === 'modify') {
                // Go back to amount step for editing
                pending.step = 'amount';
                await pending.save();

                await whatsappService.sendMessage(from,
                    '✏️ *Edit Mode*\n\n' +
                    '*Step 1/4: Amount*\n' +
                    `Current: ₹${pending.amount}\n\n` +
                    'Enter new amount or send *skip* to keep current:'
                );
            } else if (inputLower === 'no' || inputLower === 'n' || inputLower === 'cancel') {
                await PendingWhatsAppExpense.deleteOne({ user: user._id });
                await whatsappService.sendMessage(from,
                    '❌ *Expense Cancelled*\n\nSend *add* to start again.'
                );
            } else {
                await whatsappService.sendMessage(from,
                    '❓ Reply:\n' +
                    '• *yes* - Save expense\n' +
                    '• *edit* - Modify details\n' +
                    '• *no* - Cancel'
                );
            }
            break;
    }
}

// Send summary helper
async function sendSummary(to, userId, period) {
    let startDate = new Date();
    let periodLabel = 'Today';

    if (period === 'today') {
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
        startDate.setDate(startDate.getDate() - 7);
        periodLabel = 'This Week';
    } else if (period === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
        periodLabel = 'This Month';
    }

    const expenses = await Expense.find({
        user: userId,
        date: { $gte: startDate }
    }).sort({ date: -1 });

    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const byCategory = expenses.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
        return acc;
    }, {});

    let message = `📊 *${periodLabel}'s Expenses*\n\n`;

    if (expenses.length === 0) {
        message += '_No expenses recorded_';
    } else {
        message += `💰 *Total: ₹${total.toFixed(0)}*\n`;
        message += `📝 ${expenses.length} expense${expenses.length > 1 ? 's' : ''}\n\n`;

        if (Object.keys(byCategory).length > 0) {
            message += `📁 *By Category:*\n`;
            Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .forEach(([cat, amt]) => {
                    message += `• ${cat}: ₹${amt.toFixed(0)}\n`;
                });
        }

        if (expenses.length > 0) {
            message += `\n📋 *Recent:*\n`;
            expenses.slice(0, 5).forEach((exp, i) => {
                message += `${i + 1}. ${exp.description} - ₹${exp.amount}\n`;
            });
        }
    }

    await whatsappService.sendMessage(to, message);
}

// @route   POST /api/whatsapp/test
router.post('/test', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user.whatsappNumber) {
            return res.status(400).json({ success: false, message: 'WhatsApp number not configured' });
        }

        await whatsappService.sendMessage(user.whatsappNumber,
            '✅ *Test Successful!*\n\n' +
            'Your WhatsApp is connected.\n\n' +
            '⚡ Send: *500 lunch*\n' +
            '📝 Send: *add* for guided entry\n' +
            '📊 Send: *summary* for report'
        );

        res.json({ success: true, message: 'Test message sent!' });
    } catch (error) {
        console.error('Test message error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
