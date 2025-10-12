const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const { protect } = require('../middleware/auth');
const { expenseValidation } = require('../utils/validators');
const { upload, deleteImage } = require('../middleware/upload');

// Apply protect middleware to all expense routes
router.use(protect);

/**
 * @route   GET /api/expenses
 * @desc    Get all expenses for logged in user
 * @access  Private
 */
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 50, sortBy = '-date', category } = req.query;

        const query = { user: req.user.id };

        // Filter by category if provided
        if (category && category !== 'all') {
            query.category = category;
        }

        // Fetch expenses and sort by date DESC, then time DESC (chronological order - newest first)
        const expenses = await Expense.find(query)
            .sort({ date: -1, time: -1 }) // Sort by date descending, then time descending
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Expense.countDocuments(query);

        res.status(200).json({
            status: 'success',
            count: expenses.length,
            total: count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            expenses
        });
    } catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching expenses'
        });
    }
});

/**
 * @route   GET /api/expenses/:id
 * @desc    Get single expense by ID
 * @access  Private
 */
router.get('/:id', async (req, res) => {
    try {
        const expense = await Expense.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!expense) {
            return res.status(404).json({
                status: 'error',
                message: 'Expense not found'
            });
        }

        res.status(200).json({
            status: 'success',
            expense
        });
    } catch (error) {
        console.error('Get expense error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching expense'
        });
    }
});

/**
 * @route   POST /api/expenses
 * @desc    Create a new expense
 * @access  Private
 */
router.post('/', upload.array('images', 5), expenseValidation, async (req, res) => {
    try {
        const { date, time, category, amount, vendor, description } = req.body;

        // Process uploaded images
        const images = req.files ? req.files.map(file => ({
            url: file.path,
            publicId: file.filename,
            filename: file.originalname
        })) : [];

        const expense = await Expense.create({
            user: req.user.id,
            date,
            time: time || '',
            category,
            amount,
            vendor: vendor || 'N/A',
            description: description || '',
            images
        });

        res.status(201).json({
            status: 'success',
            expense
        });
    } catch (error) {
        console.error('Create expense error:', error);

        // Delete uploaded images if expense creation failed
        if (req.files) {
            req.files.forEach(file => deleteImage(file.filename));
        }

        res.status(500).json({
            status: 'error',
            message: 'Error creating expense'
        });
    }
});

/**
 * @route   PUT /api/expenses/:id
 * @desc    Update an expense
 * @access  Private
 */
router.put('/:id', upload.array('images', 5), async (req, res) => {
    try {
        let expense = await Expense.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!expense) {
            return res.status(404).json({
                status: 'error',
                message: 'Expense not found'
            });
        }

        const { date, time, category, amount, vendor, description } = req.body;

        // Update fields
        if (date) expense.date = date;
        if (time !== undefined) expense.time = time;
        if (category) expense.category = category;
        if (amount) expense.amount = amount;
        if (vendor !== undefined) expense.vendor = vendor;
        if (description) expense.description = description;

        // Handle new image uploads
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => ({
                url: file.path,
                publicId: file.filename,
                filename: file.originalname
            }));
            expense.images = [...expense.images, ...newImages];
        }

        await expense.save();

        res.status(200).json({
            status: 'success',
            expense
        });
    } catch (error) {
        console.error('Update expense error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating expense'
        });
    }
});

/**
 * @route   DELETE /api/expenses/:id
 * @desc    Delete an expense
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
    try {
        const expense = await Expense.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!expense) {
            return res.status(404).json({
                status: 'error',
                message: 'Expense not found'
            });
        }

        // Delete associated images from Cloudinary
        if (expense.images && expense.images.length > 0) {
            for (const image of expense.images) {
                await deleteImage(image.publicId);
            }
        }

        await expense.deleteOne();

        res.status(200).json({
            status: 'success',
            message: 'Expense deleted successfully'
        });
    } catch (error) {
        console.error('Delete expense error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error deleting expense'
        });
    }
});

/**
 * @route   DELETE /api/expenses/:id/image/:imageId
 * @desc    Delete a specific image from an expense
 * @access  Private
 */
router.delete('/:id/image/:imagePublicId', async (req, res) => {
    try {
        const expense = await Expense.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!expense) {
            return res.status(404).json({
                status: 'error',
                message: 'Expense not found'
            });
        }

        const imagePublicId = req.params.imagePublicId;

        // Find and remove the image
        const imageIndex = expense.images.findIndex(img => img.publicId === imagePublicId);

        if (imageIndex === -1) {
            return res.status(404).json({
                status: 'error',
                message: 'Image not found'
            });
        }

        // Delete from Cloudinary
        await deleteImage(imagePublicId);

        // Remove from expense
        expense.images.splice(imageIndex, 1);
        await expense.save();

        res.status(200).json({
            status: 'success',
            message: 'Image deleted successfully'
        });
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error deleting image'
        });
    }
});

/**
 * @route   GET /api/expenses/stats/summary
 * @desc    Get expense statistics summary
 * @access  Private
 */
router.get('/stats/summary', async (req, res) => {
    try {
        const expenses = await Expense.find({ user: req.user.id });

        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const count = expenses.length;

        // Category breakdown
        const categoryBreakdown = expenses.reduce((acc, expense) => {
            acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
            return acc;
        }, {});

        res.status(200).json({
            status: 'success',
            stats: {
                total,
                count,
                average: count > 0 ? total / count : 0,
                categoryBreakdown
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching statistics'
        });
    }
});

module.exports = router;
