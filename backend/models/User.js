const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email'
        ]
    },
    password: {
        type: String,
        required: function() {
            // Password only required for local authentication
            return this.authProvider === 'local';
        },
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't return password by default
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    profilePicture: {
        type: String,
        default: null
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    googleSheetId: {
        type: String,
        default: ''
    },
    googleSheetUrl: {
        type: String,
        default: ''
    },
    googleSheetCreatedAt: {
        type: Date,
        default: null
    },
    whatsappNumber: {
        type: String,
        default: ''
    },
    whatsappNotifications: {
        type: Boolean,
        default: false
    },
    monthlyBudget: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    // Skip password hashing for Google OAuth users
    if (this.authProvider !== 'local' || !this.isModified('password')) {
        return next();
    }

    // Only hash if there's a password to hash
    if (!this.password) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Method to update last login
userSchema.methods.updateLastLogin = async function() {
    this.lastLogin = Date.now();
    await this.save({ validateBeforeSave: false });
};

// Method to get user without password
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    delete user.resetPasswordToken;
    delete user.resetPasswordExpire;
    return user;
};

module.exports = mongoose.model('User', userSchema);
