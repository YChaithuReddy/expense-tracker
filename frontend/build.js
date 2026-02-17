/**
 * Build script for Capacitor
 * Copies web files to www folder for native app builds
 */

const fs = require('fs');
const path = require('path');

const sourceDir = __dirname;
const targetDir = path.join(__dirname, 'www');

// Files and folders to copy
const filesToCopy = [
    'index.html',
    'login.html',
    'signup.html',
    'styles.css',
    'styles_images.css',
    'styles_dropdown.css',
    'styles_clear_data.css',
    'styles_saved_images.css',
    'script.js',
    'supabase-client.js',
    'supabase-api.js',
    'supabase-auth.js',
    'google-sheets-service.js',
    'whatsapp-service.js',
    'offline-manager.js',
    'toast.js',
    'progress-modal.js',
    'deep-link-handler.js',
    'upi-import.js',
    'sw.js',
    'manifest.json',
    'favicon.svg'
];

const foldersToCopy = [
    'icons',
    'components'
];

// Files/folders to exclude
const excludePatterns = [
    'node_modules',
    'android',
    'ios',
    'www',
    '.git',
    'package.json',
    'package-lock.json',
    'capacitor.config.ts',
    'build.js',
    'tsconfig.json',
    '*.md',
    '*.backup',
    'test-*.html',
    'verify-*.html',
    'keep-alive.html',
    'generate-icons.html'
];

// Create www folder if it doesn't exist
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log('✅ Created www folder');
}

// Copy a file
function copyFile(src, dest) {
    try {
        fs.copyFileSync(src, dest);
        console.log(`  📄 ${path.basename(src)}`);
    } catch (err) {
        console.warn(`  ⚠️ Could not copy ${path.basename(src)}: ${err.message}`);
    }
}

// Copy a folder recursively
function copyFolder(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`  ⚠️ Folder not found: ${path.basename(src)}`);
        return;
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const files = fs.readdirSync(src);
    files.forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);

        if (fs.statSync(srcPath).isDirectory()) {
            copyFolder(srcPath, destPath);
        } else {
            copyFile(srcPath, destPath);
        }
    });

    console.log(`  📁 ${path.basename(src)}/`);
}

// Clean www folder
function cleanWww() {
    if (fs.existsSync(targetDir)) {
        const files = fs.readdirSync(targetDir);
        files.forEach(file => {
            const filePath = path.join(targetDir, file);
            if (fs.statSync(filePath).isDirectory()) {
                fs.rmSync(filePath, { recursive: true });
            } else {
                fs.unlinkSync(filePath);
            }
        });
    }
}

console.log('🔧 Building for Capacitor...\n');
console.log('Cleaning www folder...');
cleanWww();

console.log('\nCopying files:');
filesToCopy.forEach(file => {
    const src = path.join(sourceDir, file);
    const dest = path.join(targetDir, file);
    if (fs.existsSync(src)) {
        copyFile(src, dest);
    }
});

console.log('\nCopying folders:');
foldersToCopy.forEach(folder => {
    const src = path.join(sourceDir, folder);
    const dest = path.join(targetDir, folder);
    copyFolder(src, dest);
});

console.log('\n✅ Build complete! Files copied to www/');
console.log('   Run "npx cap sync" to sync with native projects.\n');
