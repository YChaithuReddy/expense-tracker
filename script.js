class ExpenseTracker {
    constructor() {
        this.expenses = this.loadExpenses();
        this.scannedImages = [];
        this.extractedData = {};
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
        document.getElementById('generateExcel').addEventListener('click', () => this.generateExcel());
        document.getElementById('generatePDF').addEventListener('click', () => this.generatePDF());
        document.getElementById('clearAll').addEventListener('click', () => this.clearAllExpenses());

        // Template configuration
        document.getElementById('configureTemplate').addEventListener('click', () => this.openTemplateModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeTemplateModal());
        document.querySelector('.close').addEventListener('click', () => this.closeTemplateModal());
        document.getElementById('saveTemplate').addEventListener('click', () => this.saveTemplateConfig());
        document.getElementById('resetTemplate').addEventListener('click', () => this.resetTemplateConfig());
        document.getElementById('templateFile').addEventListener('change', (e) => this.handleTemplateUpload(e));


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
        for (const line of lines) {
            // Look for ₹80, Rs 80, 80 Rs, Amount 80, etc.
            const amountPatterns = [
                /₹\s*(\d+(?:[.,]\d{1,2})?)/i,
                /rs\.?\s*(\d+(?:[.,]\d{1,2})?)/i,
                /(\d+(?:[.,]\d{1,2})?)\s*₹/i,
                /(\d+(?:[.,]\d{1,2})?)\s*rs/i,
                /(?:amount|total|sum|paid)[\s:]*₹?\s*(\d+(?:[.,]\d{1,2})?)/i,
                /rupees\s+(\w+)/i // for "Rupees Eighty" text
            ];

            for (const pattern of amountPatterns) {
                const match = line.match(pattern);
                if (match) {
                    let amount = match[1];

                    // Handle text amounts like "Eighty"
                    if (isNaN(amount)) {
                        const textNumbers = {
                            'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
                            'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
                            'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
                            'hundred': 100, 'thousand': 1000
                        };
                        amount = textNumbers[amount.toLowerCase()] || 0;
                    }

                    if (amount && parseFloat(amount) > 0) {
                        data.amount = parseFloat(amount.toString().replace(',', '.')).toString();
                        break;
                    }
                }
            }
            if (data.amount) break;
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

        // Generate description
        if (data.vendor && data.category !== 'Miscellaneous') {
            data.description = `${data.category} - ${data.vendor}`;
        } else if (data.vendor) {
            data.description = data.vendor;
        } else {
            data.description = `${data.category} expense`;
        }

        console.log('Parsed data:', data); // Debug log
        return data;
    }

    populateForm() {
        // Populate form fields with extracted data
        if (this.extractedData.date) {
            document.getElementById('date').value = this.extractedData.date;
        }
        if (this.extractedData.category) {
            document.getElementById('category').value = this.extractedData.category;
        }
        if (this.extractedData.description) {
            document.getElementById('description').value = this.extractedData.description;
        }
        if (this.extractedData.amount) {
            document.getElementById('amount').value = this.extractedData.amount;
        }
        if (this.extractedData.vendor) {
            document.getElementById('vendor').value = this.extractedData.vendor;
        }

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

        // Add debugging info to form
        const debugInfo = document.createElement('div');
        debugInfo.style.cssText = `
            background: rgba(0, 212, 255, 0.1);
            border: 1px solid rgba(0, 212, 255, 0.3);
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 20px;
            font-size: 12px;
            color: var(--text-secondary);
        `;
        debugInfo.innerHTML = `
            <strong>🔍 Extracted Data:</strong><br>
            Amount: ${this.extractedData.amount || 'Not found'}<br>
            Vendor: ${this.extractedData.vendor || 'Not found'}<br>
            Date: ${this.extractedData.date || 'Not found'}<br>
            Category: ${this.extractedData.category || 'Not found'}
        `;

        const form = document.getElementById('expenseForm');
        form.insertBefore(debugInfo, form.firstChild);
    }

    backToScan() {
        document.getElementById('expenseFormSection').style.display = 'none';
        document.getElementById('ocrSection').style.display = 'block';

        // Reset form
        document.getElementById('expenseForm').reset();
        this.setTodayDate();

        // Remove debug info if it exists
        const existingDebug = document.querySelector('#expenseForm div[style*="rgba(0, 212, 255, 0.1)"]');
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
            this.processImages(files, expense);
        } else {
            this.addExpense(expense);
            // After successful submission, go back to scan mode
            this.backToScan();
        }
    }

    processImages(files, expense) {
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
                    this.addExpense(expense);
                    // After successful submission, go back to scan mode
                    this.backToScan();
                }
            };
            reader.readAsDataURL(file);
        });
    }

    addExpense(expense) {
        console.log('Adding expense to list:', expense); // Debug log
        this.expenses.push(expense);
        this.saveExpenses();
        this.displayExpenses();
        this.updateTotal();
        this.resetForm();
        this.showNotification('✅ Expense added successfully!');
        console.log('Total expenses now:', this.expenses.length); // Debug log
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

    displayExpenses() {
        const container = document.getElementById('expensesList');

        if (this.expenses.length === 0) {
            container.innerHTML = '<div class="empty-state">No expenses added yet. Add your first expense above!</div>';
            return;
        }

        const expensesHTML = this.expenses.map(expense => `
            <div class="expense-item">
                <div class="expense-header">
                    <span class="expense-amount">₹${expense.amount.toFixed(2)}</span>
                    <button class="delete-btn" onclick="expenseTracker.deleteExpense(${expense.id})">Delete</button>
                </div>
                <div class="expense-details">
                    <div><strong>Date:</strong> ${new Date(expense.date).toLocaleDateString()}</div>
                    <div><strong>Category:</strong> ${expense.category}</div>
                    <div><strong>Description:</strong> ${expense.description}</div>
                    <div><strong>Vendor:</strong> ${expense.vendor}</div>
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
        return saved ? JSON.parse(saved) : [];
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
                    label: `Bill ${expenseIndex + 1}-${imageIndex + 1}`,
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
        const margin = 15;
        const availableWidth = pageWidth - (2 * margin);
        const availableHeight = pageHeight - (2 * margin) - 40; // Reserve 40mm for header

        // Card layout: 2x2 grid (4 cards per page)
        const imagesPerRow = 2;
        const imagesPerColumn = 2;
        const cardWidth = (availableWidth / imagesPerRow) - 15; // 15mm gap between cards
        const cardHeight = (availableHeight / imagesPerColumn) - 20; // 20mm gap between cards
        const imageWidth = cardWidth - 6; // Image fits inside card with padding
        const imageHeight = cardHeight - 8; // Image height minus header space

        let currentPage = 1;
        let imageCount = 0;

        // Add professional header to first page
        pdf.setFillColor(45, 55, 72); // Dark blue background
        pdf.rect(0, 0, pageWidth, 35, 'F');

        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255); // White text
        pdf.text('RECEIPT IMAGES - EXPENSE REIMBURSEMENT', pageWidth / 2, 15, { align: 'center' });

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, pageWidth / 2, 25, { align: 'center' });

        pdf.setFontSize(10);
        pdf.text(`Total Images: ${allImages.length}`, pageWidth / 2, 32, { align: 'center' });

        pdf.setTextColor(0, 0, 0); // Reset to black text
        let startY = 50; // Start below header

        allImages.forEach((imageItem, index) => {
            // Calculate position in grid
            const row = Math.floor(imageCount / imagesPerRow);
            const col = imageCount % imagesPerRow;

            // Calculate card position
            const cardX = margin + (col * (cardWidth + 15));
            const cardY = startY + (row * (cardHeight + 20));

            // Calculate image position within card
            const x = cardX + 3;
            const y = cardY + 8;

            try {
                // Add card background
                pdf.setFillColor(248, 250, 252); // Light gray background
                pdf.rect(cardX, cardY, cardWidth, cardHeight, 'F');

                // Add card border
                pdf.setDrawColor(203, 213, 225); // Light border
                pdf.setLineWidth(0.5);
                pdf.rect(cardX, cardY, cardWidth, cardHeight);

                // Add blue header bar
                pdf.setFillColor(59, 130, 246); // Blue header
                pdf.rect(cardX, cardY, cardWidth, 8, 'F');

                // Add receipt title in header
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(255, 255, 255);
                pdf.text(imageItem.label, cardX + (cardWidth / 2), cardY + 5, { align: 'center' });

                // Add image with shadow effect
                pdf.setFillColor(200, 200, 200); // Shadow
                pdf.rect(x + 2, y + 2, imageWidth, imageHeight, 'F');

                // Add the actual image
                pdf.addImage(imageItem.data, 'JPEG', x, y, imageWidth, imageHeight, '', 'MEDIUM');

                // Add image border
                pdf.setDrawColor(156, 163, 175);
                pdf.setLineWidth(1);
                pdf.rect(x, y, imageWidth, imageHeight);

                pdf.setTextColor(0, 0, 0); // Reset color

            } catch (error) {
                console.error('Error adding image to PDF:', error);
                // Add card-style error placeholder
                pdf.setFillColor(254, 226, 226); // Light red background
                pdf.rect(cardX, cardY, cardWidth, cardHeight, 'F');

                pdf.setDrawColor(248, 113, 113); // Red border
                pdf.setLineWidth(1);
                pdf.rect(cardX, cardY, cardWidth, cardHeight);

                // Add red header bar
                pdf.setFillColor(239, 68, 68); // Red header
                pdf.rect(cardX, cardY, cardWidth, 8, 'F');

                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(255, 255, 255);
                pdf.text(imageItem.label, cardX + (cardWidth / 2), cardY + 5, { align: 'center' });

                pdf.setFontSize(14);
                pdf.setTextColor(185, 28, 28); // Red text
                pdf.text('IMAGE ERROR', cardX + (cardWidth / 2), cardY + (cardHeight / 2), { align: 'center' });

                pdf.setTextColor(0, 0, 0); // Reset color
            }

            imageCount++;

            // Check if we need a new page (4 images per page)
            if (imageCount % 4 === 0 && index < allImages.length - 1) {
                pdf.addPage();
                currentPage++;
                imageCount = 0;
                startY = 50; // Reset Y position for new page

                // Add professional header to new page
                pdf.setFillColor(45, 55, 72); // Dark blue background
                pdf.rect(0, 0, pageWidth, 35, 'F');

                pdf.setFontSize(18);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(255, 255, 255);
                pdf.text(`RECEIPT IMAGES - PAGE ${currentPage}`, pageWidth / 2, 15, { align: 'center' });

                pdf.setFontSize(10);
                pdf.text(`Continued from previous page`, pageWidth / 2, 25, { align: 'center' });

                pdf.setTextColor(0, 0, 0); // Reset color
            }
        });

        // Add professional footer with page numbers
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);

            // Add footer line
            pdf.setDrawColor(203, 213, 225);
            pdf.setLineWidth(0.5);
            pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

            // Add page numbers
            pdf.setFontSize(9);
            pdf.setTextColor(107, 114, 128);
            pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });

            // Add generation info on first page
            if (i === 1) {
                pdf.text(`Generated by Expense Tracker`, margin, pageHeight - 8);
            }
        }

        const fileName = `Receipt_Images_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);

        this.showNotification(`PDF with ${allImages.length} receipt images downloaded!`);
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
}

const expenseTracker = new ExpenseTracker();