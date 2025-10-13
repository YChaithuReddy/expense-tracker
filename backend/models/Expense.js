const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    date: {
        type: Date,
        required: [true, 'Please provide expense date'],
        index: true
    },
    time: {
        type: String, // Stored as "HH:MM" format
        default: ''
    },
    category: {
        type: String,
        required: [true, 'Please provide a category'],
        trim: true
        // No enum constraint - allows hierarchical format: "MainCategory - Subcategory"
        // Validation is handled by validators.js middleware
    },
    amount: {
        type: Number,
        required: [true, 'Please provide an amount'],
        min: [0, 'Amount must be positive']
    },
    vendor: {
        type: String,
        default: 'N/A',
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please provide a description'],
        trim: true
    },
    images: [{
        url: {
            type: String,
            required: true
        },
        publicId: {
            type: String, // Cloudinary public_id for deletion
            required: true
        },
        filename: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, createdAt: -1 });

// Update the updatedAt timestamp before saving
expenseSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Expense', expenseSchema);
