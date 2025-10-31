class ExpenseTracker {
    constructor() {
        this.expenses = [];
        this.scannedImages = [];
        this.extractedData = {};
        this.extractedExpenses = []; // Store multiple extracted bills for batch upload
        this.lastSyncedIndex = this.loadLastSyncedIndex(); // Track last synced expense
        this.editingExpenseId = null; // Track which expense is being edited

        // Search and filter state
        this.filteredExpenses = [];
        this.searchTerm = '';

        // Performance optimization flags
        this.isProcessingImages = false;
        this.uploadProgress = 0;
        this.filterCategory = '';
        this.filterDateFrom = '';
        this.filterDateTo = '';

        // Pagination state
        this.currentPage = 1;
        this.pageSize = 25;

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

        // Initialize theme system
        this.initializeTheme();

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
            // Copy files to main billImages input using DataTransfer API
            const dt = new DataTransfer();
            Array.from(e.target.files).forEach(file => dt.items.add(file));
            document.getElementById('billImages').files = dt.files;
            this.handleImageUpload({ target: document.getElementById('billImages') });
        });
        document.getElementById('galleryInput').addEventListener('change', (e) => {
            // Copy files to main billImages input using DataTransfer API
            const dt = new DataTransfer();
            Array.from(e.target.files).forEach(file => dt.items.add(file));
            document.getElementById('billImages').files = dt.files;
            this.handleImageUpload({ target: document.getElementById('billImages') });
        });

        // Initialize drag and drop functionality
        this.initializeDragAndDrop();

        document.getElementById('billImages').addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('scanBills').addEventListener('click', () => this.scanBills());
        document.getElementById('skipToManualEntry').addEventListener('click', () => this.showManualEntryForm());
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

        // Image modal removed - feature disabled

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('templateModal')) {
                this.closeTemplateModal();
            }
        });

        // Search and filter event listeners
        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearch');
        const categoryFilter = document.getElementById('categoryFilter');
        const dateFromFilter = document.getElementById('dateFromFilter');
        const dateToFilter = document.getElementById('dateToFilter');
        const resetFiltersBtn = document.getElementById('resetFilters');
        const expandFiltersBtn = document.getElementById('expandFiltersBtn');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            // Also expand filters when user starts typing on mobile
            searchInput.addEventListener('focus', () => {
                if (window.innerWidth <= 768) {
                    this.expandFilters();
                }
            });
        }
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => this.clearSearch());
        }
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => this.handleCategoryFilter(e.target.value));
        }
        if (dateFromFilter) {
            dateFromFilter.addEventListener('change', (e) => this.handleDateFromFilter(e.target.value));
        }
        if (dateToFilter) {
            dateToFilter.addEventListener('change', (e) => this.handleDateToFilter(e.target.value));
        }
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => this.resetFilters());
        }
        if (expandFiltersBtn) {
            expandFiltersBtn.addEventListener('click', () => this.toggleFilters());
        }

        // Pagination event listeners
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        const pageSizeSelect = document.getElementById('pageSize');

        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => this.previousPage());
        }
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => this.nextPage());
        }
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => this.changePageSize(e.target.value));
        }
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

    // Compress image before processing
    async compressImage(file, maxWidth = 1200, quality = 0.8) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions while maintaining aspect ratio
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to blob with compression
                    canvas.toBlob((blob) => {
                        if (blob && blob.size < file.size) {
                            // Only use compressed version if it's smaller
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            console.log(`Compressed ${file.name}: ${(file.size/1024).toFixed(1)}KB → ${(blob.size/1024).toFixed(1)}KB`);
                            resolve(compressedFile);
                        } else {
                            resolve(file); // Return original if compression didn't help
                        }
                    }, 'image/jpeg', quality);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    initializeDragAndDrop() {
        const dropZone = document.getElementById('imagePreview');
        const billImagesInput = document.getElementById('billImages');

        if (!dropZone) {
            console.warn('Image preview element not found');
            return;
        }

        // Prevent default drag behaviors on document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
            }, false);
        });

        // Handle dropped files
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const dt = e.dataTransfer;
            const files = dt.files;

            if (files.length > 0) {
                // Validate that files are images
                const imageFiles = Array.from(files).filter(file => {
                    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];
                    return validTypes.includes(file.type.toLowerCase());
                });

                if (imageFiles.length === 0) {
                    this.showNotification('❌ Please drop only image files (JPEG, PNG, WebP, HEIC, GIF)');
                    return;
                }

                if (imageFiles.length < files.length) {
                    const skipped = files.length - imageFiles.length;
                    this.showNotification(`⚠️ ${skipped} non-image file(s) were skipped`);
                }

                // Create a new DataTransfer object to set files programmatically
                const dataTransfer = new DataTransfer();
                imageFiles.forEach(file => dataTransfer.items.add(file));

                // Set the files to the hidden input
                billImagesInput.files = dataTransfer.files;

                // Trigger the existing handleImageUpload function
                this.handleImageUpload({ target: billImagesInput });

                // Provide visual feedback
                this.showNotification(`✅ ${imageFiles.length} image(s) added successfully!`);
            }
        }, false);

        // Allow clicking on drop zone to open file browser
        dropZone.addEventListener('click', (e) => {
            // Check if clicking on the hint or drop zone when it only has the hint
            const dragHint = document.getElementById('dragDropHint');
            if (e.target.closest('#dragDropHint') || (dropZone.children.length === 1 && dropZone.contains(dragHint))) {
                billImagesInput.click();
            }
        });

        console.log('✅ Drag and drop functionality initialized');
    }

    async handleImageUpload(e) {
        console.log('📸 Image upload triggered');
        const files = Array.from(e.target.files);
        console.log('Files selected:', files.length);

        // File size validation
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
        const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total (for batch uploads)
        const MAX_FILES = 20; // Maximum 20 files for batch upload
        const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];

        // Prevent multiple simultaneous processing
        if (this.isProcessingImages) {
            this.showNotification('⚠️ Please wait for current images to finish processing');
            return;
        }

        this.isProcessingImages = true;

        // Show loading indicator immediately
        const previewContainer = document.getElementById('imagePreview');
        // Hide the drag hint
        const dragHint = document.getElementById('dragDropHint');
        if (dragHint) {
            dragHint.style.display = 'none';
        }

        // Clear existing content but keep the hint element
        const existingContent = previewContainer.querySelectorAll(':not(#dragDropHint)');
        existingContent.forEach(element => element.remove());

        // Add loading overlay
        const loadingDiv = document.createElement('div');
        loadingDiv.innerHTML = `
            <div class="processing-overlay">
                <div class="processing-content">
                    <div class="spinner"></div>
                    <h3>🖼️ Optimizing Images...</h3>
                    <p id="processingStatus">Compressing for faster upload</p>
                    <div class="progress-bar">
                        <div id="progressFill" class="progress-fill" style="width: 0%"></div>
                    </div>
                    <span id="progressText">0%</span>
                </div>
            </div>
        `;
        previewContainer.appendChild(loadingDiv.firstElementChild);

        // Add CSS for the processing overlay if not already present
        if (!document.getElementById('processingStyles')) {
            const style = document.createElement('style');
            style.id = 'processingStyles';
            style.textContent = `
                .processing-overlay {
                    padding: 40px;
                    text-align: center;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    margin: 20px 0;
                }
                .processing-content h3 {
                    margin: 20px 0 10px;
                    color: var(--primary-color);
                }
                .spinner {
                    width: 50px;
                    height: 50px;
                    border: 4px solid rgba(79, 172, 254, 0.2);
                    border-top-color: #4FACFE;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .progress-bar {
                    width: 100%;
                    height: 8px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    overflow: hidden;
                    margin: 15px 0 10px;
                }
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%);
                    transition: width 0.3s ease;
                }
                #progressText {
                    font-size: 14px;
                    color: #4FACFE;
                    font-weight: 600;
                }
                #processingStatus {
                    color: #aaa;
                    font-size: 14px;
                    margin: 10px 0;
                }
            `;
            document.head.appendChild(style);
        }

        try {
            // Validate number of files
            if (files.length > MAX_FILES) {
                this.showNotification(`❌ Too many files selected (${files.length}). Maximum is ${MAX_FILES} files for batch upload.`, 'error');
                e.target.value = '';
                this.isProcessingImages = false;
                return;
            }

            // Show warning for large batches
            if (files.length > 10) {
                console.log(`⚠️ Large batch upload: ${files.length} files. This may take several minutes.`);
            }

            // Validate individual file sizes and types
            for (const file of files) {
                if (!ALLOWED_TYPES.includes(file.type)) {
                    this.showNotification(`❌ Invalid file type: ${file.name}. Only JPG, PNG, and WEBP images are allowed.`, 'error');
                    e.target.value = '';
                    this.isProcessingImages = false;
                    return;
                }

                if (file.size > MAX_FILE_SIZE) {
                    this.showNotification(`❌ File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 5MB per image.`, 'error');
                    e.target.value = '';
                    this.isProcessingImages = false;
                    return;
                }
            }

            // Validate total size
            const totalSize = files.reduce((sum, file) => sum + file.size, 0);
            if (totalSize > MAX_TOTAL_SIZE) {
                this.showNotification(`❌ Total file size too large (${(totalSize / 1024 / 1024).toFixed(2)}MB). Maximum total size is 100MB.`, 'error');
                e.target.value = '';
                this.isProcessingImages = false;
                return;
            }

            console.log(`✅ File validation passed: ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB total`);

            // Clear previous data
            this.scannedImages = [];
            this.extractedData = {};

            // Clear form if not editing
            if (this.editingExpenseId === null) {
                const form = document.getElementById('expenseForm');
                if (form) form.reset();
            }

            if (files.length === 0) {
                document.getElementById('scanBills').style.display = 'none';
                // Clear preview but restore the drag hint
                const previewContainer = document.getElementById('imagePreview');
                const existingItems = previewContainer.querySelectorAll(':not(#dragDropHint)');
                existingItems.forEach(item => item.remove());

                // Show the drag hint again
                const dragHint = document.getElementById('dragDropHint');
                if (dragHint) {
                    dragHint.style.display = 'block';
                }
                previewContainer.className = 'image-preview-container drag-drop-zone';

                this.isProcessingImages = false;
                return;
            }

            // Process and compress images
            const processedImages = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const progressElement = document.getElementById('progressText');
                const progressFill = document.getElementById('progressFill');
                const statusElement = document.getElementById('processingStatus');

                // Update progress
                const progress = Math.round(((i + 1) / files.length) * 100);
                if (progressElement) progressElement.textContent = `${progress}%`;
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (statusElement) statusElement.textContent = `Processing image ${i + 1} of ${files.length}`;

                // Compress image
                const compressedFile = await this.compressImage(file, 1200, 0.85);

                // Read compressed file
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(compressedFile);
                });

                processedImages.push({
                    name: compressedFile.name,
                    data: dataUrl,
                    file: compressedFile
                });
            }

            this.scannedImages = processedImages;

            // Display compressed images
            // Clear existing content but keep the hint element
            const existingItems = previewContainer.querySelectorAll(':not(#dragDropHint)');
            existingItems.forEach(item => item.remove());

            // Hide the drag hint if it exists
            const hint = document.getElementById('dragDropHint');
            if (hint) {
                hint.style.display = 'none';
            }

            previewContainer.className = 'image-preview-container drag-drop-zone has-images';

            // Removed the "Selected Images:" header for cleaner UI

            const imagesWrapper = document.createElement('div');
            // Remove inline styles - let CSS handle the styling
            imagesWrapper.id = 'imagesWrapper';
            previewContainer.appendChild(imagesWrapper);

            // Display all images
            processedImages.forEach((img) => {
                const imageDiv = document.createElement('div');
                imageDiv.className = 'image-preview-item';
                imageDiv.innerHTML = `
                    <div class="thumb-container">
                        <img src="${img.data}" alt="${img.name}" class="thumb-image">
                    </div>
                    <div class="thumb-caption">${img.name}</div>
                `;
                imagesWrapper.appendChild(imageDiv);
            });

            // Show scan button
            const scanBtn = document.getElementById('scanBills');
            if (scanBtn) {
                scanBtn.style.display = 'block';
                console.log('✅ All images processed, scan button shown');
            }

            const savedKB = Math.round((totalSize - processedImages.reduce((sum, img) => sum + img.file.size, 0)) / 1024);
            if (savedKB > 0) {
                this.showNotification(`✅ Images optimized! Saved ${savedKB}KB`);
            }

        } catch (error) {
            console.error('Error processing images:', error);
            this.showError('Failed to process images. Please try again.', 'Processing Error');
        } finally {
            this.isProcessingImages = false;
        }
    }

    async scanBills() {
        if (this.scannedImages.length === 0) {
            this.showError('Please select at least one image to scan.\n\nUse the Camera or Gallery button to add images.', 'No Images Selected');
            return;
        }

        const scanButton = document.getElementById('scanBills');
        const scanText = document.getElementById('scanText');
        const scanProgress = document.getElementById('scanProgress');

        // Safely update UI elements with null checks
        if (scanText) scanText.style.display = 'none';
        if (scanProgress) scanProgress.style.display = 'inline';
        if (scanButton) scanButton.disabled = true;

        // Show enhanced progress indicator
        const progressOverlay = document.createElement('div');
        progressOverlay.id = 'ocrProgressOverlay';
        progressOverlay.innerHTML = `
            <div class="ocr-progress-overlay">
                <div class="ocr-progress-content">
                    <div class="spinner"></div>
                    <h3>🔍 Scanning Bills...</h3>
                    <p id="ocrStatus">Extracting text from images</p>
                    <div class="progress-bar">
                        <div id="ocrProgressFill" class="progress-fill" style="width: 0%"></div>
                    </div>
                    <span id="ocrProgressText">0%</span>
                </div>
            </div>
        `;

        // Add styles for OCR progress
        if (!document.getElementById('ocrProgressStyles')) {
            const style = document.createElement('style');
            style.id = 'ocrProgressStyles';
            style.textContent = `
                .ocr-progress-overlay {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.9);
                    padding: 40px;
                    border-radius: 12px;
                    z-index: 9999;
                    text-align: center;
                    min-width: 300px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                }
                .ocr-progress-content h3 {
                    color: #4FACFE;
                    margin: 20px 0 10px;
                }
                #ocrStatus {
                    color: #aaa;
                    margin: 10px 0;
                }
                #ocrProgressText {
                    color: #4FACFE;
                    font-weight: 600;
                    display: block;
                    margin-top: 10px;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(progressOverlay);

        // Clear previous extracted expenses
        this.extractedExpenses = [];
        let worker = null;

        try {
            // Show initializing status
            document.getElementById('ocrStatus').textContent = 'Initializing OCR engine...';

            // Check if Tesseract is available
            if (typeof Tesseract === 'undefined') {
                throw new Error('Tesseract library not loaded. Please refresh the page and try again.');
            }

            console.log('🔧 Starting Tesseract worker initialization...');

            // Initialize Tesseract worker with timeout and better error handling
            const initTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Tesseract initialization timeout (30s)')), 30000)
            );

            const workerInit = Tesseract.createWorker('eng', 1, {
                logger: m => {
                    console.log('Tesseract:', m.status, m.progress ? `${(m.progress * 100).toFixed(0)}%` : '');
                    if (m.status === 'recognizing text') {
                        const currentProgress = document.getElementById('ocrProgressText');
                        if (currentProgress) {
                            const percent = (m.progress * 100).toFixed(0);
                            currentProgress.textContent = `${percent}%`;
                        }
                    }
                },
                errorHandler: err => {
                    console.error('❌ Tesseract error:', err);
                }
            });

            // Wait for initialization with timeout
            worker = await Promise.race([workerInit, initTimeout]);
            console.log('✅ Tesseract worker initialized successfully');

            // Configure Tesseract for better accuracy with receipts
            console.log('⚙️ Configuring Tesseract parameters...');
            await worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ₹Rs./-:,@&()',
                preserve_interword_spaces: '1',
            });
            console.log('✅ Tesseract configured successfully');

            // Process each image separately for batch upload
            for (let i = 0; i < this.scannedImages.length; i++) {
                const overallProgress = Math.round(((i + 1) / this.scannedImages.length) * 100);

                const ocrProgressFill = document.getElementById('ocrProgressFill');
                const ocrProgressText = document.getElementById('ocrProgressText');
                const ocrStatus = document.getElementById('ocrStatus');

                if (ocrProgressFill) ocrProgressFill.style.width = `${overallProgress}%`;
                if (ocrProgressText) ocrProgressText.textContent = `${overallProgress}%`;
                if (ocrStatus) ocrStatus.textContent = `Scanning bill ${i + 1} of ${this.scannedImages.length}`;

                console.log(`\n📸 Processing bill ${i + 1}/${this.scannedImages.length}...`);
                console.log(`   Image: ${this.scannedImages[i].name}`);
                console.log(`   Size: ${(this.scannedImages[i].file.size / 1024).toFixed(2)} KB`);

                let result = null;
                let ocrText = '';
                let retryCount = 0;
                const maxRetries = 2;

                // Retry logic for individual image OCR
                while (retryCount <= maxRetries) {
                    try {
                        console.log(`   Attempt ${retryCount + 1}/${maxRetries + 1}...`);

                        // Perform OCR on this image with timeout
                        const ocrTimeout = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('OCR timeout for this image (60s)')), 60000)
                        );

                        const ocrPromise = worker.recognize(this.scannedImages[i].data);
                        result = await Promise.race([ocrPromise, ocrTimeout]);

                        ocrText = result.data.text;
                        console.log(`✅ Bill ${i + 1} OCR confidence: ${result.data.confidence.toFixed(2)}%`);
                        console.log(`   Extracted text length: ${ocrText.length} characters`);

                        // Success - break retry loop
                        break;

                    } catch (imageError) {
                        retryCount++;
                        console.error(`❌ OCR failed for bill ${i + 1}, attempt ${retryCount}:`, imageError.message);

                        if (retryCount > maxRetries) {
                            console.warn(`⚠️ Skipping bill ${i + 1} after ${maxRetries + 1} attempts`);
                            // Create expense with empty OCR text (user can edit manually)
                            ocrText = '';
                            result = { data: { confidence: 0, text: '' } };
                        } else {
                            // Wait before retry
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }

                // Extract expense data from this bill (even if OCR failed)
                const expenseData = this.parseReceiptText(ocrText);

                // If OCR failed completely, add default values
                if (!ocrText) {
                    console.warn(`⚠️ Using default values for bill ${i + 1}`);
                    expenseData.amount = expenseData.amount || '';
                    expenseData.vendor = expenseData.vendor || 'Unknown Vendor';
                    expenseData.date = expenseData.date || new Date().toISOString().split('T')[0];
                    expenseData.category = 'Miscellaneous';
                }

                // Store extracted expense with image data
                this.extractedExpenses.push({
                    id: `temp_${Date.now()}_${i}`,
                    imageFile: this.scannedImages[i].file,
                    imageData: this.scannedImages[i].data,
                    imageName: this.scannedImages[i].name,
                    ocrText: ocrText,
                    ocrConfidence: result ? result.data.confidence : 0,
                    ocrFailed: !ocrText, // Flag for failed OCR
                    ...expenseData,
                    selected: true,
                    edited: false
                });

                console.log(`✅ Bill ${i + 1} extracted:`, expenseData);
            }

            // Update status
            if (document.getElementById('ocrStatus')) {
                document.getElementById('ocrStatus').textContent = 'Processing complete!';
            }

            // Check how many had OCR failures
            const failedCount = this.extractedExpenses.filter(e => e.ocrFailed).length;
            const successCount = this.extractedExpenses.length - failedCount;

            console.log(`\n📊 OCR Results:`);
            console.log(`   ✅ Successful: ${successCount}`);
            console.log(`   ⚠️ Failed: ${failedCount}`);
            console.log(`   📝 Total: ${this.extractedExpenses.length}`);

            // If only one bill, use the old single-bill flow
            if (this.extractedExpenses.length === 1) {
                this.extractedData = this.extractedExpenses[0];
                this.populateForm();
                this.showExpenseForm();

                if (this.extractedExpenses[0].ocrFailed) {
                    this.showNotification('⚠️ OCR failed. Please enter details manually.');
                } else {
                    this.showNotification('✅ Bill scanned successfully!');
                }
            } else {
                // Multiple bills - show batch review UI
                this.showBatchReviewUI();

                if (failedCount === 0) {
                    this.showNotification(`✅ All ${this.extractedExpenses.length} bills scanned successfully!`);
                } else if (failedCount === this.extractedExpenses.length) {
                    this.showNotification(`⚠️ OCR failed for all bills. Please edit details manually.`);
                } else {
                    this.showNotification(`✅ ${successCount} bills scanned successfully. ${failedCount} need manual entry.`);
                }
            }

        } catch (error) {
            console.error('❌ Critical OCR Error:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });

            // This catch block only triggers if Tesseract worker fails to initialize
            // Individual image failures are handled in the retry logic above

            let errorMessage = '❌ OCR Engine Failed to Initialize\n\n';

            if (error.message.includes('timeout')) {
                errorMessage += 'The OCR engine took too long to load.\n\n';
                errorMessage += 'Possible causes:\n';
                errorMessage += '• Slow internet connection\n';
                errorMessage += '• Server is slow\n\n';
                errorMessage += '✅ Solution: Refresh the page and try again.';
            } else if (error.message.includes('Tesseract library not loaded')) {
                errorMessage += 'The OCR library failed to load from CDN.\n\n';
                errorMessage += 'Possible causes:\n';
                errorMessage += '• Ad blocker is blocking the script\n';
                errorMessage += '• Network/firewall restrictions\n\n';
                errorMessage += '✅ Solution: Disable ad blocker and refresh.';
            } else {
                errorMessage += `Technical error: ${error.message}\n\n`;
                errorMessage += '✅ Solution: Refresh the page and try again.';
            }

            this.showError(errorMessage, 'OCR Initialization Failed');
            this.showExpenseForm();
        } finally {
            // Clean up
            if (worker) {
                try {
                    await worker.terminate();
                    console.log('✅ Tesseract worker terminated successfully');
                } catch (terminateError) {
                    console.error('⚠️ Error terminating Tesseract worker:', terminateError);
                }
            }

            // Remove progress overlay
            const overlay = document.getElementById('ocrProgressOverlay');
            if (overlay) overlay.remove();

            // Safely restore UI elements with null checks
            const scanButton = document.getElementById('scanBills');
            const scanText = document.getElementById('scanText');
            const scanProgress = document.getElementById('scanProgress');

            if (scanText) scanText.style.display = 'inline';
            if (scanProgress) scanProgress.style.display = 'none';
            if (scanButton) scanButton.disabled = false;
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

        // OCR often confuses similar letters (p→n, c→e, etc.)
        // This map corrects common OCR errors in month names
        const monthOCRCorrections = {
            'sen': 'sep',  // p→n confusion
            'seo': 'sep',  // p→o confusion
            'oet': 'oct',  // c→e confusion
            'oot': 'oct',  // c→o confusion
            'deo': 'dec',  // c→o confusion
            'dee': 'dec',  // c→e confusion
            'aup': 'aug',  // g→p confusion
            'ang': 'aug',  // u→n confusion
            'jnn': 'jan',  // a→n confusion
            'jau': 'jan',  // n→u confusion
            'nay': 'may',  // m→n confusion
            'juu': 'jun',  // n→u confusion
            'jnl': 'jul',  // u→n confusion
            'nop': 'nov',  // v→p confusion
            'nou': 'nov',  // v→u confusion
            'nar': 'mar',  // m→n confusion
            'fen': 'feb',  // b→n confusion
            'fen.': 'feb', // With period
            'sen.': 'sep', // With period
            'oet.': 'oct'  // With period
        };

        // Helper function to find month with OCR error correction
        const findMonth = (monthStr) => {
            const normalized = monthStr.toLowerCase().replace(/\./g, '');

            // Try exact match first
            if (monthNames[normalized] !== undefined) {
                return monthNames[normalized];
            }

            // Try OCR correction
            if (monthOCRCorrections[normalized]) {
                const corrected = monthOCRCorrections[normalized];
                console.log(`   🔧 OCR correction: "${monthStr}" → "${corrected}"`);
                return monthNames[corrected];
            }

            // Try fuzzy match (Levenshtein distance = 1)
            for (const validMonth in monthNames) {
                if (validMonth.length === normalized.length) {
                    let differences = 0;
                    for (let i = 0; i < validMonth.length; i++) {
                        if (validMonth[i] !== normalized[i]) differences++;
                    }
                    if (differences === 1) {
                        console.log(`   🔧 Fuzzy match: "${monthStr}" → "${validMonth}"`);
                        return monthNames[validMonth];
                    }
                }
            }

            return undefined;
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
                                month = findMonth(dateMatch[2]);
                                year = parseInt(dateMatch[3]);
                                break;

                            case 'MDY_NAME':
                                month = findMonth(dateMatch[1]);
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
                                // Use timezone-safe formatting instead of toISOString()
                                const yyyy = year;
                                const mm = String(month + 1).padStart(2, '0'); // month is 0-indexed
                                const dd = String(day).padStart(2, '0');
                                const dateStr = `${yyyy}-${mm}-${dd}`;

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

    showBatchReviewUI() {
        // Hide OCR section
        const ocrSection = document.getElementById('ocrSection');
        if (ocrSection) {
            ocrSection.style.display = 'none';
        }

        // Show batch review modal
        let batchModal = document.getElementById('batchReviewModal');
        if (!batchModal) {
            // Create modal if it doesn't exist
            batchModal = document.createElement('div');
            batchModal.id = 'batchReviewModal';
            batchModal.className = 'modal active';
            document.body.appendChild(batchModal);
        }

        batchModal.innerHTML = `
            <div class="modal-content batch-review-modal-content">
                <div class="modal-header">
                    <h2>📋 Review Scanned Bills (${this.extractedExpenses.length})</h2>
                    <button class="close-modal" onclick="expenseTracker.closeBatchReview()">&times;</button>
                </div>

                <div class="modal-body">
                    <!-- Bulk Actions Bar -->
                    <div class="batch-actions-bar">
                        <div class="batch-selection">
                            <label>
                                <input type="checkbox" id="selectAllBills" checked onchange="expenseTracker.toggleSelectAll(this.checked)">
                                <span>Select All</span>
                            </label>
                            <span class="selection-count" id="selectionCount">${this.extractedExpenses.filter(e => e.selected).length} of ${this.extractedExpenses.length} selected</span>
                        </div>

                        <div class="batch-bulk-actions">
                            <label>
                                <span>Apply vendor to all:</span>
                                <input type="text" id="bulkVendor" placeholder="Enter vendor name" class="bulk-vendor-input">
                                <button class="btn-secondary btn-apply-vendor" onclick="expenseTracker.applyBulkVendor()">Apply</button>
                            </label>
                        </div>
                    </div>

                    <!-- Bills Gallery -->
                    <div class="batch-gallery" id="batchGallery">
                        ${this.renderBatchGallery()}
                    </div>
                </div>

                <div class="modal-footer batch-review-footer">
                    <button class="btn-secondary btn-cancel" onclick="expenseTracker.closeBatchReview()">Cancel</button>
                    <button class="btn-primary btn-submit" onclick="expenseTracker.submitBatchExpenses().catch(e => { console.error('Submit button error:', e); alert('Error submitting bills: ' + e.message); })" id="submitBatchBtn">
                        📤 Submit ${this.extractedExpenses.filter(e => e.selected).length} Selected Bills
                    </button>
                </div>
            </div>
        `;

        batchModal.style.display = 'flex';
        batchModal.classList.add('active');

        // Ensure initial selection state is correct
        // Since "Select All" checkbox is checked by default, ensure all bills are selected
        const selectAllCheckbox = document.getElementById('selectAllBills');
        if (selectAllCheckbox && selectAllCheckbox.checked) {
            // Make sure all expenses are selected to match the checkbox state
            this.extractedExpenses.forEach(expense => expense.selected = true);
            this.updateSelectionCount();
            this.updateSubmitButton();
        }
    }

    renderBatchGallery() {
        return this.extractedExpenses.map((expense, index) => `
            <div class="batch-card ${expense.selected ? 'selected' : ''} ${expense.ocrFailed ? 'ocr-failed' : ''}" data-index="${index}">
                <div class="card-checkbox">
                    <input type="checkbox" ${expense.selected ? 'checked' : ''}
                           onchange="expenseTracker.toggleBillSelection(${index}, this.checked)">
                </div>

                <div class="card-image">
                    <img src="${expense.imageData}" alt="Bill ${index + 1}">
                    ${expense.ocrFailed ? `
                        <div class="card-ocr-failed" title="OCR failed - please enter details manually">
                            <span>⚠️ Manual Entry Required</span>
                        </div>
                    ` : `
                        <div class="card-confidence">
                            <span title="OCR Confidence">${expense.ocrConfidence.toFixed(0)}%</span>
                        </div>
                    `}
                </div>

                <div class="card-content">
                    <div class="card-amount">₹${expense.amount || '0'}</div>
                    <div class="card-details">
                        <div class="detail-row">
                            <span class="label">Vendor:</span>
                            <input type="text" class="inline-input" value="${expense.vendor || ''}"
                                   onchange="expenseTracker.updateExpenseField(${index}, 'vendor', this.value)">
                        </div>
                        <div class="detail-row">
                            <span class="label">Date:</span>
                            <input type="date" class="inline-input" value="${expense.date || ''}"
                                   onchange="expenseTracker.updateExpenseField(${index}, 'date', this.value)">
                        </div>
                        <div class="detail-row">
                            <span class="label">Amount:</span>
                            <input type="number" class="inline-input" value="${expense.amount || ''}" step="0.01"
                                   onchange="expenseTracker.updateExpenseField(${index}, 'amount', this.value)">
                        </div>
                        <div class="detail-row">
                            <span class="label">Category:</span>
                            <select class="inline-input" onchange="expenseTracker.updateExpenseField(${index}, 'category', this.value)">
                                <option value="Transportation" ${expense.category === 'Transportation' ? 'selected' : ''}>Transportation</option>
                                <option value="Accommodation" ${expense.category === 'Accommodation' ? 'selected' : ''}>Accommodation</option>
                                <option value="Meals" ${expense.category === 'Meals' ? 'selected' : ''}>Meals</option>
                                <option value="Fuel" ${expense.category === 'Fuel' ? 'selected' : ''}>Fuel</option>
                                <option value="Miscellaneous" ${expense.category === 'Miscellaneous' ? 'selected' : ''}>Miscellaneous</option>
                            </select>
                        </div>
                    </div>

                    <button class="btn-delete" onclick="expenseTracker.removeBillFromBatch(${index})" title="Remove this bill">
                        🗑️ Remove
                    </button>
                </div>
            </div>
        `).join('');
    }

    toggleSelectAll(checked) {
        this.extractedExpenses.forEach(expense => expense.selected = checked);
        this.updateBatchUI();
    }

    toggleBillSelection(index, checked) {
        this.extractedExpenses[index].selected = checked;
        this.updateSelectionCount();
        this.updateSubmitButton();
    }

    updateExpenseField(index, field, value) {
        this.extractedExpenses[index][field] = value;
        this.extractedExpenses[index].edited = true;
        console.log(`Updated bill ${index + 1} ${field}:`, value);
    }

    applyBulkVendor() {
        const vendor = document.getElementById('bulkVendor').value.trim();
        if (!vendor) {
            this.showError('Please enter a vendor name', 'Bulk Edit');
            return;
        }

        this.extractedExpenses.forEach(expense => {
            if (expense.selected) {
                expense.vendor = vendor;
                expense.edited = true;
            }
        });

        this.updateBatchUI();
        this.showNotification(`✅ Applied vendor "${vendor}" to ${this.extractedExpenses.filter(e => e.selected).length} bills`);
    }

    removeBillFromBatch(index) {
        if (confirm('Remove this bill from the batch?')) {
            this.extractedExpenses.splice(index, 1);
            this.updateBatchUI();
        }
    }

    updateBatchUI() {
        const gallery = document.getElementById('batchGallery');
        if (gallery) {
            gallery.innerHTML = this.renderBatchGallery();
        }
        this.updateSelectionCount();
        this.updateSubmitButton();
    }

    updateSelectionCount() {
        const selectedCount = this.extractedExpenses.filter(e => e.selected).length;
        const countElement = document.getElementById('selectionCount');
        if (countElement) {
            countElement.textContent = `${selectedCount} of ${this.extractedExpenses.length} selected`;
        }

        const selectAllCheckbox = document.getElementById('selectAllBills');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = selectedCount === this.extractedExpenses.length;
        }
    }

    updateSubmitButton() {
        const selectedCount = this.extractedExpenses.filter(e => e.selected).length;
        const submitBtn = document.getElementById('submitBatchBtn');
        if (submitBtn) {
            submitBtn.textContent = `📤 Submit ${selectedCount} Selected Bill${selectedCount !== 1 ? 's' : ''}`;
            submitBtn.disabled = selectedCount === 0;
        }
    }

    closeBatchReview() {
        const modal = document.getElementById('batchReviewModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }

        // Show OCR section again
        const ocrSection = document.getElementById('ocrSection');
        if (ocrSection) {
            ocrSection.style.display = 'block';
        }

        // Clear scanned images
        this.scannedImages = [];
        this.extractedExpenses = [];
        const imagePreview = document.getElementById('imagePreview');
        if (imagePreview) {
            imagePreview.innerHTML = '<p>No images selected</p>';
        }
    }

    async submitBatchExpenses() {
        console.log('Submit button clicked');
        console.log('All expenses:', this.extractedExpenses);
        console.log('Selected state of expenses:', this.extractedExpenses.map(e => ({ vendor: e.vendor, selected: e.selected })));

        const selectedExpenses = this.extractedExpenses.filter(e => e.selected);
        console.log('Selected expenses count:', selectedExpenses.length);
        console.log('Selected expenses details:', selectedExpenses.map(e => ({
            vendor: e.vendor,
            amount: e.amount,
            hasImageFile: !!e.imageFile,
            hasImageData: !!e.imageData,
            imageName: e.imageName
        })));

        if (selectedExpenses.length === 0) {
            console.warn('No bills selected for submission');
            this.showError('Please select at least one bill to submit', 'No Bills Selected');
            return;
        }

        // Validate that expenses have required data
        const invalidExpenses = selectedExpenses.filter(e => !e.amount || parseFloat(e.amount) <= 0);
        if (invalidExpenses.length > 0) {
            console.warn('Found expenses with invalid amounts:', invalidExpenses);
            this.showError(`${invalidExpenses.length} bill(s) have invalid or missing amounts. Please correct them before submitting.`, 'Invalid Data');
            return;
        }

        // Show progress modal
        const progressModal = document.createElement('div');
        progressModal.id = 'batchUploadProgress';
        progressModal.className = 'modal active';
        progressModal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>📤 Uploading Bills...</h3>
                </div>
                <div class="modal-body" style="text-align: center; padding: 30px;">
                    <div class="upload-progress-info">
                        <img id="currentBillImage" src="" alt="Current bill" style="max-width: 200px; max-height: 150px; margin-bottom: 20px; border-radius: 8px;">
                        <p id="uploadStatus" style="font-size: 18px; margin: 10px 0;">Uploading bill 1 of ${selectedExpenses.length}...</p>
                        <div class="progress-bar" style="width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin: 20px 0;">
                            <div id="uploadProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #4FACFE, #00F2FE); transition: width 0.3s;"></div>
                        </div>
                        <p id="uploadPercentage" style="font-weight: 600; color: #4FACFE;">0%</p>
                    </div>
                    <div id="uploadResults" style="margin-top: 20px; display: none;">
                        <h4 style="color: #4FACFE;">Upload Complete!</h4>
                        <p id="uploadSummary"></p>
                        <button class="btn-primary" onclick="expenseTracker.finishBatchUpload()" style="margin-top: 20px;">Done</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(progressModal);

        // Upload each expense
        let successCount = 0;
        let failCount = 0;
        const failedExpenses = [];

        for (let i = 0; i < selectedExpenses.length; i++) {
            const expense = selectedExpenses[i];
            const progress = Math.round(((i + 1) / selectedExpenses.length) * 100);

            // Update progress UI
            document.getElementById('currentBillImage').src = expense.imageData;
            document.getElementById('uploadStatus').textContent = `Uploading bill ${i + 1} of ${selectedExpenses.length}...`;
            document.getElementById('uploadProgressBar').style.width = `${progress}%`;
            document.getElementById('uploadPercentage').textContent = `${progress}%`;

            try {
                // Create expense data object
                const expenseData = {
                    date: expense.date || new Date().toISOString().split('T')[0],
                    time: expense.time || new Date().toTimeString().slice(0, 5),
                    category: expense.category || 'Miscellaneous',
                    amount: expense.amount || 0,
                    vendor: expense.vendor || 'N/A',
                    description: expense.description || `Bill from ${expense.vendor || 'vendor'}`
                };

                // Prepare image files for upload - handle undefined imageFile
                const imageFilesToUpload = [];
                if (expense.imageFile) {
                    imageFilesToUpload.push(expense.imageFile);
                } else if (expense.imageData) {
                    // If no imageFile but imageData exists, try to convert it to a file
                    try {
                        const blob = await fetch(expense.imageData).then(r => r.blob());
                        const file = new File([blob], expense.imageName || `bill_${i + 1}.jpg`, { type: blob.type });
                        imageFilesToUpload.push(file);
                    } catch (imgError) {
                        console.warn(`Could not convert image data to file for bill ${i + 1}:`, imgError);
                    }
                }

                // Upload this expense
                await api.createExpense(expenseData, imageFilesToUpload);
                successCount++;
                console.log(`✅ Uploaded bill ${i + 1}/${selectedExpenses.length}`);

            } catch (error) {
                console.error(`❌ Failed to upload bill ${i + 1}:`, error);
                failCount++;
                failedExpenses.push({ index: i + 1, error: error.message, vendor: expense.vendor });
            }
        }

        // Show results
        document.getElementById('uploadProgressBar').style.width = '100%';
        document.getElementById('uploadProgressBar').style.background = successCount === selectedExpenses.length ?
            'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f59e0b, #d97706)';

        const summaryHtml = `
            <div style="text-align: left; margin-top: 15px;">
                <p style="color: #10b981;">✅ Successfully uploaded: ${successCount}</p>
                ${failCount > 0 ? `<p style="color: #ef4444;">❌ Failed: ${failCount}</p>` : ''}
                ${failedExpenses.length > 0 ? `
                    <details style="margin-top: 10px;">
                        <summary style="cursor: pointer; color: #ef4444;">View failed bills</summary>
                        <ul style="text-align: left; margin-top: 10px;">
                            ${failedExpenses.map(f => `<li>Bill ${f.index} (${f.vendor}): ${f.error}</li>`).join('')}
                        </ul>
                    </details>
                ` : ''}
            </div>
        `;

        document.getElementById('uploadSummary').innerHTML = summaryHtml;
        document.getElementById('uploadResults').style.display = 'block';
        document.querySelector('.upload-progress-info').style.display = 'none';

        // Reload expenses to show new ones
        await this.loadExpenses();
    }

    finishBatchUpload() {
        // Remove progress modal
        const progressModal = document.getElementById('batchUploadProgress');
        if (progressModal) {
            progressModal.remove();
        }

        // Close batch review
        this.closeBatchReview();

        // Show success notification
        this.showNotification('✅ Batch upload complete!');
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

    showManualEntryForm() {
        // Hide OCR section and show form
        document.getElementById('ocrSection').style.display = 'none';
        document.getElementById('expenseFormSection').style.display = 'block';

        // Reset form and set today's date
        document.getElementById('expenseForm').reset();
        this.setTodayDate();

        // Update form heading for manual entry
        const formSection = document.getElementById('expenseFormSection');
        const heading = formSection.querySelector('h2');
        const description = formSection.querySelector('p');
        heading.textContent = '✍️ Enter Expense Details';
        description.textContent = 'Fill in the details for your expense';

        // Reset editing mode
        this.editingExpenseId = null;

        // Clear any extracted data
        this.extractedData = { items: [] };

        // Reset submit button text
        const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
        submitBtn.textContent = '✅ Add Expense';

        // Remove extracted data box if it exists
        const extractedDataDiv = document.getElementById('extractedData');
        if (extractedDataDiv) {
            extractedDataDiv.remove();
        }

        // Clear image preview in OCR section but restore hint
        const previewContainer = document.getElementById('imagePreview');
        const existingItems = previewContainer.querySelectorAll(':not(#dragDropHint)');
        existingItems.forEach(item => item.remove());

        // Show the drag hint again
        const dragHint = document.getElementById('dragDropHint');
        if (dragHint) {
            dragHint.style.display = 'block';
        }
        previewContainer.className = 'image-preview-container drag-drop-zone';

        document.getElementById('scanBills').style.display = 'none';

        // Scroll to form
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    backToScan() {
        document.getElementById('expenseFormSection').style.display = 'none';
        document.getElementById('ocrSection').style.display = 'block';

        // Reset form
        document.getElementById('expenseForm').reset();
        this.setTodayDate();

        // Reset form heading back to default
        const formSection = document.getElementById('expenseFormSection');
        const heading = formSection.querySelector('h2');
        const description = formSection.querySelector('p');
        heading.textContent = '✏️ Review & Edit Details';
        description.textContent = 'Verify the extracted information and make corrections if needed';

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

        // Clear preview but restore the drag hint
        const previewContainer = document.getElementById('imagePreview');
        const existingItems = previewContainer.querySelectorAll(':not(#dragDropHint)');
        existingItems.forEach(item => item.remove());

        // Show the drag hint again
        const dragHint = document.getElementById('dragDropHint');
        if (dragHint) {
            dragHint.style.display = 'block';
        }
        previewContainer.className = 'image-preview-container drag-drop-zone';

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
            this.showError('Please fill in all required fields:\n\n• Date\n• Amount\n• Category\n• Description', 'Required Fields Missing');
            return;
        }

        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            this.showError('Amount must be a positive number greater than zero.\n\nExample: 250.50', 'Invalid Amount');
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

            // Show enhanced upload progress
            const hasImages = expense.images && expense.images.length > 0;

            const uploadOverlay = document.createElement('div');
            uploadOverlay.id = 'uploadProgressOverlay';
            uploadOverlay.innerHTML = `
                <div class="upload-progress-overlay">
                    <div class="upload-progress-content">
                        <div class="spinner"></div>
                        <h3>${hasImages ? '📤 Uploading Bill...' : '💾 Saving Expense...'}</h3>
                        <p id="uploadStatus">${hasImages ? 'Processing images for upload' : 'Saving expense data'}</p>
                        ${hasImages ? `
                            <div class="progress-bar">
                                <div id="uploadProgressFill" class="progress-fill" style="width: 0%"></div>
                            </div>
                            <span id="uploadProgressText">0%</span>
                        ` : ''}
                        <p class="upload-tip">This may take a few moments with large images</p>
                    </div>
                </div>
            `;

            // Add upload progress styles
            if (!document.getElementById('uploadProgressStyles')) {
                const style = document.createElement('style');
                style.id = 'uploadProgressStyles';
                style.textContent = `
                    .upload-progress-overlay {
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
                    }
                    .upload-progress-content {
                        background: linear-gradient(135deg, rgba(15, 15, 35, 0.95), rgba(25, 25, 55, 0.95));
                        padding: 40px;
                        border-radius: 16px;
                        text-align: center;
                        min-width: 350px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                        border: 1px solid rgba(79, 172, 254, 0.2);
                    }
                    .upload-progress-content h3 {
                        color: #4FACFE;
                        margin: 20px 0 15px;
                        font-size: 24px;
                    }
                    #uploadStatus {
                        color: #aaa;
                        margin: 10px 0 20px;
                    }
                    #uploadProgressText {
                        color: #4FACFE;
                        font-weight: 600;
                        display: block;
                        margin-top: 10px;
                        font-size: 18px;
                    }
                    .upload-tip {
                        color: #666;
                        font-size: 12px;
                        margin-top: 20px;
                    }
                `;
                document.head.appendChild(style);
            }

            document.body.appendChild(uploadOverlay);

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
                const uploadStatus = document.getElementById('uploadStatus');
                const uploadProgressFill = document.getElementById('uploadProgressFill');
                const uploadProgressText = document.getElementById('uploadProgressText');

                for (let i = 0; i < expense.images.length; i++) {
                    const img = expense.images[i];

                    // Update progress
                    const progress = Math.round(((i + 1) / expense.images.length) * 50); // 50% for image prep
                    if (uploadStatus) uploadStatus.textContent = `Preparing image ${i + 1} of ${expense.images.length}`;
                    if (uploadProgressFill) uploadProgressFill.style.width = `${progress}%`;
                    if (uploadProgressText) uploadProgressText.textContent = `${progress}%`;

                    const blob = await fetch(img.data).then(r => r.blob());
                    const file = new File([blob], img.name, { type: blob.type });
                    imageFiles.push(file);
                }

                if (uploadStatus) uploadStatus.textContent = 'Uploading to server...';
                if (uploadProgressFill) uploadProgressFill.style.width = '60%';
                if (uploadProgressText) uploadProgressText.textContent = '60%';
            }

            // Call backend API
            const response = await api.createExpense(expenseData, imageFiles);

            if (response.status === 'success') {
                console.log('✅ Expense added to backend successfully');

                // Update progress to 90%
                const uploadProgressFill = document.getElementById('uploadProgressFill');
                const uploadProgressText = document.getElementById('uploadProgressText');
                const uploadStatus = document.getElementById('uploadStatus');

                if (uploadStatus) uploadStatus.textContent = 'Finalizing...';
                if (uploadProgressFill) uploadProgressFill.style.width = '90%';
                if (uploadProgressText) uploadProgressText.textContent = '90%';

                // Reload expenses from backend to stay in sync
                await this.loadExpenses();

                // Complete progress
                if (uploadProgressFill) uploadProgressFill.style.width = '100%';
                if (uploadProgressText) uploadProgressText.textContent = '100%';
                if (uploadStatus) uploadStatus.textContent = 'Complete!';

                // Remove overlay after a brief delay
                setTimeout(() => {
                    const overlay = document.getElementById('uploadProgressOverlay');
                    if (overlay) overlay.remove();
                }, 500);

                this.resetForm();
                this.showNotification('✅ Expense added successfully!');
            } else {
                throw new Error(response.message || 'Failed to add expense');
            }
        } catch (error) {
            console.error('Error adding expense:', error);

            // Remove overlay on error
            const overlay = document.getElementById('uploadProgressOverlay');
            if (overlay) overlay.remove();

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
        const expense = this.expenses.find(exp => exp.id === String(id));
        if (!expense) {
            this.showError('The selected expense could not be found.\n\nIt may have been deleted.', 'Expense Not Found');
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
        const searchFilterContainer = document.getElementById('searchFilterContainer');

        if (this.expenses.length === 0) {
            container.innerHTML = '<div class="empty-state">No expenses added yet. Add your first expense above!</div>';
            selectAllContainer.style.display = 'none';
            if (searchFilterContainer) searchFilterContainer.classList.add('hidden');
            return;
        }

        // Show search/filter and select all if there are expenses
        selectAllContainer.style.display = 'flex';
        if (searchFilterContainer) {
            searchFilterContainer.classList.remove('hidden');

            // Auto-expand filters on mobile if any filter is active
            const filtersWrapper = document.getElementById('filtersWrapper');
            if (filtersWrapper && window.innerWidth <= 768 && this.isFilterActive()) {
                filtersWrapper.classList.remove('collapsed');
                const expandBtn = document.getElementById('expandFiltersBtn');
                if (expandBtn) expandBtn.classList.add('expanded');
            }
        }

        // Use filtered expenses if filters are active, otherwise use all expenses
        const fullList = this.isFilterActive() ? this.filteredExpenses : this.expenses;

        // Show search results info
        if (this.isFilterActive()) {
            this.updateSearchResultsInfo(fullList.length, this.expenses.length);
        }

        if (fullList.length === 0 && this.isFilterActive()) {
            container.innerHTML = '<div class="empty-state">No expenses match your search/filter criteria.</div>';
            return;
        }

        // Apply pagination
        const { paginatedList, totalPages } = this.paginateExpenses(fullList);
        this.updatePaginationControls(fullList.length, totalPages);

        if (paginatedList.length === 0) {
            container.innerHTML = '<div class="empty-state">No expenses on this page.</div>';
            return;
        }

        const expensesHTML = paginatedList.map((expense, index) => `
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
                        <button class="edit-btn" onclick="expenseTracker.editExpense('${expense.id}')">Edit</button>
                        <button class="delete-btn" onclick="expenseTracker.deleteExpense('${expense.id}')">Delete</button>
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
                            <img src="${img.data}" alt="${img.name}">
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');

        container.innerHTML = expensesHTML;
        this.updateExportButton();
        this.populateCategoryFilter();
    }

    // Search and Filter Methods
    isFilterActive() {
        return this.searchTerm || this.filterCategory || this.filterDateFrom || this.filterDateTo;
    }

    applyFilters() {
        let results = [...this.expenses];

        // Apply search term filter
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            results = results.filter(expense =>
                expense.vendor.toLowerCase().includes(term) ||
                expense.description.toLowerCase().includes(term) ||
                expense.category.toLowerCase().includes(term)
            );
        }

        // Apply category filter
        if (this.filterCategory) {
            results = results.filter(expense => expense.category === this.filterCategory);
        }

        // Apply date range filters
        if (this.filterDateFrom) {
            results = results.filter(expense => expense.date >= this.filterDateFrom);
        }

        if (this.filterDateTo) {
            results = results.filter(expense => expense.date <= this.filterDateTo);
        }

        this.filteredExpenses = results;
        this.displayExpenses();
    }

    handleSearch(value) {
        this.searchTerm = value.trim();
        const clearBtn = document.getElementById('clearSearch');
        if (clearBtn) {
            clearBtn.style.display = this.searchTerm ? 'block' : 'none';
        }
        this.applyFilters();
    }

    clearSearch() {
        document.getElementById('searchInput').value = '';
        this.searchTerm = '';
        document.getElementById('clearSearch').style.display = 'none';
        this.applyFilters();
    }

    handleCategoryFilter(value) {
        this.filterCategory = value;
        this.applyFilters();
    }

    handleDateFromFilter(value) {
        this.filterDateFrom = value;
        this.applyFilters();
    }

    handleDateToFilter(value) {
        this.filterDateTo = value;
        this.applyFilters();
    }

    resetFilters() {
        // Clear all filter inputs
        document.getElementById('searchInput').value = '';
        document.getElementById('clearSearch').style.display = 'none';
        document.getElementById('categoryFilter').value = '';
        document.getElementById('dateFromFilter').value = '';
        document.getElementById('dateToFilter').value = '';

        // Reset filter state
        this.searchTerm = '';
        this.filterCategory = '';
        this.filterDateFrom = '';
        this.filterDateTo = '';
        this.filteredExpenses = [];

        // Hide search results info
        const resultsInfo = document.getElementById('searchResults');
        if (resultsInfo) resultsInfo.style.display = 'none';

        this.displayExpenses();
    }

    toggleFilters() {
        const filtersWrapper = document.getElementById('filtersWrapper');
        const expandBtn = document.getElementById('expandFiltersBtn');

        if (filtersWrapper && expandBtn) {
            const isCollapsed = filtersWrapper.classList.contains('collapsed');

            if (isCollapsed) {
                this.expandFilters();
            } else {
                this.collapseFilters();
            }
        }
    }

    expandFilters() {
        const filtersWrapper = document.getElementById('filtersWrapper');
        const expandBtn = document.getElementById('expandFiltersBtn');

        if (filtersWrapper && expandBtn) {
            filtersWrapper.classList.remove('collapsed');
            expandBtn.classList.add('expanded');
        }
    }

    collapseFilters() {
        const filtersWrapper = document.getElementById('filtersWrapper');
        const expandBtn = document.getElementById('expandFiltersBtn');

        if (filtersWrapper && expandBtn) {
            filtersWrapper.classList.add('collapsed');
            expandBtn.classList.remove('expanded');
        }
    }

    updateSearchResultsInfo(filtered, total) {
        const resultsInfo = document.getElementById('searchResults');
        if (!resultsInfo) return;

        if (filtered === total) {
            resultsInfo.style.display = 'none';
        } else {
            resultsInfo.style.display = 'block';
            resultsInfo.textContent = `Showing ${filtered} of ${total} expenses`;
        }
    }

    populateCategoryFilter() {
        const categoryFilter = document.getElementById('categoryFilter');
        if (!categoryFilter) return;

        // Get unique categories from expenses
        const categories = [...new Set(this.expenses.map(exp => exp.category))].sort();

        // Keep "All Categories" option and add unique categories
        const currentValue = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categoryFilter.appendChild(option);
        });

        // Restore previous selection if it still exists
        if (currentValue && categories.includes(currentValue)) {
            categoryFilter.value = currentValue;
        }
    }

    // Pagination Methods
    paginateExpenses(expenseList) {
        if (this.pageSize === 'all') {
            return {
                paginatedList: expenseList,
                totalPages: 1
            };
        }

        const size = parseInt(this.pageSize);
        const totalPages = Math.ceil(expenseList.length / size);

        // Ensure current page is within bounds
        if (this.currentPage > totalPages) {
            this.currentPage = Math.max(1, totalPages);
        }

        const startIndex = (this.currentPage - 1) * size;
        const endIndex = startIndex + size;
        const paginatedList = expenseList.slice(startIndex, endIndex);

        return { paginatedList, totalPages };
    }

    updatePaginationControls(totalExpenses, totalPages) {
        const paginationContainer = document.getElementById('paginationContainer');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const paginationInfo = document.getElementById('paginationInfo');

        if (!paginationContainer) return;

        // Show pagination only if there are more expenses than minimum page size OR if showing all
        if (totalExpenses > 10 || this.pageSize === 'all') {
            paginationContainer.style.display = 'flex';
        } else {
            paginationContainer.style.display = 'none';
            return;
        }

        // Update prev/next button states
        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages || this.pageSize === 'all';
        }

        // Update pagination info
        if (paginationInfo) {
            if (this.pageSize === 'all') {
                paginationInfo.textContent = `Showing all ${totalExpenses} expenses`;
            } else {
                const size = parseInt(this.pageSize);
                const startIndex = (this.currentPage - 1) * size + 1;
                const endIndex = Math.min(this.currentPage * size, totalExpenses);
                paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${totalExpenses} expenses`;
            }
        }
    }

    nextPage() {
        const fullList = this.isFilterActive() ? this.filteredExpenses : this.expenses;
        const size = parseInt(this.pageSize);
        const totalPages = Math.ceil(fullList.length / size);

        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.displayExpenses();
            // Scroll to top of expense list
            document.getElementById('expensesList').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.displayExpenses();
            // Scroll to top of expense list
            document.getElementById('expensesList').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    changePageSize(newSize) {
        this.pageSize = newSize;
        this.currentPage = 1; // Reset to first page when changing page size
        this.displayExpenses();
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
            this.showError('You have no expenses to export.\n\nPlease add some expenses first.', 'No Expenses');
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
     * Opens modal to collect employee information first
     */
    async generateCombinedReimbursementPDF() {
        try {
            // Step 1: Check if user has a Google Sheet
            const sheetUrl = googleSheetsService.getSheetUrl();
            if (!sheetUrl) {
                this.showError('You need to export your expenses to Google Sheets first.\n\nThis creates the expense report that will be included in your package.', 'Export to Google Sheets First');
                return;
            }

            // Step 2: Open modal to collect employee information (auto-fills dates from expenses)
            await this.openEmployeeInfoModal();

        } catch (error) {
            console.error('❌ Error initiating PDF download:', error);
            this.showNotification('❌ Failed to start PDF download: ' + error.message);
        }
    }

    /**
     * Generate combined reimbursement package PDF with employee info
     * - Page 1+: User's Google Sheet (expense reimbursement form)
     * - Following pages: All bill receipt images
     * This is called AFTER employee info is collected and sheet is updated
     */
    async generateCombinedReimbursementPDFWithEmployeeInfo() {
        try {
            // Show loading indicator
            this.showLoading('📦 Generating Reimbursement Package...', 'This may take up to 30 seconds');

            // Download Google Sheet as PDF from backend
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

            this.hideLoading();

        } catch (error) {
            console.error('❌ Error generating combined PDF:', error);
            this.hideLoading();

            if (error.message.includes('Google Sheet')) {
                this.showError('Failed to download your Google Sheet PDF.\n\n' + error.message + '\n\nPlease make sure you have exported to Google Sheets first.', 'Google Sheet Error');
            } else if (error.message.includes('No expenses')) {
                this.showError('No bill images found.\n\nAdd some expenses with images or export to Google Sheets first.', 'No Bills Found');
            } else {
                this.showError('Unable to generate the reimbursement package.\n\n' + error.message, 'Package Generation Failed');
            }
        }
    }

    exportJSON() {
        if (this.expenses.length === 0) {
            this.showError('You have no expenses to export.\n\nPlease add some expenses first.', 'No Expenses');
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

    // Image viewer modal feature removed - disabled functions
    openImageModal(imageData, imageName, expenseId, imageIndex) {
        // Feature disabled - image viewer modal removed
    }

    closeImageModal() {
        // Feature disabled - image viewer modal removed
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

    showLoading(message = 'Processing...', subtext = '') {
        // Remove any existing loading overlay
        this.hideLoading();

        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">${message}</div>
            ${subtext ? `<div class="loading-subtext">${subtext}</div>` : ''}
        `;

        document.body.appendChild(overlay);
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.remove();
        }
    }

    showModal(title, message, type = 'info', buttons = [{ text: 'OK', primary: true }]) {
        return new Promise((resolve) => {
            const iconMap = {
                'error': '❌',
                'warning': '⚠️',
                'success': '✅',
                'info': 'ℹ️'
            };

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal-container">
                    <div class="modal-header">
                        <div class="modal-icon ${type}">${iconMap[type] || iconMap.info}</div>
                        <h2 class="modal-title">${title}</h2>
                    </div>
                    <div class="modal-message">${message}</div>
                    <div class="modal-actions">
                        ${buttons.map((btn, i) => `
                            <button class="modal-btn ${btn.primary ? 'modal-btn-primary' : 'modal-btn-secondary'}" data-index="${i}">
                                ${btn.text}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;

            overlay.querySelectorAll('.modal-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const index = parseInt(btn.dataset.index);
                    overlay.remove();
                    resolve(index);
                });
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                    resolve(-1);
                }
            });

            document.body.appendChild(overlay);
        });
    }

    showError(message, title = 'Error') {
        return this.showModal(title, message, 'error');
    }

    showWarning(message, title = 'Warning') {
        return this.showModal(title, message, 'warning');
    }

    showSuccess(message, title = 'Success') {
        return this.showModal(title, message, 'success');
    }

    showInfo(message, title = 'Information') {
        return this.showModal(title, message, 'info');
    }

    async confirm(message, title = 'Confirm') {
        const result = await this.showModal(title, message, 'warning', [
            { text: 'Cancel', primary: false },
            { text: 'Confirm', primary: true }
        ]);
        return result === 1;
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
            btnText.textContent = 'Google Export';
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
            button.querySelector('.btn-text').textContent = 'Exporting...';
            button.disabled = true;

            // Show loading indicator
            this.showLoading(
                `Exporting ${selectedExpenses.length} expense${selectedExpenses.length > 1 ? 's' : ''} to Google Sheets...`,
                'This may take a few seconds'
            );

            console.log(`Exporting ${selectedExpenses.length} selected expenses`);
            const result = await googleSheetsService.exportExpenses(selectedExpenses);

            this.hideLoading();

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
            this.hideLoading();
            this.showNotification('❌ Export failed: ' + error.message);
        } finally {
            const button = document.getElementById('exportToGoogleSheets');
            button.querySelector('.btn-text').textContent = 'Google Export';
            button.disabled = false;
        }
    }

    async resetGoogleSheet() {
        const sheetUrl = googleSheetsService.getSheetUrl();

        if (!sheetUrl) {
            this.showWarning('You don\'t have a Google Sheet yet.\n\nPlease export your expenses to Google Sheets first. This will create your expense report spreadsheet.', 'No Google Sheet');
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
                    <div class="stats-wrapper">
                        <div class="stat-item">
                            <div class="stat-label">Total Images</div>
                            <div class="stat-value">${response.count || 0}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Total Size</div>
                            <div class="stat-value">
                                ${stats.totalSizeMB || '0.00'}
                                <span class="stat-unit">MB</span>
                            </div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Exported</div>
                            <div class="stat-value">${stats.exportedCount || 0}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Expiring Soon</div>
                            <div class="stat-value warning">${stats.expiringWithin7Days || 0}</div>
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
                        <div class="images-grid-wrapper">
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
                                        <div class="image-preview-modern">
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
                                            <button class="btn-extend-modern" data-image-id="${img._id}" onclick="expenseTracker.extendImageExpiry(this.getAttribute('data-image-id'))">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 4v16m8-8H4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                                </svg>
                                                +30 days
                                            </button>
                                            <button class="btn-delete-modern" data-image-id="${img._id}" onclick="expenseTracker.deleteOrphanedImage(this.getAttribute('data-image-id'))">
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

    /**
     * Open employee info modal to collect details before PDF download
     * Auto-fills dates from actual expense data (first and last bill dates)
     */
    async openEmployeeInfoModal() {
        const modal = document.getElementById('employeeInfoModal');
        modal.style.display = 'flex';

        // Set up form submission handler
        const form = document.getElementById('employeeInfoForm');
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleEmployeeInfoSubmit(e);
        });

        // Auto-fill dates from actual expense data
        try {
            // Get the current loaded expenses (they're already sorted by date)
            if (this.expenses && this.expenses.length > 0) {
                // Find earliest and latest dates from expenses
                let earliestDate = null;
                let latestDate = null;

                this.expenses.forEach(expense => {
                    const expenseDate = new Date(expense.date);

                    if (!earliestDate || expenseDate < earliestDate) {
                        earliestDate = expenseDate;
                    }

                    if (!latestDate || expenseDate > latestDate) {
                        latestDate = expenseDate;
                    }
                });

                // Format dates as YYYY-MM-DD for input fields
                if (earliestDate && latestDate) {
                    const fromDate = earliestDate.toISOString().split('T')[0];
                    const toDate = latestDate.toISOString().split('T')[0];

                    console.log(`📅 Auto-filling dates: ${fromDate} to ${toDate}`);

                    document.getElementById('expensePeriodFrom').value = fromDate;
                    document.getElementById('expensePeriodTo').value = toDate;
                } else {
                    // Fallback to default dates if no expenses
                    this.setDefaultDates();
                }
            } else {
                // Fallback to default dates if no expenses loaded
                this.setDefaultDates();
            }
        } catch (error) {
            console.error('Error auto-filling dates:', error);
            // Fallback to default dates on error
            this.setDefaultDates();
        }
    }

    /**
     * Set default date range (first day of month to today)
     */
    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        if (!document.getElementById('expensePeriodFrom').value) {
            document.getElementById('expensePeriodFrom').value = firstDayOfMonth;
        }
        if (!document.getElementById('expensePeriodTo').value) {
            document.getElementById('expensePeriodTo').value = today;
        }
    }

    /**
     * Close employee info modal
     */
    closeEmployeeInfoModal() {
        document.getElementById('employeeInfoModal').style.display = 'none';
        document.getElementById('employeeInfoForm').reset();
    }

    /**
     * Handle employee info form submission
     */
    async handleEmployeeInfoSubmit(e) {
        try {
            const formData = {
                employeeName: document.getElementById('empName').value.trim(),
                employeeCode: document.getElementById('empCode').value.trim() || '',
                expensePeriodFrom: document.getElementById('expensePeriodFrom').value,
                expensePeriodTo: document.getElementById('expensePeriodTo').value,
                businessPurpose: document.getElementById('businessPurpose').value.trim()
            };

            // Validate date range
            if (new Date(formData.expensePeriodFrom) > new Date(formData.expensePeriodTo)) {
                this.showError('"From" date cannot be after "To" date.\n\nPlease adjust your date range.', 'Invalid Date Range');
                return;
            }

            console.log('📋 Employee info collected:', formData);

            // Close modal
            this.closeEmployeeInfoModal();

            // Show loading notification
            this.showNotification('📝 Updating employee details in Google Sheet...');

            // Update Google Sheet with employee information
            await googleSheetsService.updateEmployeeInfo(formData);

            this.showNotification('✅ Employee details updated! Generating PDF...');

            // Wait a bit to ensure Google Sheets is updated
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Proceed with PDF download
            await this.generateCombinedReimbursementPDFWithEmployeeInfo();

        } catch (error) {
            console.error('❌ Error updating employee info:', error);
            this.showError('Failed to update employee information.\n\n' + (error.message || 'Please try again.'), 'Update Failed');
        }
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

    /**
     * ================================================
     * THEME SYSTEM
     * ================================================
     */

    /**
     * Initialize theme system - load saved theme preference
     */
    initializeTheme() {
        // Get saved theme from localStorage, default to 'cyberpunk'
        const savedTheme = localStorage.getItem('expenseTrackerTheme') || 'cyberpunk';

        // Apply theme
        this.applyTheme(savedTheme);

        console.log(`🎨 Theme initialized: ${savedTheme}`);
    }

    /**
     * Toggle between cyberpunk, teal, and minimalist themes
     */
    toggleTheme() {
        // Get current theme
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'cyberpunk';

        // Cycle through themes: cyberpunk -> teal -> minimalist -> cyberpunk
        let newTheme;
        if (currentTheme === 'cyberpunk') {
            newTheme = 'teal';
        } else if (currentTheme === 'teal') {
            newTheme = 'minimalist';
        } else {
            newTheme = 'cyberpunk';
        }

        // Apply and save new theme
        this.applyTheme(newTheme);
        localStorage.setItem('expenseTrackerTheme', newTheme);

        // Show notification
        const themeNames = {
            'cyberpunk': 'Cyberpunk',
            'teal': 'Teal Business',
            'minimalist': 'Green Minimal'
        };

        this.showNotification(`🎨 Theme changed to ${themeNames[newTheme]}`);

        console.log(`🎨 Theme toggled to: ${newTheme}`);
    }

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        // Set data-theme attribute on html element
        document.documentElement.setAttribute('data-theme', theme);

        // Update theme button UI
        this.updateThemeButtonUI(theme);
    }

    /**
     * Update theme button icon and label
     */
    updateThemeButtonUI(theme) {
        const themeIcon = document.getElementById('themeIcon');
        const themeLabel = document.getElementById('themeLabel');

        if (theme === 'cyberpunk') {
            if (themeIcon) themeIcon.textContent = '🌈';
            if (themeLabel) themeLabel.textContent = 'Cyberpunk';
        } else if (theme === 'teal') {
            if (themeIcon) themeIcon.textContent = '🌊';
            if (themeLabel) themeLabel.textContent = 'Teal Business';
        } else if (theme === 'minimalist') {
            if (themeIcon) themeIcon.textContent = '🌿';
            if (themeLabel) themeLabel.textContent = 'Green Minimal';
        }
    }
}

// Create global expenseTracker instance
window.expenseTracker = new ExpenseTracker();