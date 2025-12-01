const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const whatsappService = require('../services/whatsapp');
const User = require('../models/User');
const Expense = require('../models/Expense');
const PendingWhatsAppExpense = require('../models/PendingWhatsAppExpense');

// Category options for user selection
const CATEGORIES = [
    '1. Food',
    '2. Transport',
    '3. Shopping',
    '4. Utilities',
    '5. Entertainment',
    '6. Health',
    '7. Groceries',
    '8. Other'
];

const CATEGORY_MAP = {
    '1': 'Food',
    '2': 'Transport',
    '3': 'Shopping',
    '4': 'Utilities',
    '5': 'Entertainment',
    '6': 'Health',
    '7': 'Groceries',
    '8': 'Other',
    'food': 'Food',
    'transport': 'Transport',
    'shopping': 'Shopping',
    'utilities': 'Utilities',
    'entertainment': 'Entertainment',
    'health': 'Health',
    'groceries': 'Groceries',
    'other': 'Other'
};

// @route   GET /api/whatsapp/status
// @desc    Check WhatsApp configuration status
// @access  Private
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
// @desc    Setup user's WhatsApp number
// @access  Private
router.post('/setup', protect, async (req, res) => {
    try {
        const { phoneNumber, enableNotifications } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        // Format phone number
        let formattedNumber = phoneNumber.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
        if (!formattedNumber.startsWith('+')) {
            formattedNumber = '+91' + formattedNumber.replace(/^0+/, '');
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                whatsappNumber: formattedNumber,
                whatsappNotifications: enableNotifications || false
            },
            { new: true }
        );

        // Send welcome message
        if (whatsappService.isConfigured()) {
            try {
                await whatsappService.sendMessage(
                    formattedNumber,
                    '✅ *Expense Tracker Connected!*\n\n' +
                    'You can now add expenses via WhatsApp!\n\n' +
                    '*Commands:*\n' +
                    '📝 *add* - Start adding a new expense\n' +
                    '📊 *summary* - Get expense report\n' +
                    '❓ *help* - See all commands\n\n' +
                    '_Send "add" to start!_'
                );
            } catch (msgError) {
                console.log('Could not send welcome message:', msgError.message);
            }
        }

        res.json({
            success: true,
            message: 'WhatsApp setup complete',
            phoneNumber: formattedNumber
        });
    } catch (error) {
        console.error('WhatsApp setup error:', error);
        res.status(500).json({ success: false, message: 'Failed to setup WhatsApp' });
    }
});

// @route   POST /api/whatsapp/send-summary
// @desc    Send expense summary to user's WhatsApp
// @access  Private
router.post('/send-summary', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user.whatsappNumber) {
            return res.status(400).json({ success: false, message: 'WhatsApp number not configured' });
        }

        if (!whatsappService.isConfigured()) {
            return res.status(400).json({ success: false, message: 'WhatsApp service not configured' });
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

        const expenses = await Expense.find({
            user: req.user.id,
            date: { $gte: startDate }
        });

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
// @desc    Receive incoming WhatsApp messages (Twilio webhook)
// @access  Public
router.post('/webhook', async (req, res) => {
    try {
        const { From, Body, NumMedia, MediaUrl0, MediaContentType0 } = req.body;

        console.log('📱 WhatsApp webhook received:', { From, Body, NumMedia });

        const phoneNumber = From.replace('whatsapp:', '');
        const user = await User.findOne({ whatsappNumber: phoneNumber });

        if (!user) {
            await whatsappService.sendMessage(From,
                '❌ *Number Not Registered*\n\n' +
                'Please register at:\nexpense-tracker-delta-ashy.vercel.app\n\n' +
                'Then add your WhatsApp number in Settings → WhatsApp.'
            );
            return res.status(200).send('OK');
        }

        const messageText = Body?.trim().toLowerCase();

        // Check for cancel command
        if (messageText === 'cancel' || messageText === 'exit' || messageText === 'quit') {
            await PendingWhatsAppExpense.deleteOne({ user: user._id });
            await whatsappService.sendMessage(From, '❌ Expense cancelled.\n\nSend *add* to start again.');
            return res.status(200).send('OK');
        }

        // Check for help command
        if (messageText === 'help' || messageText === '?') {
            await whatsappService.sendMessage(From,
                '📱 *Expense Tracker Commands*\n\n' +
                '📝 *add* - Add new expense (step by step)\n' +
                '⚡ *quick* - Quick add (e.g., "quick 150 lunch")\n' +
                '📊 *summary* - Today\'s expenses\n' +
                '📅 *week* - This week\'s summary\n' +
                '📆 *month* - This month\'s summary\n' +
                '❌ *cancel* - Cancel current expense\n' +
                '❓ *help* - Show this message'
            );
            return res.status(200).send('OK');
        }

        // Check for summary commands
        if (messageText === 'summary' || messageText === 'report' || messageText === 'today') {
            await sendSummary(From, user._id, 'today');
            return res.status(200).send('OK');
        }

        if (messageText === 'week' || messageText === 'weekly') {
            await sendSummary(From, user._id, 'week');
            return res.status(200).send('OK');
        }

        if (messageText === 'month' || messageText === 'monthly') {
            await sendSummary(From, user._id, 'month');
            return res.status(200).send('OK');
        }

        // Quick add command
        if (messageText.startsWith('quick ')) {
            const quickData = messageText.replace('quick ', '');
            const parsed = whatsappService.parseExpenseFromMessage(quickData);

            if (parsed) {
                const expense = new Expense({
                    user: user._id,
                    description: parsed.description,
                    amount: parsed.amount,
                    category: parsed.category,
                    vendor: 'N/A',
                    date: new Date()
                });
                await expense.save();

                await whatsappService.sendMessage(From,
                    '⚡ *Quick Expense Added!*\n\n' +
                    `📝 ${parsed.description}\n` +
                    `💰 ₹${parsed.amount}\n` +
                    `📁 ${parsed.category}\n\n` +
                    '_No receipt attached_'
                );
            } else {
                await whatsappService.sendMessage(From,
                    '❌ Invalid format.\n\nUse: *quick 150 lunch*'
                );
            }
            return res.status(200).send('OK');
        }

        // Start new expense flow
        if (messageText === 'add' || messageText === 'new' || messageText === 'start') {
            await PendingWhatsAppExpense.deleteOne({ user: user._id });

            const pending = new PendingWhatsAppExpense({
                user: user._id,
                whatsappNumber: phoneNumber,
                step: 'amount'
            });
            await pending.save();

            await whatsappService.sendMessage(From,
                '📝 *New Expense*\n\n' +
                '*Step 1/6: Amount*\n' +
                'Enter the expense amount:\n\n' +
                '_Example: 150 or 1500.50_\n\n' +
                '_(Send "cancel" to stop)_'
            );
            return res.status(200).send('OK');
        }

        // Check for pending expense conversation
        let pending = await PendingWhatsAppExpense.findOne({ user: user._id });

        // Handle photo upload
        if (NumMedia && parseInt(NumMedia) > 0 && MediaContentType0?.startsWith('image/')) {
            if (pending && pending.step === 'photo') {
                pending.billImage = { url: MediaUrl0, publicId: '' };
                pending.step = 'confirm';
                await pending.save();

                await whatsappService.sendMessage(From,
                    '📷 *Photo Received!*\n\n' +
                    '*Step 6/6: Confirm*\n\n' +
                    formatExpensePreview(pending) +
                    '\n\nReply:\n' +
                    '✅ *yes* - Save expense\n' +
                    '❌ *no* - Cancel'
                );
            } else if (pending) {
                await whatsappService.sendMessage(From,
                    '⚠️ Please complete current step first.\n\n' +
                    `Current step: *${pending.step}*`
                );
            } else {
                // No pending expense, start new one with photo
                const newPending = new PendingWhatsAppExpense({
                    user: user._id,
                    whatsappNumber: phoneNumber,
                    step: 'amount',
                    billImage: { url: MediaUrl0, publicId: '' }
                });
                await newPending.save();

                await whatsappService.sendMessage(From,
                    '📷 *Receipt Photo Received!*\n\n' +
                    'Let\'s add the expense details.\n\n' +
                    '*Step 1/6: Amount*\n' +
                    'Enter the expense amount:\n\n' +
                    '_Example: 150_'
                );
            }
            return res.status(200).send('OK');
        }

        // If no pending expense and not a command, prompt user
        if (!pending) {
            await whatsappService.sendMessage(From,
                '👋 *Hi there!*\n\n' +
                'Send *add* to add a new expense\n' +
                'Send *help* for all commands'
            );
            return res.status(200).send('OK');
        }

        // Process conversation based on current step
        await processConversationStep(From, user, pending, Body, MediaUrl0);

        res.status(200).send('OK');
    } catch (error) {
        console.error('WhatsApp webhook error:', error);
        res.status(200).send('OK');
    }
});

// Process conversation step
async function processConversationStep(from, user, pending, message, mediaUrl) {
    const input = message?.trim();
    const inputLower = input?.toLowerCase();

    switch (pending.step) {
        case 'amount':
            const amount = parseFloat(input.replace(/[₹,Rs]/gi, ''));
            if (isNaN(amount) || amount <= 0) {
                await whatsappService.sendMessage(from,
                    '❌ Invalid amount. Please enter a number.\n\n_Example: 150 or 250.50_'
                );
                return;
            }
            pending.amount = amount;
            pending.step = 'description';
            await pending.save();

            await whatsappService.sendMessage(from,
                `✅ Amount: ₹${amount}\n\n` +
                '*Step 2/6: Description*\n' +
                'What is this expense for?\n\n' +
                '_Example: Lunch at cafe_'
            );
            break;

        case 'description':
            if (!input || input.length < 2) {
                await whatsappService.sendMessage(from,
                    '❌ Please enter a description.\n\n_Example: Lunch at cafe_'
                );
                return;
            }
            pending.description = input;
            pending.step = 'category';
            await pending.save();

            await whatsappService.sendMessage(from,
                `✅ Description: ${input}\n\n` +
                '*Step 3/6: Category*\n' +
                'Choose a category (reply with number):\n\n' +
                CATEGORIES.join('\n')
            );
            break;

        case 'category':
            const category = CATEGORY_MAP[inputLower] || CATEGORY_MAP[input];
            if (!category) {
                await whatsappService.sendMessage(from,
                    '❌ Invalid category. Reply with a number (1-8):\n\n' +
                    CATEGORIES.join('\n')
                );
                return;
            }
            pending.category = category;
            pending.step = 'vendor';
            await pending.save();

            await whatsappService.sendMessage(from,
                `✅ Category: ${category}\n\n` +
                '*Step 4/6: Vendor/Shop*\n' +
                'Enter vendor name (or send *skip*):\n\n' +
                '_Example: Starbucks, Amazon, etc._'
            );
            break;

        case 'vendor':
            pending.vendor = (inputLower === 'skip' || inputLower === 'na') ? 'N/A' : input;
            pending.step = 'date';
            await pending.save();

            await whatsappService.sendMessage(from,
                `✅ Vendor: ${pending.vendor}\n\n` +
                '*Step 5/6: Date*\n' +
                'When was this expense?\n\n' +
                'Reply:\n' +
                '• *today* - Today\'s date\n' +
                '• *yesterday* - Yesterday\n' +
                '• Or enter date: *DD/MM/YYYY*'
            );
            break;

        case 'date':
            let expenseDate = new Date();

            if (inputLower === 'today') {
                expenseDate = new Date();
            } else if (inputLower === 'yesterday') {
                expenseDate = new Date();
                expenseDate.setDate(expenseDate.getDate() - 1);
            } else {
                // Try to parse date
                const dateParts = input.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
                if (dateParts) {
                    const day = parseInt(dateParts[1]);
                    const month = parseInt(dateParts[2]) - 1;
                    const year = parseInt(dateParts[3]) < 100 ? 2000 + parseInt(dateParts[3]) : parseInt(dateParts[3]);
                    expenseDate = new Date(year, month, day);
                } else {
                    await whatsappService.sendMessage(from,
                        '❌ Invalid date format.\n\n' +
                        'Reply *today*, *yesterday*, or enter *DD/MM/YYYY*'
                    );
                    return;
                }
            }

            pending.date = expenseDate;
            pending.step = 'photo';
            await pending.save();

            await whatsappService.sendMessage(from,
                `✅ Date: ${expenseDate.toLocaleDateString()}\n\n` +
                '*Step 6/6: Receipt Photo*\n\n' +
                '📷 Send a photo of the receipt\n\n' +
                'Or reply *skip* if no receipt'
            );
            break;

        case 'photo':
            if (inputLower === 'skip' || inputLower === 'no') {
                pending.step = 'confirm';
                await pending.save();

                await whatsappService.sendMessage(from,
                    '✅ No receipt attached\n\n' +
                    '*Confirm Expense:*\n\n' +
                    formatExpensePreview(pending) +
                    '\n\nReply:\n' +
                    '✅ *yes* - Save expense\n' +
                    '❌ *no* - Cancel'
                );
            } else {
                await whatsappService.sendMessage(from,
                    '📷 Please send a photo or reply *skip*'
                );
            }
            break;

        case 'confirm':
            if (inputLower === 'yes' || inputLower === 'y' || inputLower === 'confirm') {
                // Save the expense
                const expenseData = {
                    user: user._id,
                    amount: pending.amount,
                    description: pending.description,
                    category: pending.category,
                    vendor: pending.vendor || 'N/A',
                    date: pending.date || new Date()
                };

                // Add image if present
                if (pending.billImage?.url) {
                    expenseData.images = [{
                        url: pending.billImage.url,
                        publicId: pending.billImage.publicId || 'whatsapp-upload',
                        filename: 'whatsapp-receipt.jpg'
                    }];
                }

                const expense = new Expense(expenseData);
                await expense.save();

                // Delete pending
                await PendingWhatsAppExpense.deleteOne({ user: user._id });

                await whatsappService.sendMessage(from,
                    '✅ *Expense Saved!*\n\n' +
                    `📝 ${expense.description}\n` +
                    `💰 ₹${expense.amount}\n` +
                    `📁 ${expense.category}\n` +
                    `🏪 ${expense.vendor}\n` +
                    `📅 ${expense.date.toLocaleDateString()}\n` +
                    `📷 ${pending.billImage?.url ? 'Receipt attached' : 'No receipt'}\n\n` +
                    '_Send *add* to add another expense_'
                );
            } else if (inputLower === 'no' || inputLower === 'n' || inputLower === 'cancel') {
                await PendingWhatsAppExpense.deleteOne({ user: user._id });
                await whatsappService.sendMessage(from,
                    '❌ Expense cancelled.\n\nSend *add* to start again.'
                );
            } else {
                await whatsappService.sendMessage(from,
                    '❓ Please reply *yes* to save or *no* to cancel.'
                );
            }
            break;
    }
}

// Format expense preview
function formatExpensePreview(pending) {
    return `💰 *Amount:* ₹${pending.amount}\n` +
           `📝 *Description:* ${pending.description}\n` +
           `📁 *Category:* ${pending.category}\n` +
           `🏪 *Vendor:* ${pending.vendor || 'N/A'}\n` +
           `📅 *Date:* ${pending.date ? pending.date.toLocaleDateString() : 'Today'}\n` +
           `📷 *Receipt:* ${pending.billImage?.url ? 'Attached' : 'None'}`;
}

// Send summary helper
async function sendSummary(to, userId, period) {
    let startDate = new Date();
    let periodLabel = 'Today';

    if (period === 'today') {
        startDate.setHours(0, 0, 0, 0);
        periodLabel = 'Today';
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

    let message = `📊 *Expense Summary - ${periodLabel}*\n\n`;

    if (expenses.length === 0) {
        message += '_No expenses recorded_\n';
    } else {
        message += `💰 *Total: ₹${total.toFixed(2)}*\n`;
        message += `📝 *Count:* ${expenses.length} expenses\n\n`;

        message += `📁 *By Category:*\n`;
        Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .forEach(([cat, amount]) => {
                const percent = ((amount / total) * 100).toFixed(0);
                message += `  • ${cat}: ₹${amount.toFixed(0)} (${percent}%)\n`;
            });

        message += `\n📋 *Recent:*\n`;
        expenses.slice(0, 5).forEach((exp, i) => {
            message += `${i + 1}. ${exp.description} - ₹${exp.amount}\n`;
        });
    }

    await whatsappService.sendMessage(to, message);
}

// @route   POST /api/whatsapp/test
// @desc    Send a test message
// @access  Private
router.post('/test', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user.whatsappNumber) {
            return res.status(400).json({ success: false, message: 'WhatsApp number not configured' });
        }

        if (!whatsappService.isConfigured()) {
            return res.status(400).json({ success: false, message: 'WhatsApp service not configured' });
        }

        await whatsappService.sendMessage(
            user.whatsappNumber,
            '✅ *Test Successful!*\n\n' +
            'Your WhatsApp is connected to Expense Tracker.\n\n' +
            '*Commands:*\n' +
            '📝 *add* - Add expense (step-by-step)\n' +
            '⚡ *quick 150 lunch* - Quick add\n' +
            '📊 *summary* - Get report\n' +
            '❓ *help* - All commands'
        );

        res.json({ success: true, message: 'Test message sent!' });
    } catch (error) {
        console.error('Test message error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
