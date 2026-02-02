/**
 * MongoDB to Supabase Migration Script
 *
 * This script migrates data from MongoDB to Supabase PostgreSQL.
 *
 * Prerequisites:
 * 1. npm install mongoose @supabase/supabase-js
 * 2. Set environment variables:
 *    - MONGODB_URI: Your MongoDB connection string
 *    - SUPABASE_URL: Your Supabase project URL
 *    - SUPABASE_SERVICE_KEY: Your Supabase service role key
 *
 * Usage:
 *   node migrate-data.js
 */

const mongoose = require('mongoose');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Validate environment
if (!MONGODB_URI || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing required environment variables:');
    console.error('  MONGODB_URI:', MONGODB_URI ? '✓' : '✗');
    console.error('  SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
    console.error('  SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
    process.exit(1);
}

// Initialize Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
});

// MongoDB Schemas (simplified for migration)
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    googleId: String,
    authProvider: String,
    profilePicture: String,
    googleSheetId: String,
    googleSheetUrl: String,
    googleSheetCreatedAt: Date,
    whatsappNumber: String,
    whatsappNotifications: Boolean,
    monthlyBudget: Number,
    createdAt: Date,
    updatedAt: Date
}, { collection: 'users' });

const expenseSchema = new mongoose.Schema({
    user: mongoose.Schema.Types.ObjectId,
    date: Date,
    time: String,
    category: String,
    amount: Number,
    vendor: String,
    description: String,
    images: [{
        url: String,
        publicId: String,
        filename: String
    }],
    createdAt: Date,
    updatedAt: Date
}, { collection: 'expenses' });

const orphanedImageSchema = new mongoose.Schema({
    user: mongoose.Schema.Types.ObjectId,
    url: String,
    publicId: String,
    filename: String,
    originalExpenseInfo: {
        date: Date,
        vendor: String,
        amount: Number,
        category: String,
        expenseId: String
    },
    uploadDate: Date,
    expiryDate: Date,
    wasExported: Boolean,
    lastExportedAt: Date,
    sizeInBytes: Number,
    tags: [String],
    retentionPeriodDays: Number,
    preserveIndefinitely: Boolean,
    notes: String
}, { collection: 'orphanedimages' });

const User = mongoose.model('User', userSchema);
const Expense = mongoose.model('Expense', expenseSchema);
const OrphanedImage = mongoose.model('OrphanedImage', orphanedImageSchema);

// Migration state
const userIdMap = new Map(); // MongoDB _id -> Supabase UUID
let stats = {
    users: { total: 0, migrated: 0, failed: 0 },
    expenses: { total: 0, migrated: 0, failed: 0 },
    images: { total: 0, migrated: 0, failed: 0 },
    orphanedImages: { total: 0, migrated: 0, failed: 0 }
};

async function migrateUsers() {
    console.log('\n📦 Migrating users...');

    const users = await User.find({});
    stats.users.total = users.length;

    for (const mongoUser of users) {
        try {
            // Check if user already exists in Supabase by email
            const { data: existingUsers } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', mongoUser.email)
                .limit(1);

            if (existingUsers && existingUsers.length > 0) {
                console.log(`  ⏭️  User ${mongoUser.email} already exists, skipping...`);
                userIdMap.set(mongoUser._id.toString(), existingUsers[0].id);
                stats.users.migrated++;
                continue;
            }

            // Create user in Supabase Auth
            // Note: This creates a user without password (they'll need to reset)
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                email: mongoUser.email,
                email_confirm: true,
                user_metadata: {
                    name: mongoUser.name,
                    full_name: mongoUser.name,
                    avatar_url: mongoUser.profilePicture
                }
            });

            if (authError) {
                console.error(`  ❌ Failed to create auth user ${mongoUser.email}:`, authError.message);
                stats.users.failed++;
                continue;
            }

            // The profile should be auto-created by trigger, but let's update it with full data
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    name: mongoUser.name,
                    profile_picture: mongoUser.profilePicture,
                    google_sheet_id: mongoUser.googleSheetId || '',
                    google_sheet_url: mongoUser.googleSheetUrl || '',
                    google_sheet_created_at: mongoUser.googleSheetCreatedAt,
                    whatsapp_number: mongoUser.whatsappNumber || '',
                    whatsapp_notifications: mongoUser.whatsappNotifications || false,
                    monthly_budget: mongoUser.monthlyBudget || 0
                })
                .eq('id', authUser.user.id);

            if (profileError) {
                console.error(`  ⚠️  Failed to update profile for ${mongoUser.email}:`, profileError.message);
            }

            // Store mapping
            userIdMap.set(mongoUser._id.toString(), authUser.user.id);
            console.log(`  ✅ Migrated user: ${mongoUser.email}`);
            stats.users.migrated++;

        } catch (error) {
            console.error(`  ❌ Error migrating user ${mongoUser.email}:`, error.message);
            stats.users.failed++;
        }
    }
}

async function migrateExpenses() {
    console.log('\n📦 Migrating expenses...');

    const expenses = await Expense.find({});
    stats.expenses.total = expenses.length;

    for (const mongoExpense of expenses) {
        try {
            const supabaseUserId = userIdMap.get(mongoExpense.user.toString());

            if (!supabaseUserId) {
                console.error(`  ⏭️  Skipping expense - user not found: ${mongoExpense.user}`);
                stats.expenses.failed++;
                continue;
            }

            // Insert expense
            const { data: expense, error: expenseError } = await supabase
                .from('expenses')
                .insert({
                    user_id: supabaseUserId,
                    date: mongoExpense.date?.toISOString().split('T')[0],
                    time: mongoExpense.time || null,
                    category: mongoExpense.category,
                    amount: mongoExpense.amount,
                    vendor: mongoExpense.vendor || 'N/A',
                    description: mongoExpense.description,
                    created_at: mongoExpense.createdAt,
                    updated_at: mongoExpense.updatedAt
                })
                .select()
                .single();

            if (expenseError) {
                console.error(`  ❌ Failed to migrate expense:`, expenseError.message);
                stats.expenses.failed++;
                continue;
            }

            // Migrate images for this expense
            if (mongoExpense.images && mongoExpense.images.length > 0) {
                stats.images.total += mongoExpense.images.length;

                for (const image of mongoExpense.images) {
                    try {
                        // Note: Images remain on Cloudinary, we just store references
                        const { error: imageError } = await supabase
                            .from('expense_images')
                            .insert({
                                expense_id: expense.id,
                                user_id: supabaseUserId,
                                storage_path: image.publicId || image.url, // Use publicId as path
                                public_url: image.url,
                                filename: image.filename || 'receipt.jpg'
                            });

                        if (imageError) {
                            console.error(`  ⚠️  Failed to migrate image:`, imageError.message);
                            stats.images.failed++;
                        } else {
                            stats.images.migrated++;
                        }
                    } catch (imgError) {
                        stats.images.failed++;
                    }
                }
            }

            stats.expenses.migrated++;

        } catch (error) {
            console.error(`  ❌ Error migrating expense:`, error.message);
            stats.expenses.failed++;
        }
    }

    console.log(`  ✅ Migrated ${stats.expenses.migrated}/${stats.expenses.total} expenses`);
}

async function migrateOrphanedImages() {
    console.log('\n📦 Migrating orphaned images...');

    const orphanedImages = await OrphanedImage.find({});
    stats.orphanedImages.total = orphanedImages.length;

    for (const mongoImage of orphanedImages) {
        try {
            const supabaseUserId = userIdMap.get(mongoImage.user.toString());

            if (!supabaseUserId) {
                console.error(`  ⏭️  Skipping orphaned image - user not found`);
                stats.orphanedImages.failed++;
                continue;
            }

            const { error } = await supabase
                .from('orphaned_images')
                .insert({
                    user_id: supabaseUserId,
                    storage_path: mongoImage.publicId || mongoImage.url,
                    public_url: mongoImage.url,
                    filename: mongoImage.filename,
                    original_expense_date: mongoImage.originalExpenseInfo?.date,
                    original_vendor: mongoImage.originalExpenseInfo?.vendor,
                    original_amount: mongoImage.originalExpenseInfo?.amount,
                    original_category: mongoImage.originalExpenseInfo?.category,
                    upload_date: mongoImage.uploadDate,
                    expiry_date: mongoImage.expiryDate,
                    was_exported: mongoImage.wasExported || false,
                    last_exported_at: mongoImage.lastExportedAt,
                    size_bytes: mongoImage.sizeInBytes || 0,
                    tags: mongoImage.tags || [],
                    retention_days: mongoImage.retentionPeriodDays || 30,
                    preserve_indefinitely: mongoImage.preserveIndefinitely || false,
                    notes: mongoImage.notes
                });

            if (error) {
                console.error(`  ❌ Failed to migrate orphaned image:`, error.message);
                stats.orphanedImages.failed++;
            } else {
                stats.orphanedImages.migrated++;
            }

        } catch (error) {
            console.error(`  ❌ Error migrating orphaned image:`, error.message);
            stats.orphanedImages.failed++;
        }
    }

    console.log(`  ✅ Migrated ${stats.orphanedImages.migrated}/${stats.orphanedImages.total} orphaned images`);
}

async function printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`\nUsers:`);
    console.log(`  Total: ${stats.users.total}`);
    console.log(`  Migrated: ${stats.users.migrated}`);
    console.log(`  Failed: ${stats.users.failed}`);

    console.log(`\nExpenses:`);
    console.log(`  Total: ${stats.expenses.total}`);
    console.log(`  Migrated: ${stats.expenses.migrated}`);
    console.log(`  Failed: ${stats.expenses.failed}`);

    console.log(`\nExpense Images:`);
    console.log(`  Total: ${stats.images.total}`);
    console.log(`  Migrated: ${stats.images.migrated}`);
    console.log(`  Failed: ${stats.images.failed}`);

    console.log(`\nOrphaned Images:`);
    console.log(`  Total: ${stats.orphanedImages.total}`);
    console.log(`  Migrated: ${stats.orphanedImages.migrated}`);
    console.log(`  Failed: ${stats.orphanedImages.failed}`);

    console.log('\n' + '='.repeat(50));

    const totalItems = stats.users.total + stats.expenses.total + stats.images.total + stats.orphanedImages.total;
    const migratedItems = stats.users.migrated + stats.expenses.migrated + stats.images.migrated + stats.orphanedImages.migrated;
    const successRate = totalItems > 0 ? ((migratedItems / totalItems) * 100).toFixed(1) : 0;

    console.log(`Overall Success Rate: ${successRate}%`);
    console.log('='.repeat(50) + '\n');

    if (stats.users.failed > 0 || stats.expenses.failed > 0) {
        console.log('⚠️  Some items failed to migrate. Check the logs above for details.');
        console.log('   You may need to manually migrate failed items or re-run the script.\n');
    }

    console.log('🎉 Migration complete!\n');
    console.log('Next steps:');
    console.log('1. Users will need to reset their passwords (no passwords were migrated)');
    console.log('2. Verify data in Supabase Dashboard');
    console.log('3. Test the application with migrated data');
    console.log('4. Update your frontend to use the new Supabase API\n');
}

async function main() {
    console.log('🚀 Starting MongoDB to Supabase Migration\n');
    console.log('MongoDB URI:', MONGODB_URI.replace(/\/\/.*:.*@/, '//*****:*****@'));
    console.log('Supabase URL:', SUPABASE_URL);
    console.log('');

    try {
        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Run migrations in order
        await migrateUsers();
        await migrateExpenses();
        await migrateOrphanedImages();

        // Print summary
        await printSummary();

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
    }
}

// Run migration
main();
