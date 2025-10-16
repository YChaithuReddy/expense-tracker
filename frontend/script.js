class ExpenseTracker {
    constructor() {
        this.expenses = [];
        this.scannedImages = [];
        this.extractedData = {};
        this.lastSyncedIndex = this.loadLastSyncedIndex(); // Track last synced expense
        this.editingExpenseId = null; // Track which expense is being edited

        // Category subcategory mapping
        this.categorySubcategories = {
            'Transportation': ['Bus', 'Metro', 'Auto', 'Cab (Uber/Rapido)', 'Train', 'Toll'],
            'Accommodation': ['Room/Hotel', 'OYO'],
            'Meals': ['Food', 'Snacks', 'Water/Juice', 'Tea/Coffee', 'Tiffin'],
            'Fuel': ['Petrol', 'Service'],
            'Miscellaneous': ['Tools', 'Stationery', 'Xerox', 'Wiring Material', 'Plumbing Material', 'Work Clothing', 'Porter', 'Dues', 'Fine']
        };

        this.initializeEventListeners();
        this.setTodayDate();

        // Load expenses from backend (async)
        this.loadExpenses();

        // Initialize Google Sheets service to show View My Sheet button if user has a sheet
        this.initializeGoogleSheets();
    }

    initializeEventListeners() {
        // Camera and Gallery buttons
        document.getElementById('cameraBtn').addEventListener('click', () => {
            document.getElementById('cameraInput').click();
        });
        document.getElementById('galleryBtn').addEventListener('click', () => {
            document.getElementById('galleryInput').click();
        });

        // Handle file inputs from camera and gallery
        document.getElementById('cameraInput').addEventListener('change', (e) => {
            // Copy files to main billImages input and trigger the handler
            document.getElementById('billImages').files = e.target.files;
            this.handleImageUpload({ target: document.getElementById('billImages') });
        });
        document.getElementById('galleryInput').addEventListener('change', (e) => {
            // Copy files to main billImages input and trigger the handler
            document.getElementById('billImages').files = e.target.files;
            this.handleImageUpload({ target: document.getElementById('billImages') });
        });

        document.getElementById('billImages').addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('scanBills').addEventListener('click', () => this.scanBills());
        document.getElementById('backToScan').addEventListener('click', () => this.backToScan());
        document.getElementById('expenseForm').addEventListener('submit', (e) => this.handleSubmit(e));
        // Removed generatePDF button event listener - button no longer exists in HTML

        // Clear dropdown menu
        this.initializeClearDropdown();

        // Google Sheets export (simplified - no configuration needed)
        document.getElementById('exportToGoogleSheets').addEventListener('click', () => this.exportToGoogleSheets());

        // Download combined reimbursement package
        document.getElementById('downloadReimbursementPackage').addEventListener('click', () => this.generateCombinedReimbursementPDF());

        // Reset Google Sheet
        document.getElementById('resetGoogleSheet').addEventListener('click', () => this.resetGoogleSheet());

        // View saved images gallery
        document.getElementById('viewSavedImages').addEventListener('click', () => this.openOrphanedImagesModal());

        // Category and subcategory handling
        document.getElementById('mainCategory').addEventListener('change', (e) => this.handleMainCategoryChange(e));
        document.getElementById('subcategory').addEventListener('change', (e) => this.handleSubcategoryChange(e));
        document.getElementById('customCategory').addEventListener('input', (e) => this.handleCustomCategoryInput(e));

        // Initialize Google Sheets service
        if (window.googleSheetsService) {
            window.googleSheetsService.initialize();
        }

        // Select All checkbox
        document.getElementById('selectAllCheckbox').addEventListener('change', (e) => this.handleSelectAll(e));

        // Image modal
        document.querySelector('.close-image').addEventListener('click', () => this.closeImageModal());

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('templateModal')) {
                this.closeTemplateModal();
            }
            if (e.target === document.getElementById('imageModal')) {
                this.closeImageModal();
            }
        });
    }

    setTodayDate() {
        const dateInput = document.getElementById('date');
        if (!dateInput) return;

        // Only set today's date if no date is already set (preserve OCR data)
        const existingDate = dateInput.value || (this.extractedData && this.extractedData.date);
        const dateToUse = existingDate || new Date().toISOString().split('T')[0];

        if (!existingDate) {
            dateInput.value = dateToUse;
            console.log('📅 No existing date, setting today:', dateToUse);
        } else {
            console.log('📅 Preserving existing date:', existingDate);
        }

        // Initialize Flatpickr for modern calendar interface
        if (typeof flatpickr !== 'undefined' && dateInput && !dateInput._flatpickr) {
            flatpickr(dateInput, {
                dateFormat: 'Y-m-d',
                defaultDate: dateToUse,  // Use OCR date if available, otherwise today
                allowInput: true,
                clickOpens: true,
                wrap: false,
                onChange: function(selectedDates, dateStr, instance) {
                    console.log('📅 Date manually selected:', dateStr);
                }
            });
            console.log('✅ Flatpickr initialized with date:', dateToUse);
        }
    }

    handleImageUpload(e) {
        console.log('📸 Image upload triggered');
        const files = Array.from(e.target.files);
        console.log('Files selected:', files.length);

        // Clear previous data to prevent caching issues
        this.scannedImages = [];
        this.extractedData = {};  // Clear any previously extracted data
        console.log('✅ Cleared previous OCR data');

        // Clear form fields to prevent old data from persisting
        const form = document.getElementById('expenseForm');
        if (form) {
            form.reset();
            // Don't set today's date here, let OCR populate it or use it as fallback
        }

        if (files.length === 0) {
            document.getElementById('scanBills').style.display = 'none';
            document.getElementById('imagePreview').innerHTML = '';
            console.log('No files selected, clearing preview');
            return;
        }

        const previewContainer = document.getElementById('imagePreview');
        console.log('Preview container found:', !!previewContainer);

        // Clear and add wrapper div for better layout
        previewContainer.innerHTML = '';
        previewContainer.className = 'image-preview-container has-images';

        const header = document.createElement('h3');
        header.textContent = '📋 Selected Images:';
        previewContainer.appendChild(header);

        const imagesWrapper = document.createElement('div');
        imagesWrapper.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; width: 100%; padding: 10px; margin: 0 auto; justify-items: center;';
        imagesWrapper.id = 'imagesWrapper';
        previewContainer.appendChild(imagesWrapper);
        console.log('Images wrapper created and appended');

        files.forEach((file, index) => {
            console.log(`Processing file ${index + 1}:`, file.name, file.type, file.size);

            // Validate file type
            if (!file.type.startsWith('image/')) {
                console.error('Invalid file type:', file.type);
                alert(`File "${file.name}" is not an image. Please select image files only.`);
                return;
            }

            const reader = new FileReader();

            reader.onerror = (error) => {
                console.error('FileReader error for', file.name, error);
                alert(`Failed to read file: ${file.name}`);
            };

            reader.onload = (e) => {
                console.log(`✅ File ${index + 1} loaded successfully:`, file.name);
                console.log('Data URL length:', e.target.result.substring(0, 50) + '...');

                this.scannedImages.push({
                    name: file.name,
                    data: e.target.result,
                    file: file
                });

                const imageDiv = document.createElement('div');
                imageDiv.className = 'preview-image';
                imageDiv.innerHTML = `
                    <img src="${e.target.result}" alt="${file.name}">
                    <p>${file.name}</p>
                `;

                console.log('Appending image div to wrapper');
                console.log('Images wrapper exists:', !!imagesWrapper);
                console.log('Images wrapper in DOM:', document.getElementById('imagesWrapper') !== null);

                imagesWrapper.appendChild(imageDiv);

                console.log('Image div appended. Wrapper children count:', imagesWrapper.children.length);
                console.log(`Images loaded: ${this.scannedImages.length}/${files.length}`);

                if (this.scannedImages.length === files.length) {
                    const scanBtn = document.getElementById('scanBills');
                    if (scanBtn) {
                        scanBtn.style.display = 'block';
                        console.log('✅ All images loaded, scan button shown');
                    } else {
                        console.error('❌ Scan button not found!');
                    }
                }
            };

            reader.readAsDataURL(file);
        });
    }

    async scanBills() {
        if (this.scannedImages.length === 0) {
            alert('Please select images to scan first!');
            return;
        }

        const scanButton = document.getElementById('scanBills');
        const scanText = document.getElementById('scanText');
        const scanProgress = document.getElementById('scanProgress');
        const progressText = document.getElementById('progressText');

        scanText.style.display = 'none';
        scanProgress.style.display = 'inline';
        scanButton.disabled = true;

        let allExtractedText = '';

        try {
            // Initialize Tesseract worker for better performance
            const worker = await Tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${(m.progress * 100).toFixed(0)}%`);
                    }
                }
            });

            // Configure Tesseract for better accuracy with receipts
            await worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ₹Rs./-:,@&()',
                preserve_interword_spaces: '1',
            });

            for (let i = 0; i < this.scannedImages.length; i++) {
                progressText.textContent = `${Math.round(((i + 1) / this.scannedImages.length) * 100)}%`;

                // Perform OCR with enhanced configuration
                const result = await worker.recognize(this.scannedImages[i].data);

                console.log(`📄 Image ${i + 1} OCR confidence: ${result.data.confidence.toFixed(2)}%`);
                allExtractedText += result.data.text + '\n\n';

                // Also extract with high confidence words only for better accuracy
                const highConfidenceText = result.data.words
                    .filter(word => word.confidence > 60)
                    .map(word => word.text)
                    .join(' ');

                console.log(`✨ High confidence text: ${highConfidenceText}`);
            }

            // Terminate worker to free memory
            await worker.terminate();

            this.extractedData = this.parseReceiptText(allExtractedText);
            this.populateForm();
            this.showExpenseForm();

        } catch (error) {
            console.error('OCR Error:', error);
            alert('Failed to scan bills. Please try again or enter details manually.');
            this.showExpenseForm();
        } finally {
            scanText.style.display = 'inline';
            scanProgress.style.display = 'none';
            scanButton.disabled = false;
        }
    }

    parseReceiptText(text) {
        const data = {
            amount: '',
            vendor: '',
            date: '',
            dateConfidence: 0,  // Confidence score for date extraction (0-1)
            time: '',
            description: '',
            category: 'Miscellaneous'
        };

        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        console.log('OCR Text Lines:', lines); // Debug log

        // Enhanced amount extraction with better Indian currency patterns
        const fullText = text.toLowerCase();

        // Text number mapping for word amounts
        const textNumbers = {
            'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
            'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
            'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
            'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
            'hundred': 100, 'thousand': 1000, 'lakh': 100000, 'lakhs': 100000
        };

        // Priority 1: Context-aware amount patterns (highest priority)
        const contextPatterns = [
            // Total/Grand Total with various formats
            /(?:grand\s*)?total[\s:]*(?:amount)?[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,
            /(?:net|final)\s*(?:amount|total)[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,
            /(?:bill|invoice)\s*(?:amount|total)[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,

            // Amount paid/payable
            /(?:amount\s*)?(?:paid|payable|due)[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,
            /(?:to\s*be\s*)?paid[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,

            // Charges/sum
            /(?:total\s*)?(?:charge|sum)s?[\s:]*(?:rs\.?|₹|inr)?\s*(\d+[,\d]*\.?\d*)/i,
        ];

        // Priority 2: Currency symbol patterns
        const currencyPatterns = [
            // Indian Rupee symbol (₹) - most reliable
            /₹\s*(\d+[,\d]*\.?\d*)/g,
            /(\d+[,\d]*\.?\d*)\s*₹/g,

            // Rs./Rs variants
            /\brs\.?\s*(\d+[,\d]*\.?\d*)/gi,
            /(\d+[,\d]*\.?\d*)\s*rs\.?/gi,

            // INR/Rupees
            /\binr\s*(\d+[,\d]*\.?\d*)/gi,
            /\brupees?\s*(\d+[,\d]*\.?\d*)/gi,
            /(\d+[,\d]*\.?\d*)\s*rupees?/gi,
        ];

        // Priority 3: Word amounts (Rupees Five Hundred Only)
        // Match everything from "rupees" to "only" - use greedy match
        const wordAmountPattern = /rupees?\s+([\sa-z]+)\s*only/gi;

        // Helper function to clean and parse amount
        const cleanAmount = (amountStr) => {
            if (!amountStr) return null;
            // Remove commas (Indian format: 1,00,000)
            let cleaned = amountStr.replace(/,/g, '');
            // Handle both . and , as decimal separator
            cleaned = cleaned.replace(/,(\d{1,2})$/, '.$1');
            const value = parseFloat(cleaned);
            // Validate reasonable range (₹1 to ₹10,00,000)
            if (value > 0 && value <= 1000000) {
                return value;
            }
            return null;
        };

        // Try context patterns first (most accurate)
        for (const pattern of contextPatterns) {
            const match = fullText.match(pattern);
            if (match) {
                const amount = cleanAmount(match[1]);
                if (amount) {
                    data.amount = amount.toString();
                    console.log('✅ Amount found (context):', data.amount, 'Pattern:', pattern.source.substring(0, 30));
                    break;
                }
            }
        }

        // Try currency patterns if context search failed
        if (!data.amount) {
            const foundAmounts = [];

            for (const pattern of currencyPatterns) {
                let match;
                while ((match = pattern.exec(fullText)) !== null) {
                    const amount = cleanAmount(match[1]);
                    if (amount) {
                        foundAmounts.push(amount);
                    }
                }
            }

            // If multiple amounts found, pick the largest (usually the total)
            if (foundAmounts.length > 0) {
                const largestAmount = Math.max(...foundAmounts);
                data.amount = largestAmount.toString();
                console.log('✅ Amount found (currency symbol):', data.amount, `(from ${foundAmounts.length} candidates)`);
            }
        }

        // Try word amounts if still not found (e.g., "Rupees Five Hundred Only")
        if (!data.amount) {
            let match;
            while ((match = wordAmountPattern.exec(fullText)) !== null) {
                const words = match[1].trim().toLowerCase().split(/\s+/);
                let total = 0;
                let currentNumber = 0;

                for (const word of words) {
                    if (textNumbers[word] !== undefined) {
                        const value = textNumbers[word];
                        if (value >= 100) {
                            // Multiplier (hundred, thousand, lakh)
                            if (currentNumber === 0) {
                                // "Hundred" alone = 100
                                currentNumber = value;
                            } else {
                                // "Five Hundred" = 5 * 100
                                currentNumber *= value;
                            }
                            total += currentNumber;
                            currentNumber = 0; // Reset for next number
                        } else {
                            // Regular numbers (one to ninety-nine)
                            currentNumber += value;
                        }
                    }
                }

                // Add any remaining number
                total += currentNumber;

                if (total > 0) {
                    data.amount = total.toString();
                    console.log('✅ Amount found (word):', data.amount, `from "${match[0]}"`);
                    break;
                }
            }
        }

        // Final fallback: Look for any standalone number near bill/payment keywords
        if (!data.amount) {
            for (const line of lines) {
                if (/(?:bill|payment|charge|total)/i.test(line)) {
                    const match = line.match(/(\d+[,\d]*\.?\d*)/);
                    if (match) {
                        const amount = cleanAmount(match[1]);
                        if (amount && amount > 10) { // Minimum ₹10
                            data.amount = amount.toString();
                            console.log('✅ Amount found (fallback):', data.amount);
                            break;
                        }
                    }
                }
            }
        }

        // Enhanced vendor extraction with smart filtering
        const vendorCandidates = [];
        const skipKeywords = /^(amount|to|from|paid|payment|paytm|phonepe|gpay|googlepay|upi|bank|ref|reference|date|time|bill|invoice|receipt|thank|thanks|total|subtotal|tax|gst|cgst|sgst|igst|cashier|customer)/i;
        const businessKeywords = /(limited|ltd|pvt|private|corp|corporation|company|inc|llp|station|store|stores|mart|shop|restaurant|hotel|cafe|petrol|pump|mall|center|centre)/i;

        for (let i = 0; i < Math.min(lines.length, 15); i++) { // Check first 15 lines
            const line = lines[i];

            // Skip lines with these characteristics
            if (
                skipKeywords.test(line) ||           // Skip common header/footer words
                /₹|\d{4,}/.test(line) ||             // Skip lines with amounts or long numbers
                line.length < 3 ||                    // Too short
                line.length > 60 ||                   // Too long
                /^\d+$/.test(line) ||                 // Just numbers
                /^[^a-zA-Z]+$/.test(line) ||         // No letters
                /transaction|order\s*id|ref/i.test(line) // Transaction details
            ) {
                continue;
            }

            // Calculate vendor confidence score
            let confidence = 0;

            // Bonus for business keywords
            if (businessKeywords.test(line)) {
                confidence += 50;
            }

            // Bonus for proper capitalization (Title Case)
            if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(line)) {
                confidence += 20;
            }

            // Bonus for ALL CAPS (common for business names)
            if (line === line.toUpperCase() && /[A-Z]/.test(line)) {
                confidence += 15;
            }

            // Bonus for reasonable length
            if (line.length >= 5 && line.length <= 40) {
                confidence += 10;
            }

            // Penalty for multiple special characters
            if ((line.match(/[^a-zA-Z0-9\s]/g) || []).length > 2) {
                confidence -= 10;
            }

            // Penalty for lines appearing later (vendor usually at top)
            confidence -= i * 2;

            if (confidence > 0) {
                vendorCandidates.push({ name: line, confidence, position: i });
            }
        }

        // Pick the vendor with highest confidence
        if (vendorCandidates.length > 0) {
            vendorCandidates.sort((a, b) => b.confidence - a.confidence);
            data.vendor = vendorCandidates[0].name.substring(0, 50).trim();
            console.log('✅ Vendor found:', data.vendor, `(confidence: ${vendorCandidates[0].confidence})`);
            console.log('   Other candidates:', vendorCandidates.slice(1, 3).map(v => `${v.name} (${v.confidence})`));
        }

        // Comprehensive date extraction supporting multiple formats
        const datePatterns = [
            // Month name formats (long and short)
            { regex: /(\d{1,2})\s+([a-z]+)\s+(\d{2,4})/i, type: 'DMY_NAME' }, // "04 September 2025", "11 Aug 23"
            { regex: /([a-z]+)\s+(\d{1,2})[,\s]+(\d{2,4})/i, type: 'MDY_NAME' }, // "September 04, 2025"

            // Numeric formats with separators
            { regex: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/, type: 'DMY_NUMERIC' }, // "04/09/2025", "04-09-2025", "04.09.2025"
            { regex: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})(?!\d)/, type: 'DMY_2DIGIT' }, // "04/09/25"
            { regex: /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/, type: 'YMD_NUMERIC' }, // "2025/09/04", "2025-09-04"

            // ISO and concatenated formats
            { regex: /(\d{4})(\d{2})(\d{2})(?!T|\d)/, type: 'YMD_CONCAT' }, // "20250904"
            { regex: /(\d{4})-(\d{2})-(\d{2})T/, type: 'ISO_DATETIME' }, // "2025-09-04T18:21:30"

            // Context-aware patterns (with keywords)
            { regex: /(?:paid|date|on|at).*?(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i, type: 'DMY_CONTEXT' },
            { regex: /(?:paid|date|on|at).*?(\d{1,2})\s+([a-z]+)\s+(\d{2,4})/i, type: 'DMY_NAME_CONTEXT' }
        ];

        const monthNames = {
            jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
            apr: 3, april: 3, may: 4, jun: 5, june: 5,
            jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
            oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
        };

        // Collect all date candidates with scores
        const dateCandidates = [];

        for (const line of lines) {
            for (const { regex, type } of datePatterns) {
                const dateMatch = line.match(regex);
                if (dateMatch) {
                    try {
                        let day, month, year;

                        switch(type) {
                            case 'DMY_NAME':
                            case 'DMY_NAME_CONTEXT':
                                day = parseInt(dateMatch[1]);
                                month = monthNames[dateMatch[2].toLowerCase()];
                                year = parseInt(dateMatch[3]);
                                console.log(`   🔍 DMY_NAME parsing: day=${day}, month=${dateMatch[2].toLowerCase()}→${month}, year=${year}`);
                                break;

                            case 'MDY_NAME':
                                month = monthNames[dateMatch[1].toLowerCase()];
                                day = parseInt(dateMatch[2]);
                                year = parseInt(dateMatch[3]);
                                break;

                            case 'DMY_NUMERIC':
                            case 'DMY_CONTEXT':
                                day = parseInt(dateMatch[1]);
                                month = parseInt(dateMatch[2]) - 1; // 0-indexed
                                year = parseInt(dateMatch[3]);
                                break;

                            case 'DMY_2DIGIT':
                                day = parseInt(dateMatch[1]);
                                month = parseInt(dateMatch[2]) - 1;
                                year = 2000 + parseInt(dateMatch[3]);
                                break;

                            case 'YMD_NUMERIC':
                            case 'ISO_DATETIME':
                                year = parseInt(dateMatch[1]);
                                month = parseInt(dateMatch[2]) - 1;
                                day = parseInt(dateMatch[3]);
                                break;

                            case 'YMD_CONCAT':
                                year = parseInt(dateMatch[1]);
                                month = parseInt(dateMatch[2]) - 1;
                                day = parseInt(dateMatch[3]);
                                break;
                        }

                        // Handle 2-digit years
                        if (year < 100) year += 2000;

                        // Validate and create date
                        if (month !== undefined && !isNaN(month) && month >= 0 && month < 12 &&
                            day && day >= 1 && day <= 31 && year >= 2000 && year <= 2099) {
                            const date = new Date(year, month, day);
                            if (!isNaN(date.getTime()) && date.getDate() === day) {
                                const dateStr = date.toISOString().split('T')[0];

                                // Calculate confidence score based on pattern type and context
                                let confidence = 0.5; // Base confidence

                                // Higher confidence for specific patterns
                                if (type === 'DMY_NAME' || type === 'MDY_NAME') {
                                    confidence = 0.9; // Month names are very reliable
                                } else if (type === 'ISO_DATETIME' || type === 'YMD_NUMERIC') {
                                    confidence = 0.85; // ISO format is reliable
                                } else if (type === 'DMY_CONTEXT' || type === 'DMY_NAME_CONTEXT') {
                                    confidence = 0.95; // Context-aware patterns are MOST reliable
                                } else if (type === 'DMY_NUMERIC') {
                                    confidence = 0.7; // Standard numeric format
                                } else if (type === 'DMY_2DIGIT') {
                                    confidence = 0.6; // 2-digit years less reliable
                                }

                                // Check for date keywords nearby (increases confidence)
                                const lowerLine = line.toLowerCase();
                                const highPriorityKeywords = ['paid at', 'payment date', 'transaction date', 'paid on'];
                                const mediumPriorityKeywords = ['invoice date', 'bill date', 'date of issue', 'dated', 'date:'];

                                if (highPriorityKeywords.some(keyword => lowerLine.includes(keyword))) {
                                    confidence = Math.min(confidence + 0.15, 1.0); // High boost for payment dates
                                } else if (mediumPriorityKeywords.some(keyword => lowerLine.includes(keyword))) {
                                    confidence = Math.min(confidence + 0.1, 1.0);
                                }

                                // Check if date is reasonable (not too far in past or future)
                                const today = new Date();
                                const daysDiff = Math.abs((date - today) / (1000 * 60 * 60 * 24));
                                if (daysDiff < 30) {
                                    confidence = Math.min(confidence + 0.05, 1.0); // Recent date
                                } else if (daysDiff > 365) {
                                    confidence = Math.max(confidence - 0.15, 0.3); // Old or future date
                                }

                                // Add to candidates
                                dateCandidates.push({
                                    date: dateStr,
                                    confidence: confidence,
                                    type: type,
                                    line: line,
                                    matchedText: dateMatch[0]
                                });
                            }
                        }
                    } catch (e) {
                        console.log('Date parsing error:', e);
                    }
                }
            }
        }

        // Pick the date with highest confidence
        if (dateCandidates.length > 0) {
            // Debug: Show all candidates
            console.log(`🔍 Found ${dateCandidates.length} date candidates:`);
            dateCandidates.forEach((d, i) => {
                console.log(`   ${i+1}. ${d.date} (${(d.confidence * 100).toFixed(0)}% confidence) - Pattern: ${d.type}`);
                console.log(`      Matched text: "${d.matchedText}" from line: "${d.line.substring(0, 80)}"`);
            });

            dateCandidates.sort((a, b) => b.confidence - a.confidence);
            const bestMatch = dateCandidates[0];
            data.date = bestMatch.date;
            data.dateConfidence = bestMatch.confidence;
            console.log(`✅ Selected best match: ${data.date} (pattern: ${bestMatch.type}, confidence: ${(bestMatch.confidence * 100).toFixed(0)}%)`);
        }

        // Comprehensive time extraction supporting multiple formats
        const timePatterns = [
            // 12-hour formats with AM/PM
            { regex: /(?:paid|payment|transaction|time|at|on)\s*(?:at|@)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)/i, type: '12H_CONTEXT' }, // "Paid at 06:21:30 PM"
            { regex: /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)/i, type: '12H_AMPM' }, // "6:21 PM", "06:21:30 PM"

            // 24-hour formats with colons
            { regex: /T(\d{2}):(\d{2}):(\d{2})/, type: '24H_ISO' }, // "T18:21:30" (ISO format)
            { regex: /(?:^|\s)(\d{2}):(\d{2}):(\d{2})(?:\s|$)/, type: '24H_FULL' }, // "18:21:30"
            { regex: /(?:^|\s)(\d{2}):(\d{2})(?:\s|$|,)/, type: '24H_SHORT' }, // "18:21"
            { regex: /(\d{1,2}):(\d{2})(?:\s|$|,)/, type: '24H_FLEX' }, // "6:21" (flexible, could be 12h or 24h)

            // Basic format without colons
            { regex: /(?:^|\s)(\d{2})(\d{2})(?:\s|$)/, type: '24H_BASIC' }, // "1821" (no colons)

            // Context-aware patterns
            { regex: /(?:time|at|on)\s*[:\-]?\s*(\d{1,2}):(\d{2})/i, type: 'TIME_CONTEXT' } // "Time: 18:21"
        ];

        for (const line of lines) {
            for (const { regex, type } of timePatterns) {
                const timeMatch = line.match(regex);
                if (timeMatch) {
                    try {
                        let hours = parseInt(timeMatch[1]);
                        let minutes = parseInt(timeMatch[2]);
                        const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
                        const period = timeMatch[4] ? timeMatch[4].toLowerCase() : null;

                        // Handle 12-hour format with AM/PM
                        if (period) {
                            if (period === 'pm' && hours !== 12) {
                                hours += 12;
                            } else if (period === 'am' && hours === 12) {
                                hours = 0;
                            }
                        }

                        // For 24H_BASIC format (e.g., "1821")
                        if (type === '24H_BASIC') {
                            // timeMatch[1] is HH, timeMatch[2] is MM
                            minutes = parseInt(timeMatch[2]);
                        }

                        // Validate time components
                        if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60) {
                            // Store as HH:MM format for sorting
                            data.time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                            console.log(`✅ Time found: ${data.time} (matched pattern: ${type})`);
                            break;
                        }
                    } catch (e) {
                        console.log('Time parsing error:', e);
                    }
                }
            }
            if (data.time) break;
        }

        // Enhanced category detection with confidence scoring
        const textLower = text.toLowerCase();
        const categoryScores = {
            'Fuel': 0,
            'Transportation': 0,
            'Accommodation': 0,
            'Meals': 0,
            'Office Supplies': 0,
            'Communication': 0,
            'Entertainment': 0,
            'Medical': 0,
            'Parking': 0,
            'Miscellaneous': 0
        };

        // Fuel keywords (weight: 10 each)
        const fuelKeywords = ['fuel', 'petrol', 'diesel', 'gas', 'petroleum', 'hp', 'iocl', 'bpcl', 'shell', 'essar', 'reliance petroleum', 'nayara'];
        fuelKeywords.forEach(kw => {
            if (textLower.includes(kw)) categoryScores['Fuel'] += 10;
        });

        // Transportation keywords
        const transportKeywords = ['uber', 'ola', 'taxi', 'cab', 'transport', 'bus', 'train', 'metro', 'railway', 'auto', 'rickshaw', 'rapido', 'toll'];
        transportKeywords.forEach(kw => {
            if (textLower.includes(kw)) categoryScores['Transportation'] += 10;
        });

        // Accommodation keywords
        const accommKeywords = ['hotel', 'accommodation', 'lodge', 'resort', 'guest house', 'inn', 'motel', 'hostel', 'airbnb', 'oyo'];
        accommKeywords.forEach(kw => {
            if (textLower.includes(kw)) categoryScores['Accommodation'] += 10;
        });

        // Meals keywords
        const mealsKeywords = ['restaurant', 'food', 'cafe', 'coffee', 'meal', 'dinner', 'lunch', 'breakfast', 'zomato', 'swiggy', 'dominos', 'mcdonald', 'kfc', 'pizza', 'burger'];
        mealsKeywords.forEach(kw => {
            if (textLower.includes(kw)) categoryScores['Meals'] += 10;
        });

        // Office Supplies keywords
        const officeKeywords = ['stationery', 'office', 'supplies', 'paper', 'pen', 'printer', 'toner', 'cartridge'];
        officeKeywords.forEach(kw => {
            if (textLower.includes(kw)) categoryScores['Office Supplies'] += 10;
        });

        // Communication keywords
        const commKeywords = ['mobile', 'phone', 'internet', 'broadband', 'recharge', 'data', 'airtel', 'jio', 'vodafone', 'vi'];
        commKeywords.forEach(kw => {
            if (textLower.includes(kw)) categoryScores['Communication'] += 10;
        });

        // Entertainment keywords
        const entertainKeywords = ['movie', 'cinema', 'theatre', 'entertainment', 'ticket', 'show', 'pvr', 'inox'];
        entertainKeywords.forEach(kw => {
            if (textLower.includes(kw)) categoryScores['Entertainment'] += 10;
        });

        // Medical keywords
        const medicalKeywords = ['medical', 'hospital', 'pharmacy', 'medicine', 'doctor', 'clinic', 'apollo', 'medplus'];
        medicalKeywords.forEach(kw => {
            if (textLower.includes(kw)) categoryScores['Medical'] += 10;
        });

        // Parking keywords
        const parkingKeywords = ['parking', 'park', 'valet'];
        parkingKeywords.forEach(kw => {
            if (textLower.includes(kw)) categoryScores['Parking'] += 10;
        });

        // Find category with highest score
        let maxScore = 0;
        let detectedCategory = 'Miscellaneous';
        for (const [category, score] of Object.entries(categoryScores)) {
            if (score > maxScore) {
                maxScore = score;
                detectedCategory = category;
            }
        }

        if (maxScore > 0) {
            data.category = detectedCategory;
            console.log(`✅ Category detected: ${data.category} (confidence score: ${maxScore})`);
        } else {
            data.category = 'Miscellaneous';
            console.log('⚠️ Category: Miscellaneous (no keywords matched)');
        }

        // Generate description (simplified - only use category)
        if (data.amount) {
            data.description = `${data.category} - ₹${data.amount}`;
        } else {
            data.description = `${data.category} expense`;
        }

        // Calculate extraction quality score
        let extractionScore = 0;
        const qualityMaxScore = 100;
        const weights = {
            amount: 40,    // Most important
            vendor: 20,
            date: 20,
            category: 10,
            time: 10
        };

        if (data.amount) extractionScore += weights.amount;
        if (data.vendor) extractionScore += weights.vendor;
        if (data.date) extractionScore += weights.date;
        if (data.category && data.category !== 'Miscellaneous') extractionScore += weights.category;
        if (data.time) extractionScore += weights.time;

        // Determine quality level
        let qualityLevel = '';
        let qualityIcon = '';
        if (extractionScore >= 80) {
            qualityLevel = 'Excellent';
            qualityIcon = '🌟';
        } else if (extractionScore >= 60) {
            qualityLevel = 'Good';
            qualityIcon = '✅';
        } else if (extractionScore >= 40) {
            qualityLevel = 'Fair';
            qualityIcon = '⚠️';
        } else {
            qualityLevel = 'Poor';
            qualityIcon = '❌';
        }

        console.log('✅ Parsed OCR data:', data);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 EXTRACTION QUALITY SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`${qualityIcon} Overall Quality: ${qualityLevel} (${extractionScore}/${qualityMaxScore})`);
        console.log('');
        console.log('Field Detection Results:');
        console.log(`  💰 Amount:   ${data.amount ? '✅ ' + data.amount : '❌ NOT FOUND'}`);
        console.log(`  🏪 Vendor:   ${data.vendor ? '✅ ' + data.vendor : '⚠️  Not extracted (will enter manually)'}`);
        console.log(`  📅 Date:     ${data.date ? '✅ ' + data.date : '❌ NOT FOUND'}`);
        console.log(`  ⏰ Time:     ${data.time ? '✅ ' + data.time : '⚠️  Not found (optional)'}`);
        console.log(`  📂 Category: ${data.category ? '✅ ' + data.category : '❌ NOT FOUND'}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Add quality metadata to data
        data._quality = {
            score: extractionScore,
            level: qualityLevel,
            fieldsFound: Object.keys(data).filter(k => !k.startsWith('_') && data[k] && k !== 'description').length
        };

        return data;
    }

    addDateConfidenceWarning(element, confidence) {
        // Remove any existing warning
        const existingWarning = element.parentNode.querySelector('.date-confidence-warning');
        if (existingWarning) {
            existingWarning.remove();
        }

        // Create warning indicator
        const warningSpan = document.createElement('span');
        warningSpan.className = 'date-confidence-warning';
        warningSpan.innerHTML = `⚠️ <small style="color: orange;">Date confidence: ${(confidence * 100).toFixed(0)}% - Please verify</small>`;
        warningSpan.style.cssText = `
            display: inline-block;
            margin-left: 10px;
            font-size: 0.85rem;
            animation: pulse 2s infinite;
        `;

        // Add CSS animation if not already present
        if (!document.querySelector('#confidence-warning-styles')) {
            const style = document.createElement('style');
            style.id = 'confidence-warning-styles';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
            `;
            document.head.appendChild(style);
        }

        // Insert warning after the date input
        element.parentNode.appendChild(warningSpan);
        console.log(`⚠️ Added date confidence warning (${(confidence * 100).toFixed(0)}%)`);
    }

    populateForm() {
        console.log('📝 Populating form with extracted data:', this.extractedData);

        // ONLY fill fields that have extracted data - leave others empty
        const fieldsToFill = [
            { id: 'date', value: this.extractedData.date },
            { id: 'category', value: this.extractedData.category },
            { id: 'description', value: this.extractedData.description },
            { id: 'amount', value: this.extractedData.amount }
        ];

        // Fill ONLY fields with valid extracted data, leave others empty
        fieldsToFill.forEach(field => {
            const element = document.getElementById(field.id);
            if (!element) {
                console.error(`❌ Element not found: ${field.id}`);
                return;
            }

            if (field.value && field.value.trim() !== '') {
                element.value = field.value;
                console.log(`✅ Filled ${field.id}: ${field.value}`);

                // Special handling for date field with Flatpickr
                if (field.id === 'date') {
                    if (element._flatpickr) {
                        // Update Flatpickr instance to show the OCR-detected date
                        element._flatpickr.setDate(field.value, true);
                        console.log(`✅ Updated Flatpickr calendar with OCR date: ${field.value}`);
                    }

                    // Add confidence indicator if date confidence is low
                    if (this.extractedData.dateConfidence && this.extractedData.dateConfidence < 0.7) {
                        this.addDateConfidenceWarning(element, this.extractedData.dateConfidence);
                    }
                }
            } else {
                // For date field, if no OCR date detected, set today's date
                if (field.id === 'date') {
                    const today = new Date().toISOString().split('T')[0];
                    element.value = today;
                    if (element._flatpickr) {
                        element._flatpickr.setDate(today, true);
                    }
                    console.log(`⚠️ No date detected, using today: ${today}`);
                } else {
                    element.value = ''; // Leave empty for manual entry
                    console.log(`⚠️ ${field.id} is empty`);
                }
            }
            // Ensure field is always editable and interactive
            element.removeAttribute('readonly');
            element.removeAttribute('disabled');
        });

        // Vendor field - always leave empty for manual entry (user preference)
        const vendorElement = document.getElementById('vendor');
        if (vendorElement) {
            vendorElement.value = '';
            vendorElement.removeAttribute('readonly');
            vendorElement.removeAttribute('disabled');
            console.log('⚠️  vendor field left empty (user will enter manually)');
        }

        // Set the receipt images
        const receiptInput = document.getElementById('receipt');
        if (receiptInput && this.scannedImages.length > 0) {
            const dt = new DataTransfer();
            this.scannedImages.forEach(img => {
                dt.items.add(img.file);
            });
            receiptInput.files = dt.files;
            console.log(`✅ Set ${this.scannedImages.length} receipt images`);
        }
    }

    showExpenseForm() {
        document.getElementById('ocrSection').style.display = 'none';
        document.getElementById('expenseFormSection').style.display = 'block';

        // Show notification about extracted data
        const extractedFields = Object.keys(this.extractedData).filter(key => this.extractedData[key] && key !== 'category');

        if (extractedFields.length > 0) {
            this.showNotification(`✅ Bill scanned! Auto-filled: ${extractedFields.join(', ')}. Please review below.`);
        } else {
            this.showNotification('⚠️ Could not extract data automatically. Please fill in the details manually.');
        }

        // Add extracted data box to form
        const debugInfo = document.createElement('div');
        debugInfo.className = 'extracted-data-box';
        debugInfo.style.cssText = `
            background: rgba(0, 212, 255, 0.08);
            border: 1px solid rgba(0, 212, 255, 0.3);
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 20px;
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.8;
        `;

        // Build list of extracted fields - only show what was found (excluding vendor)
        const extractedFieldsList = [];
        if (this.extractedData.amount) extractedFieldsList.push(`Amount: ₹${this.extractedData.amount}`);
        // Vendor is intentionally excluded - user will enter manually
        if (this.extractedData.date) extractedFieldsList.push(`Date: ${this.extractedData.date}`);
        if (this.extractedData.category) extractedFieldsList.push(`Category: ${this.extractedData.category}`);

        if (extractedFieldsList.length > 0) {
            debugInfo.innerHTML = `
                <strong style="color: var(--neon-cyan);">🔍 Extracted Data:</strong><br>
                ${extractedFieldsList.join('<br>')}
                <br><br>
                <small style="opacity: 0.7;">ℹ️ Empty fields were not found - fill them manually</small>
            `;
        } else {
            debugInfo.innerHTML = `
                <strong style="color: var(--neon-pink);">⚠️ Could not extract data</strong><br>
                <small>Please fill in all fields manually</small>
            `;
        }

        const form = document.getElementById('expenseForm');
        form.insertBefore(debugInfo, form.firstChild);
    }

    backToScan() {
        document.getElementById('expenseFormSection').style.display = 'none';
        document.getElementById('ocrSection').style.display = 'block';

        // Reset form
        document.getElementById('expenseForm').reset();
        this.setTodayDate();

        // Reset editing mode
        this.editingExpenseId = null;

        // Reset submit button text
        const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
        submitBtn.textContent = '✅ Confirm & Add Expense';

        // Remove extracted data box if it exists
        const existingDebug = document.querySelector('.extracted-data-box');
        if (existingDebug) {
            existingDebug.remove();
        }

        // Clear scanned data
        this.scannedImages = [];
        this.extractedData = {};
        document.getElementById('billImages').value = '';
        document.getElementById('imagePreview').innerHTML = '';
        document.getElementById('scanBills').style.display = 'none';
    }

    handleSubmit(e) {
        e.preventDefault();
        console.log('Form submitted'); // Debug log

        const formData = new FormData(e.target);
        const files = document.getElementById('receipt').files;

        // Validate required fields
        const amount = formData.get('amount');
        const date = formData.get('date');
        const category = formData.get('category');
        const description = formData.get('description');

        if (!amount || !date || !category || !description) {
            alert('Please fill in all required fields');
            return;
        }

        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        // Check if we're editing an existing expense
        if (this.editingExpenseId !== null) {
            const expenseIndex = this.expenses.findIndex(exp => exp.id === this.editingExpenseId);
            if (expenseIndex !== -1) {
                // Update existing expense
                const existingImages = this.expenses[expenseIndex].images || [];
                const existingTime = this.expenses[expenseIndex].time || '';
                const expense = {
                    id: this.editingExpenseId,
                    date: date,
                    category: category,
                    description: description,
                    amount: parseFloat(amount),
                    vendor: formData.get('vendor') || 'N/A',
                    time: this.extractedData.time || existingTime, // Keep existing time if not re-scanned
                    images: files.length > 0 ? [] : existingImages // Keep old images if no new ones uploaded
                };

                if (files.length > 0) {
                    this.processImages(files, expense, true);
                } else {
                    this.updateExpense(expense);
                    this.backToScan();
                }
            }
        } else {
            // Create new expense
            const expense = {
                id: Date.now(),
                date: date,
                category: category,
                description: description,
                amount: parseFloat(amount),
                vendor: formData.get('vendor') || 'N/A',
                time: this.extractedData.time || '', // Store time from OCR
                images: []
            };

            console.log('Creating expense:', expense); // Debug log

            if (files.length > 0) {
                this.processImages(files, expense, false);
            } else {
                this.addExpense(expense);
                this.backToScan();
            }
        }
    }

    processImages(files, expense, isEdit = false) {
        let processedCount = 0;
        console.log('Processing images:', files.length); // Debug log

        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                expense.images.push({
                    name: file.name,
                    data: e.target.result
                });
                processedCount++;

                console.log(`Processed image ${processedCount}/${files.length}`); // Debug log

                if (processedCount === files.length) {
                    if (isEdit) {
                        this.updateExpense(expense);
                    } else {
                        this.addExpense(expense);
                    }
                    this.backToScan();
                }
            };
            reader.readAsDataURL(file);
        });
    }

    async addExpense(expense) {
        try {
            console.log('Adding expense to backend:', expense);

            // Prepare expense data for backend
            const expenseData = {
                date: expense.date,
                time: expense.time,
                category: expense.category,
                amount: expense.amount,
                vendor: expense.vendor,
                description: expense.description
            };

            // Prepare images as File objects (if they exist)
            const imageFiles = [];
            if (expense.images && expense.images.length > 0) {
                // Convert base64 images to File objects
                for (const img of expense.images) {
                    const blob = await fetch(img.data).then(r => r.blob());
                    const file = new File([blob], img.name, { type: blob.type });
                    imageFiles.push(file);
                }
            }

            // Call backend API
            const response = await api.createExpense(expenseData, imageFiles);

            if (response.status === 'success') {
                console.log('✅ Expense added to backend successfully');

                // Reload expenses from backend to stay in sync
                await this.loadExpenses();

                this.resetForm();
                this.showNotification('✅ Expense added successfully!');
            } else {
                throw new Error(response.message || 'Failed to add expense');
            }
        } catch (error) {
            console.error('Error adding expense:', error);
            this.showNotification('❌ Failed to add expense: ' + error.message);
        }
    }

    sortExpensesByDate() {
        // Sort expenses by date and time in ascending order (oldest first)
        this.expenses.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);

            // First sort by date
            const dateDiff = dateA - dateB;

            // If dates are the same, sort by time
            if (dateDiff === 0) {
                const timeA = a.time || '00:00'; // Default to midnight if no time
                const timeB = b.time || '00:00';

                // Compare times as strings (HH:MM format works for string comparison)
                if (timeA < timeB) return -1;
                if (timeA > timeB) return 1;
                return 0;
            }

            return dateDiff;
        });
    }

    async deleteExpense(id) {
        if (confirm('Are you sure you want to delete this expense?')) {
            try {
                console.log('Deleting expense:', id);
                const response = await api.deleteExpense(id);

                if (response.status === 'success') {
                    console.log('✅ Expense deleted from backend');

                    // Reload expenses from backend to stay in sync
                    await this.loadExpenses();

                    this.showNotification('✅ Expense deleted successfully!');
                } else {
                    throw new Error(response.message || 'Failed to delete expense');
                }
            } catch (error) {
                console.error('Error deleting expense:', error);
                this.showNotification('❌ Failed to delete expense: ' + error.message);
            }
        }
    }

    editExpense(id) {
        const expense = this.expenses.find(exp => exp.id === id);
        if (!expense) {
            alert('Expense not found!');
            return;
        }

        // Set editing mode
        this.editingExpenseId = id;

        // Show the form section
        document.getElementById('ocrSection').style.display = 'none';
        document.getElementById('expenseFormSection').style.display = 'block';

        // Populate form with expense data
        document.getElementById('date').value = expense.date;
        document.getElementById('category').value = expense.category;
        document.getElementById('description').value = expense.description;
        document.getElementById('amount').value = expense.amount;
        document.getElementById('vendor').value = expense.vendor;

        // Update submit button text
        const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
        submitBtn.textContent = '💾 Update Expense';

        // Show notification
        this.showNotification('✏️ Editing expense. Make your changes and click Update.');

        // Scroll to form
        document.getElementById('expenseFormSection').scrollIntoView({ behavior: 'smooth' });
    }

    async updateExpense(updatedExpense) {
        try {
            console.log('Updating expense in backend:', updatedExpense);

            // Prepare expense data for backend
            const expenseData = {
                date: updatedExpense.date,
                time: updatedExpense.time,
                category: updatedExpense.category,
                amount: updatedExpense.amount,
                vendor: updatedExpense.vendor,
                description: updatedExpense.description
            };

            // Prepare images as File objects (if they exist and are new)
            const imageFiles = [];
            if (updatedExpense.images && updatedExpense.images.length > 0) {
                // Check if images are new (base64) or existing (URLs)
                for (const img of updatedExpense.images) {
                    if (img.data && img.data.startsWith('data:')) {
                        // New image - convert base64 to File
                        const blob = await fetch(img.data).then(r => r.blob());
                        const file = new File([blob], img.name, { type: blob.type });
                        imageFiles.push(file);
                    }
                    // Existing images (URLs) are kept automatically by backend
                }
            }

            // Call backend API
            const response = await api.updateExpense(updatedExpense.id, expenseData, imageFiles);

            if (response.status === 'success') {
                console.log('✅ Expense updated in backend successfully');

                // Reload expenses from backend to stay in sync
                await this.loadExpenses();

                this.showNotification('✅ Expense updated successfully!');
                this.editingExpenseId = null;

                // Reset submit button text
                const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
                submitBtn.textContent = '✅ Confirm & Add Expense';
            } else {
                throw new Error(response.message || 'Failed to update expense');
            }
        } catch (error) {
            console.error('Error updating expense:', error);
            this.showNotification('❌ Failed to update expense: ' + error.message);
        }
    }

    displayExpenses() {
        const container = document.getElementById('expensesList');
        const selectAllContainer = document.getElementById('selectAllContainer');

        if (this.expenses.length === 0) {
            container.innerHTML = '<div class="empty-state">No expenses added yet. Add your first expense above!</div>';
            selectAllContainer.style.display = 'none';
            return;
        }

        // Show select all checkbox if there are expenses
        selectAllContainer.style.display = 'flex';

        const expensesHTML = this.expenses.map((expense, index) => `
            <div class="expense-item" id="expense-${expense.id}">
                <div class="expense-header">
                    <div class="expense-header-left">
                        <input type="checkbox"
                               class="expense-checkbox"
                               id="checkbox-${expense.id}"
                               data-expense-id="${expense.id}"
                               onchange="expenseTracker.updateExportButton()">
                        <label for="checkbox-${expense.id}" class="expense-amount">₹${this.formatAmount(expense.amount)}</label>
                    </div>
                    <div class="expense-actions">
                        <button class="edit-btn" onclick="expenseTracker.editExpense(${expense.id})">Edit</button>
                        <button class="delete-btn" onclick="expenseTracker.deleteExpense(${expense.id})">Delete</button>
                    </div>
                </div>
                <div class="expense-details">
                    <div><strong>Date:</strong> ${this.formatDisplayDate(expense.date)}${expense.time ? ` at ${this.formatDisplayTime(expense.time)}` : ''}</div>
                    <div><strong>Category:</strong> ${expense.category}</div>
                    <div><strong>Vendor:</strong> ${expense.vendor}</div>
                </div>
                <div style="margin-top: 8px; padding: 6px 8px; background: rgba(255, 255, 255, 0.03); border-radius: 6px; font-size: 13px;">
                    <strong>Description:</strong> ${expense.description}
                </div>
                ${expense.images.length > 0 ? `
                    <div class="expense-images">
                        ${expense.images.map((img, index) => `
                            <img src="${img.data}" alt="${img.name}" title="Click to view full size"
                                 onclick="expenseTracker.openImageModal('${img.data}', '${img.name}', ${expense.id}, ${index})">
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');

        container.innerHTML = expensesHTML;
        this.updateExportButton();
    }

    formatDisplayDate(dateString) {
        try {
            const date = new Date(dateString);
            const day = date.getDate();
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames[date.getMonth()];
            const year = date.getFullYear();
            return `${day}-${month}-${year}`; // Format: 8-Aug-2025
        } catch (error) {
            return dateString;
        }
    }

    formatDisplayTime(timeString) {
        try {
            // timeString is in HH:MM format (24-hour)
            const [hours, minutes] = timeString.split(':').map(Number);

            // Convert to 12-hour format with AM/PM
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight

            return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
        } catch (error) {
            return timeString;
        }
    }

    formatAmount(amount) {
        // Remove .00 from whole numbers, keep decimals for amounts with cents
        const num = parseFloat(amount);
        if (isNaN(num)) return '0';

        // Check if it's a whole number
        if (num === Math.floor(num)) {
            return num.toString();
        }

        // Has decimals - show up to 2 decimal places
        return num.toFixed(2);
    }

    updateTotal() {
        const total = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        document.getElementById('totalAmount').innerHTML = `<strong>Total Amount: ₹${this.formatAmount(total)}</strong>`;
    }

    resetForm() {
        document.getElementById('expenseForm').reset();
        // Clear extracted data when resetting form
        this.extractedData = {};
        this.setTodayDate();
    }

    async initializeGoogleSheets() {
        try {
            await googleSheetsService.initialize();
            console.log('Google Sheets service initialized');
        } catch (error) {
            console.log('Google Sheets initialization:', error);
        }
    }

    async loadExpenses() {
        try {
            console.log('Loading expenses from backend...');
            const response = await api.getExpenses(1, 1000); // Get up to 1000 expenses

            if (response.status === 'success') {
                this.expenses = response.expenses.map(exp => ({
                    id: exp._id,
                    date: exp.date.split('T')[0], // Convert to YYYY-MM-DD
                    category: exp.category,
                    description: exp.description,
                    amount: exp.amount,
                    vendor: exp.vendor,
                    time: exp.time || '',
                    images: exp.images.map(img => ({
                        name: img.filename,
                        data: img.url // Cloudinary URL
                    }))
                }));

                console.log(`✅ Loaded ${this.expenses.length} expenses from backend`);
                this.sortExpensesByDate();
                this.displayExpenses();
                this.updateTotal();
            }
        } catch (error) {
            console.error('Error loading expenses:', error);
            this.showNotification('⚠️ Failed to load expenses. Please refresh the page.');
            this.expenses = [];
        }
    }

    loadLastSyncedIndex() {
        const saved = localStorage.getItem('lastSyncedIndex');
        return saved ? parseInt(saved) : -1;
    }

    saveLastSyncedIndex(index) {
        localStorage.setItem('lastSyncedIndex', index.toString());
        this.lastSyncedIndex = index;
    }

    generateExcel() {
        if (this.expenses.length === 0) {
            alert('No expenses to export!');
            return;
        }

        // Create workbook with exact template format as default
        const workbook = XLSX.utils.book_new();
        const worksheet = {};

        // Create the exact template structure with specific cell mappings
        // Header section exactly as specified
        worksheet['A1'] = { v: 'EXPENSE REIMBURSEMENT FORM', t: 's' };

        // Row 4: Employee Name and Period
        worksheet['A4'] = { v: 'Employee Name:', t: 's' };
        worksheet['D4'] = { v: '[Employee Name]', t: 's' }; // User fills this
        worksheet['F4'] = { v: 'Expense Period:', t: 's' };
        worksheet['G4'] = { v: '[Expense Period]', t: 's' }; // User fills this

        // Row 5: Employee Code and From Date
        worksheet['A5'] = { v: 'Employee Code:', t: 's' };
        worksheet['D5'] = { v: '[Employee Code]', t: 's' }; // User fills this
        worksheet['E5'] = { v: 'From Date:', t: 's' };
        worksheet['F5'] = { v: '[From Date]', t: 's' }; // User fills this

        // Row 6: To Date
        worksheet['E6'] = { v: 'To Date:', t: 's' };
        worksheet['F6'] = { v: '[To Date]', t: 's' }; // User fills this

        // Row 8: Business Purpose
        worksheet['A8'] = { v: 'Business Purpose:', t: 's' };
        worksheet['E8'] = { v: '[Business Purpose]', t: 's' }; // User fills this

        // Expense table headers - row 13
        worksheet['A13'] = { v: 'Sr.', t: 's' };
        worksheet['B13'] = { v: 'Date', t: 's' };
        worksheet['C13'] = { v: 'Vendor Name/ Description', t: 's' };
        worksheet['D13'] = { v: 'From', t: 's' };
        worksheet['E13'] = { v: 'Category', t: 's' };
        worksheet['F13'] = { v: 'Cost', t: 's' };

        // Fill expense items (rows 14-66, max 53 items)
        this.expenses.slice(0, 53).forEach((expense, index) => {
            const rowNum = 14 + index;

            // Column A: Serial Number
            worksheet[`A${rowNum}`] = { v: index + 1, t: 'n' };

            // Column B: Date
            worksheet[`B${rowNum}`] = { v: expense.date, t: 's' };

            // Column C: Vendor/Description
            worksheet[`C${rowNum}`] = { v: `${expense.vendor} - ${expense.description}`, t: 's' };

            // Column D: From (empty for user to fill)
            worksheet[`D${rowNum}`] = { v: '', t: 's' };

            // Column E: Category
            worksheet[`E${rowNum}`] = { v: expense.category, t: 's' };

            // Column F: Cost
            worksheet[`F${rowNum}`] = { v: expense.amount, t: 'n' };
        });

        // Total formulas and cash advance section
        worksheet['E67'] = { v: 'SUBTOTAL', t: 's' };
        worksheet['F67'] = { f: 'SUM(F14:F66)', t: 'n' }; // Formula preserved

        worksheet['E68'] = { v: 'Less: Cash Advance', t: 's' };
        worksheet['F68'] = { v: 0, t: 'n' }; // Default cash advance

        worksheet['E69'] = { v: 'TOTAL REIMBURSEMENT', t: 's' };
        worksheet['F69'] = { f: 'F67-F68', t: 'n' }; // Formula preserved

        // Set the range for the worksheet
        worksheet['!ref'] = 'A1:G69';

        // Set column widths
        worksheet['!cols'] = [
            { width: 6 },   // A - Sr.
            { width: 12 },  // B - Date
            { width: 40 },  // C - Vendor/Description
            { width: 15 },  // D - From
            { width: 15 },  // E - Category
            { width: 12 },  // F - Cost
            { width: 15 }   // G - Period
        ];

        // Add the worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Expense Report');

        // Generate filename
        const fileName = `Expenses_Report_Format_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Download the file
        XLSX.writeFile(workbook, fileName);

        this.showNotification(`✅ Exact template format generated! Downloaded: ${fileName}`);
    }

    /**
     * Generate bills PDF as blob (for merging or standalone download)
     * @param {boolean} includeOrphaned - Whether to include saved/orphaned images
     * @returns {Promise<Blob>} PDF blob
     */
    async generateBillsPdfBlob(includeOrphaned = true) {
        console.log('=== Starting PDF Generation ===');
        console.log('Include orphaned images:', includeOrphaned);

        // Collect all images from current expenses
        const allImages = [];
        let currentExpenseImages = 0;
        let orphanedImages = 0;

        // Add current expense images
        if (this.expenses.length > 0) {
            this.expenses.forEach((expense, expenseIndex) => {
                expense.images.forEach((image, imageIndex) => {
                    allImages.push({
                        data: image.data,
                        label: `Expense ${expenseIndex + 1}`,
                        expense: expense,
                        type: 'current'
                    });
                    currentExpenseImages++;
                });
            });
        }
        console.log(`Current expense images found: ${currentExpenseImages}`);

        // Check for and add orphaned images if requested
        if (includeOrphaned) {
            try {
                console.log('Fetching orphaned/saved images...');
                const orphanedResponse = await api.getOrphanedImages();

                if (orphanedResponse.status === 'success' && orphanedResponse.images && orphanedResponse.images.length > 0) {
                    console.log(`Found ${orphanedResponse.images.length} orphaned/saved images`);

                    orphanedResponse.images.forEach((img, index) => {
                        allImages.push({
                            data: img.url,
                            label: `Saved ${index + 1}`,
                            type: 'orphaned',
                            uploadDate: img.uploadDate,
                            originalInfo: img.originalExpenseInfo
                        });
                        orphanedImages++;
                    });
                } else {
                    console.log('No orphaned/saved images found');
                }
            } catch (error) {
                console.error('Error fetching orphaned images for PDF:', error);
                // Don't throw error - continue with current images
            }
        }

        console.log(`Total images for PDF: ${allImages.length} (${currentExpenseImages} current + ${orphanedImages} saved)`);

        if (allImages.length === 0) {
            console.warn('No receipt images found for PDF generation');
            // Don't show alert here - let the calling function handle it
            throw new Error('No images available');
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait, millimeters, A4

        const pageWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const margin = 10;
        const headerHeight = 20;
        const footerHeight = 15;
        const availableWidth = pageWidth - (2 * margin);
        const availableHeight = pageHeight - (2 * margin) - headerHeight - footerHeight;

        // Determine layout: 6 images per page (3x2 grid) or 4 images per page (2x2 grid) if fewer
        let imagesPerRow, imagesPerColumn, imagesPerPage;
        if (allImages.length >= 6) {
            imagesPerRow = 3;
            imagesPerColumn = 2;
            imagesPerPage = 6;
        } else {
            imagesPerRow = 2;
            imagesPerColumn = 2;
            imagesPerPage = 4;
        }

        const gapX = 5; // Horizontal gap between images
        const gapY = 5; // Vertical gap between images
        const imageWidth = (availableWidth - (gapX * (imagesPerRow - 1))) / imagesPerRow;
        const imageHeight = (availableHeight - (gapY * (imagesPerColumn - 1))) / imagesPerColumn;

        let currentPage = 1;
        let firstPage = true;
        let currentType = null;
        let typeHeaderAdded = false;

        allImages.forEach((imageItem, index) => {
            // Check if we're starting a new type section
            if (imageItem.type !== currentType) {
                currentType = imageItem.type;
                typeHeaderAdded = false;
            }

            // Calculate position on current page
            const positionOnPage = index % imagesPerPage;

            // Add new page if needed
            if (positionOnPage === 0 && index > 0) {
                pdf.addPage();
                currentPage++;
                typeHeaderAdded = false;
            }

            // Add header on each page
            if (positionOnPage === 0) {
                pdf.setFillColor(45, 55, 72);
                pdf.rect(0, 0, pageWidth, headerHeight, 'F');

                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(255, 255, 255);

                // Dynamic header based on content type
                let headerText = 'RECEIPT IMAGES';
                if (currentType === 'orphaned' && !typeHeaderAdded) {
                    headerText = 'SAVED RECEIPT IMAGES';
                } else if (currentType === 'current') {
                    headerText = 'CURRENT EXPENSE RECEIPTS';
                }

                pdf.text(headerText, pageWidth / 2, 12, { align: 'center' });
                pdf.setTextColor(0, 0, 0);
                typeHeaderAdded = true;
            }

            // Calculate position in grid
            const row = Math.floor(positionOnPage / imagesPerRow);
            const col = positionOnPage % imagesPerRow;

            // Calculate image position
            const x = margin + (col * (imageWidth + gapX));
            const y = margin + headerHeight + (row * (imageHeight + gapY));

            try {
                // Create a temporary image to get aspect ratio
                const img = new Image();
                img.src = imageItem.data;

                // Calculate dimensions to maintain aspect ratio and center perfectly
                const imgAspectRatio = img.width / img.height;
                const boxAspectRatio = imageWidth / imageHeight;

                let finalWidth = imageWidth;
                let finalHeight = imageHeight;
                let offsetX = 0;
                let offsetY = 0;

                if (imgAspectRatio > boxAspectRatio) {
                    // Image is wider - fit to width, center vertically
                    finalHeight = imageWidth / imgAspectRatio;
                    offsetY = (imageHeight - finalHeight) / 2;
                } else {
                    // Image is taller - fit to height, center horizontally
                    finalWidth = imageHeight * imgAspectRatio;
                    offsetX = (imageWidth - finalWidth) / 2;
                }

                // Add border around box
                pdf.setDrawColor(200, 200, 200);
                pdf.setLineWidth(0.5);
                pdf.rect(x, y, imageWidth, imageHeight);

                // Add the image centered inside the box (from all four sides)
                pdf.addImage(imageItem.data, 'JPEG', x + offsetX, y + offsetY, finalWidth, finalHeight);

                // Add label below image
                pdf.setFontSize(8);
                pdf.setTextColor(100, 100, 100);
                pdf.text(imageItem.label, x + imageWidth / 2, y + imageHeight + 3, { align: 'center' });
                pdf.setTextColor(0, 0, 0);

            } catch (error) {
                console.error('Error adding image to PDF:', error);

                // Add error placeholder
                pdf.setFillColor(254, 226, 226);
                pdf.rect(x, y, imageWidth, imageHeight, 'F');

                pdf.setDrawColor(248, 113, 113);
                pdf.setLineWidth(1);
                pdf.rect(x, y, imageWidth, imageHeight);

                pdf.setFontSize(10);
                pdf.setTextColor(185, 28, 28);
                pdf.text('IMAGE ERROR', x + imageWidth / 2, y + imageHeight / 2, { align: 'center' });
                pdf.setTextColor(0, 0, 0);
            }
        });

        // Add footer with page numbers to all pages
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);

            // Footer line
            pdf.setDrawColor(203, 213, 225);
            pdf.setLineWidth(0.5);
            pdf.line(margin, pageHeight - footerHeight, pageWidth - margin, pageHeight - footerHeight);

            // Page numbers
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });

            if (i === 1) {
                pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, pageHeight - 5);
            }

            pdf.setTextColor(0, 0, 0);
        }

        // Return as blob instead of downloading
        return pdf.output('blob');
    }

    // REMOVED: Standalone generatePDF() method - PDF button removed from UI
    // PDF generation now only happens as part of the complete reimbursement package
    // The generateBillsPdfBlob() method is still available and used by generateCombinedReimbursementPDF()

    /**
     * Generate combined reimbursement package PDF
     * - Page 1+: User's Google Sheet (expense reimbursement form)
     * - Following pages: All bill receipt images
     */
    async generateCombinedReimbursementPDF() {
        try {
            // Step 1: Check if user has a Google Sheet
            const sheetUrl = googleSheetsService.getSheetUrl();
            if (!sheetUrl) {
                alert('❌ Please export to Google Sheets first!\n\nYou need to create your expense report in Google Sheets before downloading the complete package.');
                return;
            }

            // Show loading notification
            this.showNotification('📦 Preparing your reimbursement package...');

            // Step 2: Download Google Sheet as PDF from backend
            console.log('📄 Downloading Google Sheet PDF...');
            const sheetPdfResponse = await api.exportGoogleSheetAsPdf();

            // Convert base64 to bytes
            const sheetPdfBase64 = sheetPdfResponse.data.pdfBase64;
            const sheetPdfBytes = Uint8Array.from(atob(sheetPdfBase64), c => c.charCodeAt(0));

            this.showNotification('📋 Google Sheet downloaded, collecting all bill images (current + saved)...');

            // Step 3: Generate bill photos PDF (INCLUDING orphaned/saved images)
            console.log('📸 Generating bills PDF with ALL images (current + saved)...');

            let billsPdfBlob = null;
            let billsPdfBytes = null;
            let hasImages = false;

            try {
                billsPdfBlob = await this.generateBillsPdfBlob(true); // Explicitly include orphaned images
                billsPdfBytes = await billsPdfBlob.arrayBuffer();
                hasImages = true;
                this.showNotification('🔗 Merging documents...');
            } catch (error) {
                if (error.message === 'No images available') {
                    console.log('No bill images available, continuing with Google Sheet only');
                    this.showNotification('📋 No bill images found. Downloading Google Sheet only...');
                    hasImages = false;
                } else {
                    throw error; // Re-throw other errors
                }
            }

            // Step 4: Create or merge PDFs
            const { PDFDocument } = PDFLib;
            let mergedPdf;
            let totalPages;

            if (hasImages) {
                // We have both Google Sheet and bill images - merge them
                console.log('🔀 Merging Google Sheet and bill images...');

                // Create new merged PDF
                mergedPdf = await PDFDocument.create();

                // Load both PDFs
                const sheetPdf = await PDFDocument.load(sheetPdfBytes);
                const billsPdf = await PDFDocument.load(billsPdfBytes);

                // Copy pages from Google Sheet PDF (expense form)
                console.log(`📄 Adding ${sheetPdf.getPageCount()} page(s) from Google Sheet...`);
                const sheetPages = await mergedPdf.copyPages(sheetPdf, sheetPdf.getPageIndices());
                sheetPages.forEach(page => mergedPdf.addPage(page));

                // Copy pages from Bills PDF (receipt images)
                console.log(`📸 Adding ${billsPdf.getPageCount()} page(s) of receipts...`);
                const billsPages = await mergedPdf.copyPages(billsPdf, billsPdf.getPageIndices());
                billsPages.forEach(page => mergedPdf.addPage(page));

                totalPages = sheetPdf.getPageCount() + billsPdf.getPageCount();
            } else {
                // Only Google Sheet available
                console.log('📄 Only Google Sheet available for download...');
                mergedPdf = await PDFDocument.load(sheetPdfBytes);
                totalPages = mergedPdf.getPageCount();
            }

            this.showNotification('💾 Saving package...');

            // Step 5: Save merged PDF
            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

            // Download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reimbursement_Package_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Success notification with appropriate message
            if (hasImages) {
                this.showNotification(`✅ Complete reimbursement package downloaded! (${totalPages} pages with images)`);
            } else {
                this.showNotification(`📋 Google Sheet downloaded! (${totalPages} pages, no bill images available)`);
            }

            // Log summary for debugging
            console.log('=== Reimbursement Package Summary ===');
            console.log(`Google Sheet pages: ${totalPages}`);
            if (hasImages) {
                console.log(`Bill images included: Yes`);
            } else {
                console.log(`Bill images included: No (none available)`);
            }
            console.log(`Total pages: ${totalPages}`);

            console.log(`✅ Combined PDF created successfully: ${totalPages} pages, ${(mergedPdfBytes.length / 1024 / 1024).toFixed(2)} MB`);

        } catch (error) {
            console.error('❌ Error generating combined PDF:', error);

            if (error.message.includes('Google Sheet')) {
                alert('Failed to download Google Sheet PDF:\n\n' + error.message + '\n\nPlease make sure your expense report is exported to Google Sheets first.');
            } else if (error.message.includes('No expenses')) {
                alert('No expenses found to generate bills PDF.');
            } else {
                alert('Failed to generate reimbursement package:\n\n' + error.message);
            }
        }
    }

    exportJSON() {
        if (this.expenses.length === 0) {
            alert('No expenses to export!');
            return;
        }

        // Create JSON data in the exact format needed for Python script
        const data = {
            EmployeeName: "[Employee Name]",
            ExpensePeriod: this.getExpensePeriod(),
            EmployeeCode: "[Employee Code]",
            FromDate: this.getFromDate(),
            ToDate: this.getToDate(),
            BusinessPurpose: "[Business Purpose]",
            CashAdvance: 0,
            items: this.expenses.map(expense => ({
                Date: expense.date,
                VendorName_Description: `${expense.vendor} - ${expense.description}`,
                Category: expense.category,
                Cost: expense.amount
            }))
        };

        // Download as JSON file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expense_data_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showNotification('📋 JSON exported! Use with Python script to fill your template.');
    }

    getExpensePeriod() {
        if (this.expenses.length === 0) return new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const dates = this.expenses.map(e => new Date(e.date)).sort((a, b) => a - b);
        return dates[0].toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    getFromDate() {
        if (this.expenses.length === 0) return new Date().toISOString().split('T')[0];
        const dates = this.expenses.map(e => new Date(e.date)).sort((a, b) => a - b);
        return dates[0].toISOString().split('T')[0];
    }

    getToDate() {
        if (this.expenses.length === 0) return new Date().toISOString().split('T')[0];
        const dates = this.expenses.map(e => new Date(e.date)).sort((a, b) => a - b);
        return dates[dates.length - 1].toISOString().split('T')[0];
    }

    initializeClearDropdown() {
        const dropdownBtn = document.getElementById('clearDropdownBtn');
        const dropdownMenu = document.getElementById('clearDropdownMenu');
        const dropdownBackdrop = document.getElementById('dropdownBackdrop');

        // Smart positioning function
        const positionDropdown = () => {
            const btnRect = dropdownBtn.getBoundingClientRect();
            const menuHeight = 350; // Approximate height of the dropdown menu
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const spaceBelow = viewportHeight - btnRect.bottom;
            const spaceAbove = btnRect.top;

            // Remove positioning classes and inline styles
            dropdownMenu.classList.remove('dropdown-up');
            dropdownMenu.style.right = '';
            dropdownMenu.style.left = '';

            // Check if we're on mobile
            if (viewportWidth <= 480) {
                // Mobile: Ensure dropdown fits within viewport
                setTimeout(() => {
                    const menuRect = dropdownMenu.getBoundingClientRect();
                    const menuHeight = menuRect.height;

                    // If dropdown is taller than viewport, adjust max-height
                    if (menuHeight > viewportHeight - 100) {
                        dropdownMenu.style.maxHeight = `${viewportHeight - 100}px`;
                        dropdownMenu.style.overflowY = 'auto';
                    }
                }, 50);
                return;
            }

            // Tablet (481-768px): Center the dropdown (handled by CSS)
            if (viewportWidth > 480 && viewportWidth <= 768) {
                return;
            }

            // Desktop: Check vertical space
            if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
                // Position above if not enough space below
                dropdownMenu.classList.add('dropdown-up');
            }

            // For desktop, ensure proper right alignment
            setTimeout(() => {
                const menuRect = dropdownMenu.getBoundingClientRect();

                // Check if dropdown goes off-screen on the right
                if (menuRect.right > viewportWidth - 20) {
                    const overflow = menuRect.right - (viewportWidth - 20);
                    dropdownMenu.style.right = `${overflow + 20}px`;
                }

                // Check if dropdown goes off-screen on the left
                if (menuRect.left < 20) {
                    dropdownMenu.style.left = '20px';
                    dropdownMenu.style.right = 'auto';
                }
            }, 50);
        };

        // Toggle dropdown with smart positioning
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            if (!dropdownMenu.classList.contains('show')) {
                // Show backdrop on mobile
                if (window.innerWidth <= 480) {
                    dropdownBackdrop.classList.add('show');
                }

                // Position before showing
                positionDropdown();
                dropdownMenu.classList.add('show');

                // Reposition after animation starts to ensure accuracy
                setTimeout(positionDropdown, 10);
            } else {
                dropdownMenu.classList.remove('show');
                dropdownBackdrop.classList.remove('show');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
                dropdownMenu.classList.remove('dropdown-up');
                dropdownBackdrop.classList.remove('show');
            }
        });

        // Click backdrop to close (mobile)
        if (dropdownBackdrop) {
            dropdownBackdrop.addEventListener('click', () => {
                dropdownMenu.classList.remove('show');
                dropdownMenu.classList.remove('dropdown-up');
                dropdownBackdrop.classList.remove('show');
            });
        }

        // Reposition on window resize
        window.addEventListener('resize', () => {
            if (dropdownMenu.classList.contains('show')) {
                positionDropdown();
            }
        });

        // Reposition on scroll
        window.addEventListener('scroll', () => {
            if (dropdownMenu.classList.contains('show')) {
                positionDropdown();
            }
        }, { passive: true });

        // Clear data only (keep images)
        document.getElementById('clearDataOnly').addEventListener('click', async () => {
            dropdownMenu.classList.remove('show');
            dropdownBackdrop.classList.remove('show');
            await this.clearDataOnly();
        });

        // Clear images only
        document.getElementById('clearImagesOnly').addEventListener('click', async () => {
            dropdownMenu.classList.remove('show');
            dropdownBackdrop.classList.remove('show');
            await this.clearImagesOnly();
        });

        // Clear everything
        document.getElementById('clearEverything').addEventListener('click', async () => {
            dropdownMenu.classList.remove('show');
            dropdownBackdrop.classList.remove('show');
            await this.clearEverything();
        });
    }

    async clearDataOnly() {
        // Show smart warning
        const warning = `
            <strong>Clear Expense Data Only?</strong><br><br>
            This will:<br>
            • Delete all expense records<br>
            • Keep all bill photos for 30 days<br>
            • Allow PDF generation later<br><br>
            <small>Images will be automatically deleted after 30 days unless extended.</small>
        `;

        if (confirm('Clear expense data but keep images?\n\nYour bill photos will be saved for 30 days for later PDF generation.')) {
            try {
                const response = await api.clearExpenseDataOnly();

                if (response.status === 'success') {
                    // Reload expenses from backend
                    await this.loadExpenses();

                    this.showNotification(`✅ Expense data cleared! ${response.orphanedImagesCount || 0} images saved for later use.`);
                } else {
                    throw new Error(response.message || 'Failed to clear expense data');
                }
            } catch (error) {
                console.error('Error clearing expense data:', error);
                this.showNotification('❌ Failed to clear expense data: ' + error.message);
            }
        }
    }

    async clearImagesOnly() {
        try {
            // First check if there are any orphaned images
            const orphanedResponse = await api.getOrphanedImages();

            if (!orphanedResponse.images || orphanedResponse.images.length === 0) {
                this.showNotification('ℹ️ No saved images to clear');
                return;
            }

            const imageCount = orphanedResponse.images.length;
            const totalSize = orphanedResponse.stats?.totalSizeMB || 0;

            if (confirm(`Clear ${imageCount} saved images (${totalSize} MB)?\n\nThis will permanently delete all saved bill photos that are not attached to expenses.`)) {
                const response = await api.clearImagesOnly();

                if (response.status === 'success') {
                    this.showNotification(`✅ ${response.deletedCount || 0} saved images cleared!`);
                } else {
                    throw new Error(response.message || 'Failed to clear images');
                }
            }
        } catch (error) {
            console.error('Error clearing images:', error);
            this.showNotification('❌ Failed to clear images: ' + error.message);
        }
    }

    async clearEverything() {
        // Show strong warning
        if (confirm('⚠️ CLEAR EVERYTHING?\n\nThis will PERMANENTLY delete:\n• All expense records\n• All bill photos\n• All saved images\n\nThis action CANNOT be undone!')) {
            if (confirm('Are you absolutely sure? All your data and images will be permanently deleted.')) {
                try {
                    const response = await api.clearAll();

                    if (response.status === 'success') {
                        // Reload expenses from backend
                        await this.loadExpenses();

                        this.showNotification(`✅ All data cleared! ${response.expensesCleared || 0} expenses and ${response.expenseImagesDeleted + response.orphanedImagesDeleted || 0} images deleted.`);
                    } else {
                        throw new Error(response.message || 'Failed to clear all data');
                    }
                } catch (error) {
                    console.error('Error clearing all data:', error);
                    this.showNotification('❌ Failed to clear all data: ' + error.message);
                }
            }
        }
    }

    openTemplateModal() {
        document.getElementById('templateModal').style.display = 'block';
        this.loadTemplateConfig();
    }

    closeTemplateModal() {
        document.getElementById('templateModal').style.display = 'none';
    }

    openImageModal(imageData, imageName, expenseId, imageIndex) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        const imageTitle = document.getElementById('imageTitle');

        modalImage.src = imageData;
        imageTitle.textContent = `${imageName} - Expense #${expenseId}`;
        modal.style.display = 'block';

        // Add keyboard support
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                this.closeImageModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    }

    closeImageModal() {
        document.getElementById('imageModal').style.display = 'none';
    }


    loadTemplateConfig() {
        // Load saved configuration or use defaults
        const config = JSON.parse(localStorage.getItem('templateConfig')) || this.getDefaultTemplateConfig();

        document.getElementById('companyName').value = config.companyName || '';
        document.getElementById('reportTitle').value = config.reportTitle || 'EXPENSE REIMBURSEMENT FORM';

        // Set checkboxes
        Object.keys(config.fields).forEach(field => {
            const checkbox = document.getElementById(field);
            if (checkbox) {
                checkbox.checked = config.fields[field];
            }
        });
    }

    getDefaultTemplateConfig() {
        return {
            companyName: '',
            reportTitle: 'EXPENSE REIMBURSEMENT FORM',
            fields: {
                includeEmployeeId: true,
                includeDepartment: true,
                includeManager: true,
                includePeriod: true,
                includeSerialNo: true,
                includeDate: true,
                includeCategory: true,
                includeDescription: true,
                includeVendor: true,
                includeAmount: true,
                includeReceipt: true,
                includePurpose: true,
                includeEmployeeSignature: true,
                includeManagerApproval: true,
                includeFinanceSection: true
            }
        };
    }

    saveTemplateConfig() {
        const config = {
            companyName: document.getElementById('companyName').value,
            reportTitle: document.getElementById('reportTitle').value,
            fields: {}
        };

        // Get all checkboxes
        const checkboxes = document.querySelectorAll('#templateModal input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            config.fields[checkbox.id] = checkbox.checked;
        });

        localStorage.setItem('templateConfig', JSON.stringify(config));
        this.showNotification('✅ Template configuration saved successfully!');
        this.closeTemplateModal();
    }

    resetTemplateConfig() {
        const defaultConfig = this.getDefaultTemplateConfig();
        localStorage.setItem('templateConfig', JSON.stringify(defaultConfig));
        this.loadTemplateConfig();
        this.showNotification('🔄 Template configuration reset to defaults!');
    }

    handleTemplateUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Try to auto-configure based on the uploaded template
                this.analyzeTemplateStructure(workbook);
                this.showNotification('📊 Template analyzed! Configuration updated automatically.');
            } catch (error) {
                console.error('Error reading template:', error);
                this.showNotification('❌ Error reading template file. Please try again.');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    analyzeTemplateStructure(workbook) {
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

        // Auto-detect configuration based on content
        const config = this.getDefaultTemplateConfig();

        // Look for company name in first few rows
        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
            const row = jsonData[i];
            if (row && row[0] && typeof row[0] === 'string') {
                if (row[0].toLowerCase().includes('company') ||
                    row[0].toLowerCase().includes('ltd') ||
                    row[0].toLowerCase().includes('limited')) {
                    config.companyName = row[0];
                    break;
                }
            }
        }

        // Look for report title
        for (let i = 0; i < Math.min(3, jsonData.length); i++) {
            const row = jsonData[i];
            if (row && row[0] && typeof row[0] === 'string') {
                if (row[0].toLowerCase().includes('expense') ||
                    row[0].toLowerCase().includes('reimbursement')) {
                    config.reportTitle = row[0];
                    break;
                }
            }
        }

        // Save the auto-detected configuration
        localStorage.setItem('templateConfig', JSON.stringify(config));
        this.loadTemplateConfig();
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100px)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 4000);
    }

    handleSelectAll(e) {
        const isChecked = e.target.checked;
        const checkboxes = document.querySelectorAll('.expense-checkbox');

        checkboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
        });

        this.updateExportButton();
        console.log(`Select All: ${isChecked ? 'Checked' : 'Unchecked'} - ${checkboxes.length} items`);
    }

    updateExportButton() {
        const checkboxes = document.querySelectorAll('.expense-checkbox:checked');
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        const allCheckboxes = document.querySelectorAll('.expense-checkbox');
        const exportBtn = document.getElementById('exportToGoogleSheets');
        const btnText = exportBtn.querySelector('.btn-text');

        // Update select all checkbox state
        if (allCheckboxes.length > 0) {
            selectAllCheckbox.checked = checkboxes.length === allCheckboxes.length;
            selectAllCheckbox.indeterminate = checkboxes.length > 0 && checkboxes.length < allCheckboxes.length;
        }

        if (checkboxes.length > 0) {
            btnText.textContent = `Export Selected (${checkboxes.length})`;
            exportBtn.style.display = 'block';
        } else {
            btnText.textContent = 'Export to Google Sheets';
        }
    }

    getSelectedExpenses() {
        const checkboxes = document.querySelectorAll('.expense-checkbox:checked');
        const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.expenseId); // Keep as string for MongoDB IDs
        return this.expenses.filter(expense => selectedIds.includes(expense.id));
    }

    async exportToGoogleSheets() {
        if (this.expenses.length === 0) {
            this.showNotification('⚠️ No expenses to export to Google Sheets');
            return;
        }

        // Get selected expenses
        const selectedExpenses = this.getSelectedExpenses();

        if (selectedExpenses.length === 0) {
            this.showNotification('⚠️ Please select expenses to export by checking the boxes');
            return;
        }

        try {
            const button = document.getElementById('exportToGoogleSheets');
            const originalText = button.querySelector('.btn-text').textContent;
            button.querySelector('.btn-text').textContent = 'Exporting...';
            button.disabled = true;

            console.log(`Exporting ${selectedExpenses.length} selected expenses`);
            const result = await googleSheetsService.exportExpenses(selectedExpenses);

            if (result.success) {
                this.showNotification(`✅ Exported ${selectedExpenses.length} expenses to Google Sheets`);
                console.log(`Data exported to rows ${result.startRow} to ${result.endRow}`);

                // Uncheck all checkboxes after successful export
                document.querySelectorAll('.expense-checkbox:checked').forEach(cb => cb.checked = false);
                this.updateExportButton();
            } else {
                this.showNotification(`❌ ${result.message}`);
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('❌ Export failed: ' + error.message);
        } finally {
            const button = document.getElementById('exportToGoogleSheets');
            button.querySelector('.btn-text').textContent = 'Export to Google Sheets';
            button.disabled = false;
        }
    }

    async resetGoogleSheet() {
        const sheetUrl = googleSheetsService.getSheetUrl();

        if (!sheetUrl) {
            alert('⚠️ You don\'t have a Google Sheet yet.\n\nPlease export expenses to Google Sheets first to create your sheet.');
            return;
        }

        // Confirm reset action
        if (!confirm('🔄 Reset Google Sheet?\n\nThis will restore your sheet to the master template format while preserving all your expense data.\n\nAre you sure you want to continue?')) {
            return;
        }

        try {
            const button = document.getElementById('resetGoogleSheet');
            const originalText = button.querySelector('.btn-text').textContent;
            button.querySelector('.btn-text').textContent = 'Resetting...';
            button.disabled = true;

            console.log('Resetting Google Sheet...');

            // Call Google Sheets service to reset
            const result = await googleSheetsService.resetSheet();

            if (result.success) {
                this.showNotification('✅ Google Sheet reset successfully! Format restored to master template.');
                console.log('Sheet reset completed');
            } else {
                this.showNotification(`❌ ${result.message}`);
            }
        } catch (error) {
            console.error('Reset error:', error);
            this.showNotification('❌ Failed to reset sheet: ' + error.message);
        } finally {
            const button = document.getElementById('resetGoogleSheet');
            button.querySelector('.btn-text').textContent = 'Reset Sheet';
            button.disabled = false;
        }
    }

    handleMainCategoryChange(e) {
        const mainCategory = e.target.value;
        const subcategoryGroup = document.getElementById('subcategoryGroup');
        const subcategorySelect = document.getElementById('subcategory');
        const customCategoryGroup = document.getElementById('customCategoryGroup');
        const customCategoryInput = document.getElementById('customCategory');
        const hiddenCategory = document.getElementById('category');

        // Hide both subcategory dropdown and custom input by default
        subcategoryGroup.style.display = 'none';
        customCategoryGroup.style.display = 'none';
        subcategorySelect.innerHTML = '<option value="">Select Subcategory</option>';
        customCategoryInput.value = '';

        if (mainCategory === 'Others') {
            // Show custom text input for "Others" category
            customCategoryGroup.style.display = 'block';
            hiddenCategory.value = mainCategory;
        } else if (mainCategory && this.categorySubcategories[mainCategory]) {
            // Show subcategory dropdown for predefined categories
            subcategoryGroup.style.display = 'block';

            // Populate subcategories
            this.categorySubcategories[mainCategory].forEach(sub => {
                const option = document.createElement('option');
                option.value = sub;
                option.textContent = sub;
                subcategorySelect.appendChild(option);
            });

            // Clear the hidden category field
            hiddenCategory.value = mainCategory;
        } else {
            // No category selected
            hiddenCategory.value = '';
        }
    }

    handleSubcategoryChange(e) {
        const mainCategory = document.getElementById('mainCategory').value;
        const subcategory = e.target.value;
        const hiddenCategory = document.getElementById('category');

        if (mainCategory && subcategory) {
            // Combine main category and subcategory with a dash
            hiddenCategory.value = `${mainCategory} - ${subcategory}`;
        } else {
            hiddenCategory.value = mainCategory;
        }
    }

    handleCustomCategoryInput(e) {
        const mainCategory = document.getElementById('mainCategory').value;
        const customText = e.target.value.trim();
        const hiddenCategory = document.getElementById('category');

        if (mainCategory === 'Others' && customText) {
            // Combine "Others" with custom text
            hiddenCategory.value = `Others - ${customText}`;
        } else {
            hiddenCategory.value = mainCategory;
        }
    }

    // Orphaned Images Gallery Methods
    async openOrphanedImagesModal() {
        try {
            // Fetch orphaned images from backend
            const response = await api.getOrphanedImages();

            if (response.status === 'success') {
                const modal = document.getElementById('orphanedImagesModal');
                const statsDiv = document.getElementById('orphanedImagesStats');
                const gridDiv = document.getElementById('orphanedImagesGrid');

                // Display stats with improved modern design
                const stats = response.stats || {};
                statsDiv.innerHTML = `
                    <div class="stats-container-modern">
                        <div class="stat-card-modern">
                            <div class="stat-label-modern">Total Images</div>
                            <div class="stat-value-modern">${response.count || 0}</div>
                        </div>
                        <div class="stat-card-modern">
                            <div class="stat-label-modern">Total Size</div>
                            <div class="stat-value-modern">
                                ${stats.totalSizeMB || '0.00'}
                                <span class="stat-unit-modern">MB</span>
                            </div>
                        </div>
                        <div class="stat-card-modern">
                            <div class="stat-label-modern">Exported</div>
                            <div class="stat-value-modern">${stats.exportedCount || 0}</div>
                        </div>
                        <div class="stat-card-modern">
                            <div class="stat-label-modern">Expiring Soon</div>
                            <div class="stat-value-modern warning">${stats.expiringWithin7Days || 0}</div>
                        </div>
                    </div>
                `;

                // Display images or empty state
                if (!response.images || response.images.length === 0) {
                    gridDiv.innerHTML = `
                        <div class="empty-state-modern">
                            <div class="empty-icon-modern">📭</div>
                            <h3>No Saved Images</h3>
                            <p>Images will appear here when you use "Clear Data Only" option</p>
                        </div>
                    `;
                } else {
                    gridDiv.innerHTML = `
                        <div class="images-grid-modern">
                            ${response.images.map(img => {
                                const uploadDate = new Date(img.uploadDate || img.createdAt).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                });
                                const expiryDate = new Date(img.expiryDate);
                                const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                                const badgeClass = daysUntilExpiry <= 7 ? 'badge-danger' :
                                                  daysUntilExpiry <= 14 ? 'badge-warning' : 'badge-success';

                                return `
                                    <div class="image-card-modern">
                                        <div class="image-preview-modern" onclick="expenseTracker.openImageModal('${img.url}', '${img.filename}', 'orphaned', 0)">
                                            <img src="${img.url}" alt="${img.filename}">
                                            <div class="image-overlay-modern">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                                    <path d="M15 3h6v6m0-6L10 14m-5 2H3v-6" stroke="white" stroke-width="2" stroke-linecap="round"/>
                                                </svg>
                                            </div>
                                        </div>

                                        <div class="image-details-modern">
                                            <div class="detail-row-modern">
                                                <span class="detail-icon">📅</span>
                                                <span class="detail-text">${uploadDate}</span>
                                            </div>

                                            <div class="detail-row-modern">
                                                <span class="detail-icon">🏪</span>
                                                <span class="detail-text">${img.originalExpenseInfo?.vendor || 'Unknown Vendor'}</span>
                                            </div>

                                            <div class="detail-row-modern">
                                                <span class="detail-icon">💰</span>
                                                <span class="detail-value-modern">₹${img.originalExpenseInfo?.amount || 0}</span>
                                            </div>
                                        </div>

                                        <div class="expiry-badge-modern ${badgeClass}">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
                                                <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                            </svg>
                                            <span>${daysUntilExpiry} days left</span>
                                        </div>

                                        <div class="action-buttons-modern">
                                            <button class="btn-extend-modern" onclick="expenseTracker.extendImageExpiry('${img._id}')">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 4v16m8-8H4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                                </svg>
                                                +30 days
                                            </button>
                                            <button class="btn-delete-modern" onclick="expenseTracker.deleteOrphanedImage('${img._id}')">
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }

                modal.style.display = 'block';
                modal.classList.add('modal-modern');
            } else {
                throw new Error(response.message || 'Failed to fetch saved images');
            }
        } catch (error) {
            console.error('Error opening orphaned images modal:', error);
            this.showNotification('❌ Failed to load saved images: ' + error.message);
        }
    }

    closeOrphanedImagesModal() {
        document.getElementById('orphanedImagesModal').style.display = 'none';
    }

    async extendImageExpiry(imageId) {
        try {
            const response = await api.extendOrphanedImageExpiry(imageId, 30);

            if (response.status === 'success') {
                this.showNotification('✅ Image expiry extended by 30 days');
                // Refresh the gallery
                await this.openOrphanedImagesModal();
            } else {
                throw new Error(response.message || 'Failed to extend image expiry');
            }
        } catch (error) {
            console.error('Error extending image expiry:', error);
            this.showNotification('❌ Failed to extend image expiry: ' + error.message);
        }
    }

    async deleteOrphanedImage(imageId) {
        if (confirm('Delete this saved image?\n\nThis action cannot be undone.')) {
            try {
                const response = await api.deleteOrphanedImage(imageId);

                if (response.status === 'success') {
                    this.showNotification('✅ Image deleted successfully');
                    // Refresh the gallery
                    await this.openOrphanedImagesModal();
                } else {
                    throw new Error(response.message || 'Failed to delete image');
                }
            } catch (error) {
                console.error('Error deleting orphaned image:', error);
                this.showNotification('❌ Failed to delete image: ' + error.message);
            }
        }
    }
}

// Create global expenseTracker instance
window.expenseTracker = new ExpenseTracker();