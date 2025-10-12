const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const googleSheetsService = require('../services/google-sheets-service');
const User = require('../models/User');

/**
 * @route   POST /api/google-sheets/create
 * @desc    Create a personal Google Sheet for the user
 * @access  Private
 */
router.post('/create', protect, async (req, res) => {
    try {
        // Check if service is ready
        if (!googleSheetsService.isReady()) {
            return res.status(503).json({
                status: 'error',
                message: 'Google Sheets service not configured. Please contact administrator.'
            });
        }

        // Check if user already has a sheet
        if (req.user.googleSheetId) {
            return res.status(400).json({
                status: 'error',
                message: 'User already has a Google Sheet',
                sheetUrl: req.user.googleSheetUrl
            });
        }

        // Create sheet for user
        const result = await googleSheetsService.createSheetForUser(
            req.user.id,
            req.user.email,
            req.user.name
        );

        if (!result.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create Google Sheet',
                error: result.error
            });
        }

        // Update user record with sheet information
        await User.findByIdAndUpdate(req.user.id, {
            googleSheetId: result.sheetId,
            googleSheetUrl: result.sheetUrl,
            googleSheetCreatedAt: new Date()
        });

        res.status(201).json({
            status: 'success',
            message: 'Google Sheet created successfully',
            data: {
                sheetId: result.sheetId,
                sheetUrl: result.sheetUrl,
                sheetName: result.sheetName
            }
        });

    } catch (error) {
        console.error('Create sheet error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while creating sheet',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/google-sheets/export
 * @desc    Export expenses to user's Google Sheet
 * @access  Private
 */
router.post('/export', protect, async (req, res) => {
    try {
        const { expenseIds } = req.body;

        // Validate request
        if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide expense IDs to export'
            });
        }

        // Check if service is ready
        if (!googleSheetsService.isReady()) {
            return res.status(503).json({
                status: 'error',
                message: 'Google Sheets service not configured. Please contact administrator.'
            });
        }

        // Check if user has a sheet
        if (!req.user.googleSheetId) {
            // Auto-create sheet for user
            console.log('User has no sheet, creating one...');
            const createResult = await googleSheetsService.createSheetForUser(
                req.user.id,
                req.user.email,
                req.user.name
            );

            if (!createResult.success) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to create Google Sheet',
                    error: createResult.error
                });
            }

            // Update user record
            await User.findByIdAndUpdate(req.user.id, {
                googleSheetId: createResult.sheetId,
                googleSheetUrl: createResult.sheetUrl,
                googleSheetCreatedAt: new Date()
            });

            req.user.googleSheetId = createResult.sheetId;
            req.user.googleSheetUrl = createResult.sheetUrl;
        }

        // Get expenses from database and sort chronologically (oldest first for Google Sheets)
        const Expense = require('../models/Expense');
        const expenses = await Expense.find({
            _id: { $in: expenseIds },
            user: req.user.id
        }).sort({ date: 1, time: 1 }); // Sort by date ascending, then time ascending (oldest first)

        if (expenses.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'No expenses found with provided IDs'
            });
        }

        // Export to Google Sheets
        const exportResult = await googleSheetsService.exportExpenses(
            req.user.googleSheetId,
            expenses
        );

        if (!exportResult.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to export expenses',
                error: exportResult.error
            });
        }

        res.status(200).json({
            status: 'success',
            message: exportResult.message,
            data: {
                exportedCount: expenses.length,
                startRow: exportResult.startRow,
                endRow: exportResult.endRow,
                sheetUrl: req.user.googleSheetUrl
            }
        });

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while exporting expenses',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/google-sheets/link
 * @desc    Get user's Google Sheet URL
 * @access  Private
 */
router.get('/link', protect, async (req, res) => {
    try {
        if (!req.user.googleSheetId) {
            return res.status(404).json({
                status: 'error',
                message: 'No Google Sheet found for this user'
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                sheetId: req.user.googleSheetId,
                sheetUrl: req.user.googleSheetUrl,
                createdAt: req.user.googleSheetCreatedAt
            }
        });

    } catch (error) {
        console.error('Get link error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while retrieving sheet link',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/google-sheets/verify
 * @desc    Verify user's Google Sheet exists and is accessible
 * @access  Private
 */
router.get('/verify', protect, async (req, res) => {
    try {
        if (!req.user.googleSheetId) {
            return res.status(404).json({
                status: 'error',
                message: 'No Google Sheet found for this user'
            });
        }

        if (!googleSheetsService.isReady()) {
            return res.status(503).json({
                status: 'error',
                message: 'Google Sheets service not configured'
            });
        }

        const verifyResult = await googleSheetsService.verifySheet(req.user.googleSheetId);

        if (!verifyResult.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to verify Google Sheet',
                error: verifyResult.error
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Google Sheet verified successfully',
            data: {
                sheetTitle: verifyResult.sheetTitle,
                sheetUrl: req.user.googleSheetUrl,
                availableTabs: verifyResult.sheets
            }
        });

    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while verifying sheet',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/google-sheets/export-pdf
 * @desc    Export user's Google Sheet as PDF
 * @access  Private
 */
router.get('/export-pdf', protect, async (req, res) => {
    try {
        // Check if user has a sheet
        if (!req.user.googleSheetId) {
            return res.status(404).json({
                status: 'error',
                message: 'No Google Sheet found for this user. Please export expenses first.'
            });
        }

        // Check if service is ready
        if (!googleSheetsService.isReady()) {
            return res.status(503).json({
                status: 'error',
                message: 'Google Sheets service not configured'
            });
        }

        console.log(`📄 User ${req.user.email} requesting PDF export for sheet: ${req.user.googleSheetId}`);

        // Export sheet as PDF via Apps Script
        const pdfResult = await googleSheetsService.exportSheetAsPdf(req.user.googleSheetId);

        if (!pdfResult.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to export PDF',
                error: pdfResult.error
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'PDF exported successfully',
            data: {
                pdfBase64: pdfResult.pdfBase64,
                fileName: pdfResult.fileName,
                size: pdfResult.size
            }
        });

    } catch (error) {
        console.error('PDF export error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while exporting PDF',
            error: error.message
        });
    }
});

module.exports = router;
