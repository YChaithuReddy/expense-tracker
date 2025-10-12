const { body, validationResult } = require('express-validator');

/**
 * Validation middleware to check for errors
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

/**
 * User registration validation rules
 */
const registerValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

    validate
];

/**
 * User login validation rules
 */
const loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required'),

    validate
];

/**
 * Expense validation rules
 */
const expenseValidation = [
    body('date')
        .notEmpty().withMessage('Date is required')
        .isISO8601().withMessage('Date must be a valid date'),

    body('category')
        .notEmpty().withMessage('Category is required')
        .isIn(['Food', 'Cab', 'Bus', 'Metro', 'Auto', 'Fuel', 'Parking', 'Accommodation', 'Entertainment', 'Shopping', 'Healthcare', 'Miscellaneous'])
        .withMessage('Invalid category'),

    body('amount')
        .notEmpty().withMessage('Amount is required')
        .isFloat({ min: 0 }).withMessage('Amount must be a positive number'),

    body('description')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 200 }).withMessage('Description cannot exceed 200 characters'),

    body('vendor')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Vendor name cannot exceed 100 characters'),

    body('time')
        .optional()
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Time must be in HH:MM format'),

    validate
];

module.exports = {
    registerValidation,
    loginValidation,
    expenseValidation,
    validate
};
