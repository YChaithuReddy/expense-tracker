/**
 * UPI Import - Open UPI apps and auto-detect screenshots
 * Supports Google Pay, PhonePe, Paytm, and other UPI apps
 */

(function() {
    'use strict';

    // UPI App package names for Android
    const UPI_APPS = {
        gpay: {
            name: 'Google Pay',
            icon: '💳',
            package: 'com.google.android.apps.nbu.paisa.user',
            color: '#4285F4'
        },
        phonepe: {
            name: 'PhonePe',
            icon: '📱',
            package: 'com.phonepe.app',
            color: '#5f259f'
        },
        paytm: {
            name: 'Paytm',
            icon: '💰',
            package: 'net.one97.paytm',
            color: '#00BAF2'
        },
        amazonpay: {
            name: 'Amazon Pay',
            icon: '🛒',
            package: 'in.amazon.mShop.android.shopping',
            color: '#FF9900'
        },
        bhim: {
            name: 'BHIM',
            icon: '🇮🇳',
            package: 'in.org.npci.upiapp',
            color: '#00796B'
        }
    };

    // Track when user leaves app
    let appLeftTime = null;
    let isWaitingForScreenshot = false;

    // Check if running in Capacitor
    function isCapacitorApp() {
        return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    }

    // Open UPI app
    async function openUPIApp(appKey) {
        const app = UPI_APPS[appKey];
        if (!app) {
            console.error('Unknown UPI app:', appKey);
            return;
        }

        if (!isCapacitorApp()) {
            // On web, show instructions
            showWebInstructions(app);
            return;
        }

        try {
            // Record time when leaving app
            appLeftTime = Date.now();
            isWaitingForScreenshot = true;

            // Try to open the app using Android Intent
            const { App } = window.Capacitor.Plugins;

            // Try opening the app directly
            try {
                await App.openUrl({ url: `intent://#Intent;package=${app.package};end` });
            } catch (e) {
                // Fallback: Try using the app's UPI deep link
                const upiUrl = `upi://`;
                await App.openUrl({ url: upiUrl });
            }

            // Show toast notification
            if (window.toast) {
                window.toast.info('Take a screenshot of your payment, then come back!', 'Opening ' + app.name);
            }

        } catch (error) {
            console.error('Error opening UPI app:', error);

            // App might not be installed
            if (window.toast) {
                window.toast.error(`${app.name} may not be installed on your device`, 'Could not open app');
            }
        }
    }

    // Show instructions for web users
    function showWebInstructions(app) {
        if (window.toast) {
            window.toast.info(
                `Open ${app.name} on your phone, take a screenshot of the payment, then upload it here.`,
                'UPI Import'
            );
        }
    }

    // Handle app resume - check for new screenshots
    async function handleAppResume() {
        if (!isWaitingForScreenshot || !appLeftTime) return;

        // Only check if user was away for at least 3 seconds
        const timeAway = Date.now() - appLeftTime;
        if (timeAway < 3000) return;

        isWaitingForScreenshot = false;

        // Show prompt to scan screenshot
        showScreenshotPrompt();
    }

    // Show prompt to scan screenshot
    function showScreenshotPrompt() {
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'upi-screenshot-modal';
        modal.className = 'upi-screenshot-modal';
        modal.innerHTML = `
            <div class="upi-screenshot-content">
                <div class="upi-screenshot-header">
                    <h3>📱 Did you take a screenshot?</h3>
                    <button class="upi-close-btn" onclick="window.upiImport.closeScreenshotPrompt()">&times;</button>
                </div>
                <div class="upi-screenshot-body">
                    <p>If you took a screenshot of your UPI payment, upload it now to auto-fill the expense details.</p>
                    <div class="upi-screenshot-actions">
                        <button class="btn-primary" onclick="window.upiImport.selectScreenshot()">
                            📷 Select Screenshot
                        </button>
                        <button class="btn-secondary" onclick="window.upiImport.closeScreenshotPrompt()">
                            Skip for now
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add styles if not already present
        addModalStyles();
    }

    // Select screenshot from gallery
    async function selectScreenshot() {
        closeScreenshotPrompt();

        if (isCapacitorApp()) {
            try {
                const { Camera } = window.Capacitor.Plugins;
                const image = await Camera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: 'dataUrl',
                    source: 'photos' // Open gallery
                });

                if (image && image.dataUrl) {
                    processUPIScreenshot(image.dataUrl);
                }
            } catch (error) {
                console.log('Camera cancelled or error:', error);
            }
        } else {
            // Web fallback - trigger file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        processUPIScreenshot(event.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        }
    }

    // Process UPI screenshot with OCR
    async function processUPIScreenshot(imageDataUrl) {
        if (window.toast) {
            window.toast.loading('Scanning UPI payment...', 'Processing');
        }

        try {
            // Use Tesseract OCR
            const result = await Tesseract.recognize(imageDataUrl, 'eng', {
                logger: (m) => console.log('OCR:', m.status, m.progress)
            });

            const text = result.data.text;
            console.log('UPI OCR Text:', text);

            // Parse UPI payment details
            const paymentDetails = parseUPIText(text);

            // Close loading toast
            if (window.toast) {
                window.toast.success('Payment details extracted!', 'Scan Complete');
            }

            // Fill the expense form
            fillExpenseForm(paymentDetails, imageDataUrl);

        } catch (error) {
            console.error('OCR Error:', error);
            if (window.toast) {
                window.toast.error('Could not read payment details. Please enter manually.', 'Scan Failed');
            }
        }
    }

    // Parse UPI payment text
    function parseUPIText(text) {
        const details = {
            amount: null,
            merchant: null,
            date: null,
            upiId: null,
            transactionId: null,
            category: 'Miscellaneous'
        };

        // Normalize text
        const normalizedText = text.replace(/\s+/g, ' ').toLowerCase();

        // Extract amount - various patterns
        const amountPatterns = [
            /(?:₹|rs\.?|inr)\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
            /([0-9,]+(?:\.[0-9]{2})?)\s*(?:₹|rs\.?|inr)/gi,
            /paid\s*(?:₹|rs\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
            /amount[:\s]*(?:₹|rs\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
            /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/g
        ];

        for (const pattern of amountPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const amount = parseFloat(match[1].replace(/,/g, ''));
                if (amount > 0 && amount < 1000000) { // Reasonable amount range
                    details.amount = amount;
                    break;
                }
            }
            if (details.amount) break;
        }

        // Extract merchant/paid to
        const merchantPatterns = [
            /paid\s+to[:\s]*([a-zA-Z0-9\s]+?)(?:\n|upi|$)/i,
            /to[:\s]*([a-zA-Z0-9\s]+?)(?:\n|@|upi|$)/i,
            /merchant[:\s]*([a-zA-Z0-9\s]+?)(?:\n|$)/i,
            /([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s*@[a-zA-Z]+/i
        ];

        for (const pattern of merchantPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                details.merchant = match[1].trim().substring(0, 50);
                break;
            }
        }

        // Extract UPI ID
        const upiMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z]+)/i);
        if (upiMatch) {
            details.upiId = upiMatch[1];
            // Use UPI ID to get merchant name if not found
            if (!details.merchant) {
                details.merchant = upiMatch[1].split('@')[0];
            }
        }

        // Extract date
        const datePatterns = [
            /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
            /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*,?\s*\d{2,4})/i,
            /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s*\d{2,4})/i
        ];

        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                details.date = match[1];
                break;
            }
        }

        // Extract transaction ID
        const txnMatch = text.match(/(?:transaction|txn|ref|utr)[:\s#]*([a-zA-Z0-9]+)/i);
        if (txnMatch) {
            details.transactionId = txnMatch[1];
        }

        // Auto-categorize based on merchant name
        details.category = categorizeByMerchant(details.merchant || '');

        return details;
    }

    // Categorize based on merchant name
    function categorizeByMerchant(merchant) {
        const merchantLower = merchant.toLowerCase();

        const categories = {
            'Meals': ['swiggy', 'zomato', 'food', 'restaurant', 'cafe', 'pizza', 'burger', 'dominos', 'mcdonalds', 'kfc', 'subway', 'starbucks', 'dunkin'],
            'Transportation': ['uber', 'ola', 'rapido', 'auto', 'taxi', 'cab', 'metro', 'bus', 'railway', 'irctc'],
            'Fuel': ['petrol', 'diesel', 'fuel', 'hp', 'indian oil', 'bharat petroleum', 'shell', 'reliance fuel'],
            'Accommodation': ['hotel', 'oyo', 'airbnb', 'makemytrip', 'goibibo', 'booking', 'trivago'],
            'Miscellaneous': ['amazon', 'flipkart', 'myntra', 'ajio', 'shopping', 'mart', 'bazaar', 'store', 'retail']
        };

        for (const [category, keywords] of Object.entries(categories)) {
            for (const keyword of keywords) {
                if (merchantLower.includes(keyword)) {
                    return category;
                }
            }
        }

        return 'Miscellaneous';
    }

    // Fill expense form with extracted details
    function fillExpenseForm(details, imageDataUrl) {
        // Show the expense form section
        const ocrSection = document.getElementById('ocrSection');
        const formSection = document.getElementById('expenseFormSection');

        if (ocrSection) ocrSection.style.display = 'none';
        if (formSection) formSection.style.display = 'block';

        // Fill in the form fields
        if (details.amount) {
            const amountField = document.getElementById('amount');
            if (amountField) amountField.value = details.amount;
        }

        if (details.merchant) {
            const vendorField = document.getElementById('vendor');
            const descField = document.getElementById('description');
            if (vendorField) vendorField.value = details.merchant;
            if (descField) descField.value = `UPI Payment - ${details.merchant}`;
        }

        if (details.date) {
            // Try to parse and set date
            const dateField = document.getElementById('date');
            if (dateField) {
                const parsedDate = parseDate(details.date);
                if (parsedDate) {
                    dateField.value = parsedDate;
                }
            }
        } else {
            // Default to today
            const dateField = document.getElementById('date');
            if (dateField) {
                dateField.value = new Date().toISOString().split('T')[0];
            }
        }

        // Set category
        if (details.category) {
            const categoryField = document.getElementById('mainCategory');
            if (categoryField) {
                categoryField.value = details.category;
                // Trigger change event to update subcategory
                categoryField.dispatchEvent(new Event('change'));
            }
        }

        // Store the image for the expense
        if (imageDataUrl && window.expenseTracker) {
            // Store image data for later use
            window.expenseTracker.pendingUPIImage = imageDataUrl;
        }

        // Scroll to form
        if (formSection) {
            formSection.scrollIntoView({ behavior: 'smooth' });
        }

        if (window.toast) {
            window.toast.success('Review the details and tap "Confirm & Add Expense"', 'Form Filled');
        }
    }

    // Parse various date formats
    function parseDate(dateStr) {
        try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            // Try manual parsing
        }

        // Try DD/MM/YYYY or DD-MM-YYYY
        const ddmmyyyy = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (ddmmyyyy) {
            let [, day, month, year] = ddmmyyyy;
            if (year.length === 2) year = '20' + year;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        return null;
    }

    // Close screenshot prompt
    function closeScreenshotPrompt() {
        const modal = document.getElementById('upi-screenshot-modal');
        if (modal) modal.remove();
    }

    // Add modal styles
    function addModalStyles() {
        if (document.getElementById('upi-import-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'upi-import-styles';
        styles.textContent = `
            .upi-screenshot-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                padding: 20px;
            }

            .upi-screenshot-content {
                background: var(--bg-secondary, #1a1a2e);
                border-radius: 16px;
                max-width: 400px;
                width: 100%;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            }

            .upi-screenshot-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid var(--border-color, #333);
            }

            .upi-screenshot-header h3 {
                margin: 0;
                color: var(--text-primary, #fff);
            }

            .upi-close-btn {
                background: none;
                border: none;
                color: var(--text-secondary, #888);
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            }

            .upi-screenshot-body {
                padding: 20px;
            }

            .upi-screenshot-body p {
                color: var(--text-secondary, #aaa);
                margin-bottom: 20px;
            }

            .upi-screenshot-actions {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .upi-import-section {
                background: var(--bg-secondary, #1a1a2e);
                border-radius: 12px;
                padding: 20px;
                margin-top: 20px;
            }

            .upi-import-title {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 15px;
                color: var(--text-primary, #fff);
            }

            .upi-apps-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                gap: 10px;
            }

            .upi-app-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 15px 10px;
                background: var(--bg-primary, #0f0f23);
                border: 2px solid var(--border-color, #333);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .upi-app-btn:hover {
                border-color: var(--neon-cyan, #14b8a6);
                transform: translateY(-2px);
            }

            .upi-app-btn:active {
                transform: translateY(0);
            }

            .upi-app-icon {
                font-size: 28px;
            }

            .upi-app-name {
                font-size: 11px;
                color: var(--text-secondary, #aaa);
                text-align: center;
            }

            .upi-import-hint {
                margin-top: 15px;
                padding: 12px;
                background: rgba(20, 184, 166, 0.1);
                border-radius: 8px;
                font-size: 12px;
                color: var(--text-secondary, #aaa);
            }

            .upi-import-hint strong {
                color: var(--neon-cyan, #14b8a6);
            }
        `;
        document.head.appendChild(styles);
    }

    // Create UPI import section HTML
    function createUPIImportSection() {
        const section = document.createElement('div');
        section.className = 'upi-import-section';
        section.id = 'upiImportSection';
        section.innerHTML = `
            <div class="upi-import-title">
                <span style="font-size: 24px;">📱</span>
                <h3 style="margin: 0;">Import from UPI App</h3>
            </div>
            <div class="upi-apps-grid">
                <button class="upi-app-btn" onclick="window.upiImport.openUPIApp('gpay')">
                    <span class="upi-app-icon">💳</span>
                    <span class="upi-app-name">Google Pay</span>
                </button>
                <button class="upi-app-btn" onclick="window.upiImport.openUPIApp('phonepe')">
                    <span class="upi-app-icon">📱</span>
                    <span class="upi-app-name">PhonePe</span>
                </button>
                <button class="upi-app-btn" onclick="window.upiImport.openUPIApp('paytm')">
                    <span class="upi-app-icon">💰</span>
                    <span class="upi-app-name">Paytm</span>
                </button>
                <button class="upi-app-btn" onclick="window.upiImport.selectScreenshot()">
                    <span class="upi-app-icon">🖼️</span>
                    <span class="upi-app-name">Upload Screenshot</span>
                </button>
            </div>
            <div class="upi-import-hint">
                <strong>How it works:</strong> Open your UPI app, go to payment history, take a screenshot, then come back here. We'll auto-extract the payment details!
            </div>
        `;
        return section;
    }

    // Initialize UPI Import
    function init() {
        // Add styles
        addModalStyles();

        // Listen for app resume (Capacitor)
        if (isCapacitorApp() && window.Capacitor.Plugins.App) {
            window.Capacitor.Plugins.App.addListener('appStateChange', (state) => {
                if (state.isActive) {
                    handleAppResume();
                }
            });
        }

        // Add visibility change listener for web
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                handleAppResume();
            }
        });

        console.log('UPI Import initialized');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export functions
    window.upiImport = {
        openUPIApp,
        selectScreenshot,
        closeScreenshotPrompt,
        createUPIImportSection,
        processUPIScreenshot
    };

})();
