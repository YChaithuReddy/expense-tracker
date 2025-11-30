const axios = require('axios');

class WhatsAppService {
    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER; // Format: whatsapp:+14155238886
        this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    }

    isConfigured() {
        return !!(this.accountSid && this.authToken && this.whatsappNumber);
    }

    /**
     * Send a WhatsApp message
     * @param {string} to - Recipient phone number (format: +91XXXXXXXXXX)
     * @param {string} message - Message text
     * @returns {Promise<object>} - Twilio response
     */
    async sendMessage(to, message) {
        if (!this.isConfigured()) {
            throw new Error('WhatsApp service not configured. Please set Twilio credentials.');
        }

        const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

        const params = new URLSearchParams();
        params.append('From', this.whatsappNumber);
        params.append('To', formattedTo);
        params.append('Body', message);

        try {
            const response = await axios.post(this.baseUrl, params, {
                auth: {
                    username: this.accountSid,
                    password: this.authToken
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            console.log(`✅ WhatsApp message sent to ${to}`);
            return response.data;
        } catch (error) {
            console.error('❌ WhatsApp send error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to send WhatsApp message');
        }
    }

    /**
     * Send expense summary via WhatsApp
     * @param {string} to - Recipient phone number
     * @param {object} summary - Expense summary object
     */
    async sendExpenseSummary(to, summary) {
        const message = this.formatExpenseSummary(summary);
        return this.sendMessage(to, message);
    }

    /**
     * Send daily expense summary
     * @param {string} to - Recipient phone number
     * @param {Array} expenses - Today's expenses
     * @param {number} total - Total amount
     */
    async sendDailySummary(to, expenses, total) {
        let message = `📊 *Daily Expense Summary*\n`;
        message += `📅 Date: ${new Date().toLocaleDateString()}\n\n`;

        if (expenses.length === 0) {
            message += `No expenses recorded today.\n`;
        } else {
            expenses.forEach((exp, i) => {
                message += `${i + 1}. ${exp.description} - ₹${exp.amount}\n`;
            });
            message += `\n💰 *Total: ₹${total.toFixed(2)}*`;
        }

        return this.sendMessage(to, message);
    }

    /**
     * Send budget alert
     * @param {string} to - Recipient phone number
     * @param {number} spent - Amount spent
     * @param {number} budget - Budget limit
     */
    async sendBudgetAlert(to, spent, budget) {
        const percentage = ((spent / budget) * 100).toFixed(1);
        const remaining = budget - spent;

        let message = `⚠️ *Budget Alert*\n\n`;
        message += `You've spent *₹${spent.toFixed(2)}* of your *₹${budget.toFixed(2)}* budget.\n`;
        message += `📊 Usage: ${percentage}%\n`;
        message += `💰 Remaining: ₹${remaining.toFixed(2)}`;

        if (percentage >= 100) {
            message += `\n\n🚨 *Budget Exceeded!*`;
        } else if (percentage >= 80) {
            message += `\n\n⚠️ *Approaching budget limit!*`;
        }

        return this.sendMessage(to, message);
    }

    /**
     * Send expense confirmation
     * @param {string} to - Recipient phone number
     * @param {object} expense - Expense object
     */
    async sendExpenseConfirmation(to, expense) {
        let message = `✅ *Expense Added*\n\n`;
        message += `📝 ${expense.description}\n`;
        message += `💰 Amount: ₹${expense.amount}\n`;
        message += `📁 Category: ${expense.category}\n`;
        message += `📅 Date: ${new Date(expense.date).toLocaleDateString()}`;

        return this.sendMessage(to, message);
    }

    /**
     * Format expense summary for WhatsApp
     */
    formatExpenseSummary(summary) {
        let message = `📊 *Expense Summary*\n`;
        message += `📅 Period: ${summary.period || 'All Time'}\n\n`;

        message += `💰 *Total: ₹${summary.total.toFixed(2)}*\n`;
        message += `📝 Expenses: ${summary.count}\n\n`;

        if (summary.byCategory && Object.keys(summary.byCategory).length > 0) {
            message += `📁 *By Category:*\n`;
            Object.entries(summary.byCategory).forEach(([cat, amount]) => {
                message += `  • ${cat}: ₹${amount.toFixed(2)}\n`;
            });
        }

        return message;
    }

    /**
     * Parse incoming WhatsApp message for expense data
     * @param {string} message - Incoming message text
     * @returns {object|null} - Parsed expense or null
     */
    parseExpenseFromMessage(message) {
        // Pattern: "amount description" or "description amount"
        // Examples: "150 lunch", "coffee 80", "₹200 groceries"

        const patterns = [
            /^[₹Rs.]?\s*(\d+(?:\.\d{2})?)\s+(.+)$/i,  // "150 lunch"
            /^(.+?)\s+[₹Rs.]?\s*(\d+(?:\.\d{2})?)$/i,  // "lunch 150"
            /^(\d+(?:\.\d{2})?)\s*[₹Rs.]?\s+(.+)$/i   // "150₹ lunch"
        ];

        for (const pattern of patterns) {
            const match = message.trim().match(pattern);
            if (match) {
                const isAmountFirst = !isNaN(parseFloat(match[1]));
                return {
                    amount: parseFloat(isAmountFirst ? match[1] : match[2]),
                    description: (isAmountFirst ? match[2] : match[1]).trim(),
                    category: this.guessCategory(isAmountFirst ? match[2] : match[1])
                };
            }
        }

        return null;
    }

    /**
     * Guess expense category from description
     */
    guessCategory(description) {
        const desc = description.toLowerCase();

        const categoryKeywords = {
            'Food': ['lunch', 'dinner', 'breakfast', 'food', 'restaurant', 'coffee', 'tea', 'snack', 'meal', 'eat'],
            'Transport': ['uber', 'ola', 'cab', 'taxi', 'bus', 'metro', 'train', 'fuel', 'petrol', 'diesel', 'parking'],
            'Shopping': ['shop', 'amazon', 'flipkart', 'clothes', 'shoes', 'buy'],
            'Utilities': ['electricity', 'water', 'gas', 'internet', 'wifi', 'phone', 'recharge', 'bill'],
            'Entertainment': ['movie', 'netflix', 'spotify', 'game', 'concert', 'show'],
            'Health': ['medicine', 'doctor', 'hospital', 'pharmacy', 'medical', 'health'],
            'Groceries': ['grocery', 'vegetables', 'fruits', 'milk', 'supermarket']
        };

        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(keyword => desc.includes(keyword))) {
                return category;
            }
        }

        return 'Other';
    }
}

module.exports = new WhatsAppService();
