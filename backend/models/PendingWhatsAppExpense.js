const mongoose = require('mongoose');

/**
 * Stores pending expense data during WhatsApp conversation flow
 * Each user can only have one pending expense at a time
 */
const pendingWhatsAppExpenseSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true // One pending expense per user
    },
    whatsappNumber: {
        type: String,
        required: true
    },
    // Conversation state (simplified 3-step flow)
    step: {
        type: String,
        enum: ['amount', 'description'],
        default: 'amount'
    },
    // Expense data being collected
    amount: {
        type: Number,
        default: null
    },
    description: {
        type: String,
        default: null
    },
    category: {
        type: String,
        default: null
    },
    vendor: {
        type: String,
        default: null
    },
    date: {
        type: Date,
        default: null
    },
    billImage: {
        url: String,
        publicId: String
    },
    // Auto-expire after 30 minutes of inactivity
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 1800 // 30 minutes TTL
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
pendingWhatsAppExpenseSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('PendingWhatsAppExpense', pendingWhatsAppExpenseSchema);
