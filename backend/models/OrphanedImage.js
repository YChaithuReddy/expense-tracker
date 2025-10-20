const mongoose = require('mongoose');

/**
 * Schema for orphaned images - images that were part of expenses but the expense data was cleared
 * These images are retained for later PDF generation or reuse
 */
const orphanedImageSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Cloudinary image details
    url: {
        type: String,
        required: true
    },

    publicId: {
        type: String,
        required: true
    },

    filename: {
        type: String,
        required: true
    },

    // Original expense information (for reference)
    originalExpenseInfo: {
        date: Date,
        vendor: String,
        amount: Number,
        category: String,
        expenseId: String
    },

    // Image metadata
    uploadDate: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Expiry date (auto-delete after this date)
    expiryDate: {
        type: Date,
        default: function() {
            // Default 30 days from upload
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }
    },

    // Track if this image was included in any PDF export
    wasExported: {
        type: Boolean,
        default: false
    },

    lastExportedAt: {
        type: Date
    },

    // File size in bytes
    sizeInBytes: {
        type: Number,
        default: 0
    },

    // User-defined tags for organization
    tags: [{
        type: String
    }],

    // Retention settings
    retentionPeriodDays: {
        type: Number,
        default: 30
    },

    // Flag to prevent auto-deletion
    preserveIndefinitely: {
        type: Boolean,
        default: false
    },

    // Notes or description
    notes: {
        type: String
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
orphanedImageSchema.index({ user: 1, uploadDate: -1 });
orphanedImageSchema.index({ user: 1, wasExported: 1 });
orphanedImageSchema.index({ expiryDate: 1 }); // For cleanup job

// Virtual for checking if image is expired
orphanedImageSchema.virtual('isExpired').get(function() {
    return !this.preserveIndefinitely && this.expiryDate < new Date();
});

// Virtual for days until expiry
orphanedImageSchema.virtual('daysUntilExpiry').get(function() {
    if (this.preserveIndefinitely) return null;

    const msPerDay = 24 * 60 * 60 * 1000;
    const daysLeft = Math.ceil((this.expiryDate - new Date()) / msPerDay);
    return Math.max(0, daysLeft);
});

// Virtual for age in days
orphanedImageSchema.virtual('ageInDays').get(function() {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((new Date() - this.uploadDate) / msPerDay);
});

// Method to mark as exported
orphanedImageSchema.methods.markAsExported = function() {
    this.wasExported = true;
    this.lastExportedAt = new Date();
    return this.save();
};

// Method to extend expiry
orphanedImageSchema.methods.extendExpiry = function(days) {
    const additionalMs = days * 24 * 60 * 60 * 1000;
    this.expiryDate = new Date(this.expiryDate.getTime() + additionalMs);
    return this.save();
};

// Static method to get user's storage stats
orphanedImageSchema.statics.getUserStorageStats = async function(userId) {
    const images = await this.find({ user: userId });

    // Calculate expiring within 7 days manually
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringCount = images.filter(img => {
        return !img.preserveIndefinitely && img.expiryDate > now && img.expiryDate <= sevenDaysFromNow;
    }).length;

    // Calculate oldest image age manually
    let oldestImageDays = 0;
    if (images.length > 0) {
        const oldestDate = Math.min(...images.map(img => img.uploadDate.getTime()));
        oldestImageDays = Math.floor((now - oldestDate) / (24 * 60 * 60 * 1000));
    }

    const stats = {
        totalImages: images.length,
        totalSizeBytes: images.reduce((sum, img) => sum + (img.sizeInBytes || 0), 0),
        exportedCount: images.filter(img => img.wasExported).length,
        unexportedCount: images.filter(img => !img.wasExported).length,
        expiringWithin7Days: expiringCount,
        oldestImage: oldestImageDays
    };

    stats.totalSizeMB = (stats.totalSizeBytes / (1024 * 1024)).toFixed(2);

    return stats;
};

// Static method to clean up expired images
orphanedImageSchema.statics.cleanupExpiredImages = async function() {
    const expired = await this.find({
        expiryDate: { $lt: new Date() },
        preserveIndefinitely: false
    });

    const cloudinary = require('cloudinary').v2;
    let deletedCount = 0;

    for (const image of expired) {
        try {
            // Delete from Cloudinary
            if (image.publicId) {
                await cloudinary.uploader.destroy(image.publicId);
            }

            // Delete from database
            await image.deleteOne();
            deletedCount++;

            console.log(`Deleted expired orphaned image: ${image.filename} for user ${image.user}`);
        } catch (error) {
            console.error(`Failed to delete expired image ${image._id}:`, error);
        }
    }

    return deletedCount;
};

// Static method to create from expense images
orphanedImageSchema.statics.createFromExpenseImages = async function(expense) {
    const orphanedImages = [];

    for (const image of expense.images) {
        const orphanedImage = await this.create({
            user: expense.user,
            url: image.url,
            publicId: image.publicId,
            filename: image.filename,
            originalExpenseInfo: {
                date: expense.date,
                vendor: expense.vendor,
                amount: expense.amount,
                category: expense.category,
                expenseId: expense._id.toString()
            },
            sizeInBytes: image.sizeInBytes || 0,
            uploadDate: image.uploadedAt || expense.createdAt
        });

        orphanedImages.push(orphanedImage);
    }

    return orphanedImages;
};

const OrphanedImage = mongoose.model('OrphanedImage', orphanedImageSchema);

module.exports = OrphanedImage;