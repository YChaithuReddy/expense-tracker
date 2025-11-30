const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const whatsappService = require('../services/whatsapp');
const User = require('../models/User');
const Expense = require('../models/Expense');
const upload = require('../middleware/upload');

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

        // Format phone number (ensure it starts with country code)
        let formattedNumber = phoneNumber.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
        if (!formattedNumber.startsWith('+')) {
            // Assume Indian number if no country code
            formattedNumber = '+91' + formattedNumber.replace(/^0+/, '');
        }

        // Update user
        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                whatsappNumber: formattedNumber,
                whatsappNotifications: enableNotifications || false
            },
            { new: true }
        );

        // Send confirmation message
        if (whatsappService.isConfigured()) {
            try {
                await whatsappService.sendMessage(
                    formattedNumber,
                    '✅ *Expense Tracker Connected!*\n\nYou will now receive expense notifications on WhatsApp.\n\n📱 Send receipt photos to add expenses\n💬 Send "150 lunch" to quickly add expenses\n📊 Send "summary" to get your expense report'
                );
            } catch (msgError) {
                console.log('Could not send confirmation (user may need to join sandbox first):', msgError.message);
            }
        }

        res.json({
            success: true,
            message: 'WhatsApp setup complete',
            phoneNumber: formattedNumber,
            notificationsEnabled: user.whatsappNotifications
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
            return res.status(400).json({ success: false, message: 'WhatsApp service not configured on server' });
        }

        const { period } = req.body; // 'today', 'week', 'month', 'all'

        // Calculate date range
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

        // Get expenses
        const expenses = await Expense.find({
            user: req.user.id,
            date: { $gte: startDate }
        });

        // Calculate summary
        const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const byCategory = expenses.reduce((acc, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
            return acc;
        }, {});

        const summary = {
            period: periodLabel,
            total,
            count: expenses.length,
            byCategory
        };

        await whatsappService.sendExpenseSummary(user.whatsappNumber, summary);

        res.json({ success: true, message: 'Summary sent to WhatsApp' });
    } catch (error) {
        console.error('Send summary error:', error);
        res.status(500).json({ success: false, message: 'Failed to send summary' });
    }
});

// @route   POST /api/whatsapp/webhook
// @desc    Receive incoming WhatsApp messages (Twilio webhook)
// @access  Public (validated by Twilio)
router.post('/webhook', async (req, res) => {
    try {
        const {
            From,           // Sender's WhatsApp number
            Body,           // Message text
            NumMedia,       // Number of media attachments
            MediaUrl0,      // First media URL (if any)
            MediaContentType0  // Media type
        } = req.body;

        console.log('📱 WhatsApp webhook received:', { From, Body, NumMedia });

        // Find user by WhatsApp number
        const phoneNumber = From.replace('whatsapp:', '');
        const user = await User.findOne({ whatsappNumber: phoneNumber });

        if (!user) {
            // Unknown user - send registration prompt
            await whatsappService.sendMessage(From,
                '❌ Your number is not registered.\n\nPlease register at expense-tracker-delta-ashy.vercel.app and add your WhatsApp number in settings.'
            );
            return res.status(200).send('OK');
        }

        // Handle media (receipt photo)
        if (NumMedia && parseInt(NumMedia) > 0 && MediaContentType0?.startsWith('image/')) {
            // Create expense from image
            const expense = new Expense({
                user: user._id,
                description: 'Receipt via WhatsApp (pending OCR)',
                amount: 0,
                category: 'Other',
                date: new Date(),
                billImage: MediaUrl0,
                status: 'pending_review'
            });

            await expense.save();

            await whatsappService.sendMessage(From,
                '📷 *Receipt Received!*\n\nYour receipt has been saved. Please open the app to verify and update the expense details.'
            );

            return res.status(200).send('OK');
        }

        // Handle text commands
        const messageText = Body?.trim().toLowerCase();

        if (messageText === 'summary' || messageText === 'report') {
            // Send expense summary
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const expenses = await Expense.find({
                user: user._id,
                date: { $gte: today }
            });

            const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
            await whatsappService.sendDailySummary(From, expenses, total);

        } else if (messageText === 'help') {
            await whatsappService.sendMessage(From,
                '📱 *Expense Tracker Commands*\n\n' +
                '💰 Add expense: Send "150 lunch" or "coffee 80"\n' +
                '📷 Add receipt: Send a photo of your bill\n' +
                '📊 Get summary: Send "summary" or "report"\n' +
                '❓ Help: Send "help"'
            );

        } else {
            // Try to parse as expense
            const parsedExpense = whatsappService.parseExpenseFromMessage(Body);

            if (parsedExpense) {
                const expense = new Expense({
                    user: user._id,
                    description: parsedExpense.description,
                    amount: parsedExpense.amount,
                    category: parsedExpense.category,
                    date: new Date()
                });

                await expense.save();
                await whatsappService.sendExpenseConfirmation(From, expense);

            } else {
                await whatsappService.sendMessage(From,
                    '❓ Could not understand your message.\n\n' +
                    'Try: "150 lunch" or "coffee 80"\n' +
                    'Or send "help" for commands.'
                );
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('WhatsApp webhook error:', error);
        res.status(200).send('OK'); // Always return 200 to Twilio
    }
});

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
            return res.status(400).json({ success: false, message: 'WhatsApp service not configured on server' });
        }

        await whatsappService.sendMessage(
            user.whatsappNumber,
            '✅ *Test Message*\n\nYour WhatsApp integration is working correctly!\n\n🎉 Expense Tracker'
        );

        res.json({ success: true, message: 'Test message sent' });
    } catch (error) {
        console.error('Test message error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
