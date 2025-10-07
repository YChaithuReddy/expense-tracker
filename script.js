class ExpenseTracker {
    constructor() {
        this.expenses = this.loadExpenses();
        this.scannedImages = [];
        this.extractedData = {};
        this.lastSyncedIndex = this.loadLastSyncedIndex(); // Track last synced expense
        this.editingExpenseId = null; // Track which expense is being edited
        this.initializeEventListeners();
        this.displayExpenses();
        this.updateTotal();
        this.setTodayDate();
    }

    initializeEventListeners() {
        document.getElementById('billImages').addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('scanBills').addEventListener('click', () => this.scanBills());
        document.getElementById('backToScan').addEventListener('click', () => this.backToScan());
        document.getElementById('expenseForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('generatePDF').addEventListener('click', () => this.generatePDF());
        document.getElementById('clearAll').addEventListener('click', () => this.clearAllExpenses());

        // Google Sheets configuration
        document.getElementById('configureGoogleSheets').addEventListener('click', () => this.openGoogleSheetsModal());
        document.getElementById('closeGoogleModal').addEventListener('click', () => this.closeGoogleSheetsModal());
        document.querySelector('.close-google-sheets').addEventListener('click', () => this.closeGoogleSheetsModal());
        document.getElementById('saveGoogleConfig').addEventListener('click', () => this.saveGoogleSheetsConfig());
        document.getElementById('initializeApis').addEventListener('click', () => this.initializeGoogleApis());
        document.getElementById('authorizeGoogle').addEventListener('click', () => this.authorizeGoogle());
        document.getElementById('signOutGoogle').addEventListener('click', () => this.signOutGoogle());
        document.getElementById('testConnection').addEventListener('click', () => this.testGoogleConnection());
        document.getElementById('exportToGoogleSheets').addEventListener('click', () => this.exportToGoogleSheets());


        // Image modal
        document.querySelector('.close-image').addEventListener('click', () => this.closeImageModal());

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('templateModal')) {
                this.closeTemplateModal();
            }
            if (e.target === document.getElementById('googleSheetsModal')) {
                this.closeGoogleSheetsModal();
            }
            if (e.target === document.getElementById('imageModal')) {
                this.closeImageModal();
            }
        });
    }

    setTodayDate() {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('date');
        if (dateInput) {
            dateInput.value = today;
        }
    }

    handleImageUpload(e) {
        const files = Array.from(e.target.files);
        this.scannedImages = [];

        if (files.length === 0) {
            document.getElementById('scanBills').style.display = 'none';
            document.getElementById('imagePreview').innerHTML = '';
            return;
        }

        const previewContainer = document.getElementById('imagePreview');
        previewContainer.innerHTML = '<h3>📋 Selected Images:</h3>';

        files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.scannedImages.push({
                    name: file.name,
                    data: e.target.result,
                    file: file
                });

                const imageDiv = document.createElement('div');
                imageDiv.className = 'preview-image';
                imageDiv.innerHTML = `
                    <img src="${e.target.result}" alt="${file.name}" style="max-width: 200px; max-height: 150px; object-fit: cover; border-radius: 8px; margin: 5px;">
                    <p style="font-size: 12px; text-align: center; margin: 5px 0;">${file.name}</p>
                `;
                previewContainer.appendChild(imageDiv);

                if (this.scannedImages.length === files.length) {
                    document.getElementById('scanBills').style.display = 'block';
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
            for (let i = 0; i < this.scannedImages.length; i++) {
                progressText.textContent = `${Math.round(((i + 1) / this.scannedImages.length) * 100)}%`;

                const result = await Tesseract.recognize(
                    this.scannedImages[i].data,
                    'eng',
                    {
                        logger: m => console.log(m)
                    }
                );

                allExtractedText += result.data.text + '\n\n';
            }

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
            description: '',
            category: 'Miscellaneous'
        };

        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        console.log('OCR Text Lines:', lines); // Debug log

        // Enhanced amount extraction for various formats
        const fullText = text.toLowerCase();

        // Priority 1: Look for explicit amount/total/paid keywords
        const amountPatterns = [
            /(?:amount|total|paid|sum|bill|charge)[\s:]*(?:rs\.?|₹)?\s*(\d+(?:[.,]\d{1,2})?)/i,
            /(?:rs\.?|₹)\s*(\d+(?:[.,]\d{1,2})?)/i,
            /(\d+(?:[.,]\d{1,2})?)\s*(?:rs\.?|₹)/i,
            /(?:inr|rupees?)\s*(\d+(?:[.,]\d{1,2})?)/i,
            /(\d+(?:[.,]\d{1,2})?)\s*(?:inr|rupees?)/i,
            /rupees\s+(\w+)(?:\s+only)?/i // for "Rupees Eighty Only"
        ];

        // Try each pattern on full text first
        for (const pattern of amountPatterns) {
            const match = fullText.match(pattern);
            if (match) {
                let amount = match[1];

                // Handle text amounts like "Eighty"
                if (isNaN(amount)) {
                    const textNumbers = {
                        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
                        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
                        'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
                        'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
                        'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
                        'hundred': 100, 'thousand': 1000
                    };
                    amount = textNumbers[amount.toLowerCase()] || 0;
                }

                if (amount && parseFloat(amount) > 0) {
                    data.amount = parseFloat(amount.toString().replace(',', '.')).toString();
                    console.log('✅ Amount found:', data.amount);
                    break;
                }
            }
        }

        // Priority 2: If no amount found, look for any standalone number with currency
        if (!data.amount) {
            for (const line of lines) {
                const match = line.match(/(?:₹|rs\.?)\s*(\d+(?:[.,]\d{1,2})?)/i) ||
                             line.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:₹|rs\.?)/i);
                if (match) {
                    const amount = match[1];
                    if (amount && parseFloat(amount) > 0 && parseFloat(amount) < 100000) {
                        data.amount = parseFloat(amount.toString().replace(',', '.')).toString();
                        console.log('✅ Amount found (fallback):', data.amount);
                        break;
                    }
                }
            }
        }

        // Enhanced vendor extraction for Paytm-style receipts
        for (const line of lines) {
            // Skip common non-vendor lines
            if (line.match(/^(amount|to|from|paid|paytm|upi|bank|ref|date|time)/i) ||
                line.match(/₹|\d{4,}/) || line.length < 3) {
                continue;
            }

            // Look for merchant/vendor patterns
            if (line.match(/limited|ltd|pvt|corp|company|station|store|mart|shop/i) ||
                (line.length > 5 && line.length < 50 && !line.match(/\d{2}[\/\-\.]\d{2}/))) {
                data.vendor = line.substring(0, 50);
                break;
            }
        }

        // Enhanced date extraction for multiple formats
        const datePatterns = [
            /(\d{1,2})[\/\-\s]+([a-z]{3})[\/\-\s]+(\d{2,4})/i, // 04 Sep 2025
            /([a-z]{3})[\/\-\s]+(\d{1,2})[\/\-\s]*(\d{2,4})/i, // Sep 04 2025
            /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,     // 04/09/2025
            /(\d{2,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,     // 2025/09/04
            /paid\s+at\s+\d{2}:\d{2}\s+[ap]m,?\s*(\d{1,2})\s+([a-z]{3})\s+(\d{2,4})/i // Paid at 06:21 PM, 04 Sep 2025
        ];

        const monthNames = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
            january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
            july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
        };

        for (const line of lines) {
            for (const pattern of datePatterns) {
                const dateMatch = line.match(pattern);
                if (dateMatch) {
                    try {
                        let day, month, year;

                        if (dateMatch[0].match(/[a-z]{3}/i)) {
                            // Handle month name formats
                            if (isNaN(dateMatch[1])) {
                                // Format: Sep 04 2025
                                month = monthNames[dateMatch[1].toLowerCase()];
                                day = parseInt(dateMatch[2]);
                                year = parseInt(dateMatch[3]);
                            } else {
                                // Format: 04 Sep 2025
                                day = parseInt(dateMatch[1]);
                                month = monthNames[dateMatch[2].toLowerCase()];
                                year = parseInt(dateMatch[3]);
                            }
                        } else {
                            // Handle numeric formats
                            if (dateMatch[1] && dateMatch[2] && dateMatch[3]) {
                                day = parseInt(dateMatch[1]);
                                month = parseInt(dateMatch[2]) - 1; // JavaScript months are 0-indexed
                                year = parseInt(dateMatch[3]);
                            }
                        }

                        if (year < 100) year += 2000;
                        if (month !== undefined && !isNaN(month) && day && year) {
                            const date = new Date(year, month, day);
                            if (!isNaN(date.getTime())) {
                                data.date = date.toISOString().split('T')[0];
                                break;
                            }
                        }
                    } catch (e) {
                        console.log('Date parsing error:', e);
                    }
                }
            }
            if (data.date) break;
        }

        // Enhanced category detection
        const textLower = text.toLowerCase();
        if (textLower.includes('fuel') || textLower.includes('petrol') || textLower.includes('diesel') ||
            textLower.includes('gas') || textLower.includes('hp') || textLower.includes('bharat petroleum') ||
            textLower.includes('iocl') || textLower.includes('bpcl') || textLower.includes('shell')) {
            data.category = 'Fuel';
        } else if (textLower.includes('uber') || textLower.includes('ola') || textLower.includes('taxi') ||
                   textLower.includes('transport') || textLower.includes('bus') || textLower.includes('train') ||
                   textLower.includes('metro') || textLower.includes('auto')) {
            data.category = 'Transportation';
        } else if (textLower.includes('hotel') || textLower.includes('accommodation') || textLower.includes('lodge') ||
                   textLower.includes('resort') || textLower.includes('guest house')) {
            data.category = 'Accommodation';
        } else if (textLower.includes('restaurant') || textLower.includes('food') || textLower.includes('cafe') ||
                   textLower.includes('meal') || textLower.includes('dinner') || textLower.includes('lunch') ||
                   textLower.includes('breakfast') || textLower.includes('zomato') || textLower.includes('swiggy')) {
            data.category = 'Meals';
        }

        // Generate description (simplified - only use category)
        if (data.amount) {
            data.description = `${data.category} - ₹${data.amount}`;
        } else {
            data.description = `${data.category} expense`;
        }

        console.log('✅ Parsed OCR data:', data); // Debug log
        console.log('📊 Detection Summary:');
        console.log('  Amount:', data.amount || '❌ NOT FOUND');
        console.log('  Date:', data.date || '❌ NOT FOUND');
        console.log('  Category:', data.category);
        console.log('  Vendor:', data.vendor || '(not extracted)');

        return data;
    }

    populateForm() {
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
            if (field.value && field.value.trim() !== '') {
                element.value = field.value;
            } else {
                element.value = ''; // Leave empty for manual entry
            }
        });

        // Vendor field - always leave empty for manual entry
        document.getElementById('vendor').value = '';

        // Set the receipt images
        const receiptInput = document.getElementById('receipt');
        const dt = new DataTransfer();
        this.scannedImages.forEach(img => {
            dt.items.add(img.file);
        });
        receiptInput.files = dt.files;
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

        // Build list of extracted fields - only show what was found
        let extractedFields = [];
        if (this.extractedData.amount) extractedFields.push(`Amount: ₹${this.extractedData.amount}`);
        if (this.extractedData.vendor) extractedFields.push(`Vendor: ${this.extractedData.vendor}`);
        if (this.extractedData.date) extractedFields.push(`Date: ${this.extractedData.date}`);
        if (this.extractedData.category) extractedFields.push(`Category: ${this.extractedData.category}`);

        if (extractedFields.length > 0) {
            debugInfo.innerHTML = `
                <strong style="color: var(--neon-cyan);">🔍 Extracted Data:</strong><br>
                ${extractedFields.join('<br>')}
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
                const expense = {
                    id: this.editingExpenseId,
                    date: date,
                    category: category,
                    description: description,
                    amount: parseFloat(amount),
                    vendor: formData.get('vendor') || 'N/A',
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

    addExpense(expense) {
        console.log('Adding expense to list:', expense); // Debug log
        this.expenses.push(expense);

        // Sort expenses by date (oldest first)
        this.sortExpensesByDate();

        this.saveExpenses();
        this.displayExpenses();
        this.updateTotal();
        this.resetForm();
        this.showNotification('✅ Expense added successfully!');
        console.log('Total expenses now:', this.expenses.length); // Debug log
    }

    sortExpensesByDate() {
        // Sort expenses by date in ascending order (oldest first)
        this.expenses.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA - dateB;
        });
    }

    deleteExpense(id) {
        if (confirm('Are you sure you want to delete this expense?')) {
            this.expenses = this.expenses.filter(expense => expense.id !== id);
            this.saveExpenses();
            this.displayExpenses();
            this.updateTotal();
            this.showNotification('Expense deleted successfully!');
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

    updateExpense(updatedExpense) {
        const index = this.expenses.findIndex(exp => exp.id === updatedExpense.id);
        if (index !== -1) {
            this.expenses[index] = updatedExpense;
            this.sortExpensesByDate();
            this.saveExpenses();
            this.displayExpenses();
            this.updateTotal();
            this.showNotification('✅ Expense updated successfully!');
            this.editingExpenseId = null;

            // Reset submit button text
            const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
            submitBtn.textContent = '✅ Confirm & Add Expense';
        }
    }

    displayExpenses() {
        const container = document.getElementById('expensesList');

        if (this.expenses.length === 0) {
            container.innerHTML = '<div class="empty-state">No expenses added yet. Add your first expense above!</div>';
            return;
        }

        const expensesHTML = this.expenses.map((expense, index) => `
            <div class="expense-item" id="expense-${expense.id}">
                <div class="expense-header">
                    <div class="expense-header-left">
                        <input type="checkbox"
                               class="expense-checkbox"
                               id="checkbox-${expense.id}"
                               data-expense-id="${expense.id}"
                               onchange="expenseTracker.updateExportButton()">
                        <label for="checkbox-${expense.id}" class="expense-amount">₹${expense.amount.toFixed(2)}</label>
                    </div>
                    <div class="expense-actions">
                        <button class="edit-btn" onclick="expenseTracker.editExpense(${expense.id})">Edit</button>
                        <button class="delete-btn" onclick="expenseTracker.deleteExpense(${expense.id})">Delete</button>
                    </div>
                </div>
                <div class="expense-details">
                    <div><strong>Date:</strong> ${this.formatDisplayDate(expense.date)}</div>
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

    updateTotal() {
        const total = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        document.getElementById('totalAmount').innerHTML = `<strong>Total Amount: ₹${total.toFixed(2)}</strong>`;
    }

    resetForm() {
        document.getElementById('expenseForm').reset();
        this.setTodayDate();
    }

    saveExpenses() {
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    loadExpenses() {
        const saved = localStorage.getItem('expenses');
        const expenses = saved ? JSON.parse(saved) : [];

        // Sort by date when loading
        expenses.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA - dateB;
        });

        return expenses;
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

    generatePDF() {
        if (this.expenses.length === 0) {
            alert('No expenses to export!');
            return;
        }

        // Collect all images from all expenses
        const allImages = [];
        this.expenses.forEach((expense, expenseIndex) => {
            expense.images.forEach((image, imageIndex) => {
                allImages.push({
                    data: image.data,
                    label: `Bill ${expenseIndex + 1}`,
                    expense: expense
                });
            });
        });

        if (allImages.length === 0) {
            alert('No receipt images to export!');
            return;
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

        allImages.forEach((imageItem, index) => {
            // Calculate position on current page
            const positionOnPage = index % imagesPerPage;

            // Add new page if needed
            if (positionOnPage === 0 && index > 0) {
                pdf.addPage();
                currentPage++;
            }

            // Add header on each page
            if (positionOnPage === 0) {
                pdf.setFillColor(45, 55, 72);
                pdf.rect(0, 0, pageWidth, headerHeight, 'F');

                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(255, 255, 255);
                pdf.text('RECEIPT IMAGES', pageWidth / 2, 12, { align: 'center' });

                pdf.setTextColor(0, 0, 0);
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

                // Calculate dimensions to maintain aspect ratio
                const imgAspectRatio = img.width / img.height;
                const boxAspectRatio = imageWidth / imageHeight;

                let finalWidth = imageWidth;
                let finalHeight = imageHeight;
                let offsetX = 0;
                let offsetY = 0;

                if (imgAspectRatio > boxAspectRatio) {
                    // Image is wider - fit to width
                    finalHeight = imageWidth / imgAspectRatio;
                    offsetY = (imageHeight - finalHeight) / 2;
                } else {
                    // Image is taller - fit to height
                    finalWidth = imageHeight * imgAspectRatio;
                    offsetX = (imageWidth - finalWidth) / 2;
                }

                // Add border
                pdf.setDrawColor(200, 200, 200);
                pdf.setLineWidth(0.5);
                pdf.rect(x, y, imageWidth, imageHeight);

                // Add the image with proper aspect ratio
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

        const fileName = `Receipt_Images_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);

        this.showNotification(`✅ PDF with ${allImages.length} receipt images downloaded!`);
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

    clearAllExpenses() {
        if (confirm('Are you sure you want to clear all expenses? This action cannot be undone.')) {
            this.expenses = [];
            this.saveExpenses();
            this.displayExpenses();
            this.updateTotal();
            this.showNotification('All expenses cleared!');
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

    // Google Sheets Integration Methods

    openGoogleSheetsModal() {
        const modal = document.getElementById('googleSheetsModal');
        modal.style.display = 'block';

        // Load configuration (now hardcoded in service)
        document.getElementById('clientId').value = googleSheetsService.CLIENT_ID;
        document.getElementById('apiKey').value = googleSheetsService.API_KEY;
        document.getElementById('sheetId').value = googleSheetsService.SHEET_ID;
        document.getElementById('sheetName').value = googleSheetsService.SHEET_NAME;

        // Disable credential fields since they're hardcoded
        document.getElementById('clientId').readOnly = true;
        document.getElementById('apiKey').readOnly = true;

        // Debug information
        console.log('Google Sheets Service State:');
        console.log('- gapiInited:', googleSheetsService.gapiInited);
        console.log('- gisInited:', googleSheetsService.gisInited);
        console.log('- isAuthenticated:', googleSheetsService.isAuthenticated);
        console.log('- isReady():', googleSheetsService.isReady());

        // Force show the connect button for now to test
        const authorizeBtn = document.getElementById('authorizeGoogle');
        if (authorizeBtn) {
            authorizeBtn.style.display = 'block';
            console.log('Forcing connect button to show');
        }

        // Update auth status
        googleSheetsService.updateAuthStatus();
    }

    closeGoogleSheetsModal() {
        document.getElementById('googleSheetsModal').style.display = 'none';
    }

    async saveGoogleSheetsConfig() {
        const sheetId = document.getElementById('sheetId').value.trim();
        const sheetName = document.getElementById('sheetName').value.trim();

        if (!sheetId || !sheetName) {
            this.showNotification('⚠️ Please fill in sheet ID and name');
            return;
        }

        try {
            // Save sheet config (credentials are hardcoded)
            googleSheetsService.setSheetConfig(sheetId, sheetName);

            // Try to initialize APIs if not ready
            let gapiReady = googleSheetsService.gapiInited;
            let gisReady = googleSheetsService.gisInited;

            if (!gapiReady) {
                gapiReady = await googleSheetsService.initializeGapi();
            }
            if (!gisReady) {
                gisReady = googleSheetsService.initializeGis();
            }

            if (gapiReady && gisReady) {
                this.showNotification('✅ Google Sheets configuration saved successfully!');
            } else {
                this.showNotification('⚠️ Configuration saved but Google APIs are still loading...');
            }

            googleSheetsService.updateAuthStatus();
        } catch (error) {
            console.error('Error saving Google Sheets config:', error);
            this.showNotification('❌ Error saving configuration: ' + error.message);
        }
    }

    async initializeGoogleApis() {
        const button = document.getElementById('initializeApis');
        const originalText = button.textContent;
        button.textContent = '⏳ Initializing...';
        button.disabled = true;

        try {
            console.log('Manual API initialization started');
            console.log('Current URL:', window.location.href);
            console.log('Is HTTPS?', window.location.protocol === 'https:');
            console.log('Is localhost?', window.location.hostname === 'localhost');

            // Check if we're using file:// protocol
            if (window.location.protocol === 'file:') {
                this.showNotification('⚠️ Google APIs may not work with file:// URLs. Try using a local server (http://localhost).');
            }

            // Initialize both APIs
            const gapiSuccess = await googleSheetsService.initializeGapi();
            const gisSuccess = googleSheetsService.initializeGis();

            console.log('Manual init results - GAPI:', gapiSuccess, 'GIS:', gisSuccess);

            if (gapiSuccess && gisSuccess) {
                this.showNotification('✅ Google APIs initialized successfully!');
                googleSheetsService.updateAuthStatus();
            } else {
                let errorMsg = '⚠️ Some APIs failed to initialize:\n';
                if (!gapiSuccess) errorMsg += '- Google API (gapi) failed\n';
                if (!gisSuccess) errorMsg += '- Google Identity Services failed\n';
                errorMsg += 'Check browser console for details.';
                this.showNotification(errorMsg);
            }
        } catch (error) {
            console.error('Manual initialization error:', error);
            this.showNotification('❌ Failed to initialize APIs: ' + error.message);
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    async authorizeGoogle() {
        console.log('authorizeGoogle() called');
        try {
            if (!googleSheetsService.isReady()) {
                this.showNotification('⚠️ Please initialize Google APIs first!');
                return;
            }

            await googleSheetsService.authenticate();
            this.showNotification('🔐 Google authentication initiated!');
        } catch (error) {
            console.error('Authentication error:', error);
            this.showNotification('❌ Authentication failed: ' + error.message);
        }
    }

    signOutGoogle() {
        googleSheetsService.signOut();
        this.showNotification('🔓 Signed out from Google successfully');
    }

    async testGoogleConnection() {
        try {
            const result = await googleSheetsService.testConnection();
            if (result.success) {
                this.showNotification('✅ ' + result.message);
            } else {
                this.showNotification('❌ ' + result.message);
            }
        } catch (error) {
            console.error('Connection test error:', error);
            this.showNotification('❌ Connection test failed: ' + error.message);
        }
    }

    updateExportButton() {
        const checkboxes = document.querySelectorAll('.expense-checkbox:checked');
        const exportBtn = document.getElementById('exportToGoogleSheets');
        const btnText = exportBtn.querySelector('.btn-text');

        if (checkboxes.length > 0) {
            btnText.textContent = `Export Selected (${checkboxes.length})`;
            exportBtn.style.display = 'block';
        } else {
            btnText.textContent = 'Export to Google Sheets';
        }
    }

    getSelectedExpenses() {
        const checkboxes = document.querySelectorAll('.expense-checkbox:checked');
        const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.expenseId));
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
}

const expenseTracker = new ExpenseTracker();