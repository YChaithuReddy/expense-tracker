/**
 * Camera and OCR Enhancement Module
 * Handles camera capture, image preprocessing, and OCR extraction
 */

class CameraOCRHandler {
    constructor(expenseTracker) {
        this.expenseTracker = expenseTracker;
        this.stream = null;
        this.currentFacingMode = 'environment'; // Start with back camera
        this.capturedImageData = null;

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Upload Bill button
        document.getElementById('uploadBillBtn').addEventListener('click', () => {
            this.handleUploadBill();
        });

        // Scan Bill button (camera)
        document.getElementById('scanBillBtn').addEventListener('click', () => {
            this.handleScanBill();
        });

        // Camera modal controls
        document.getElementById('closeCameraBtn').addEventListener('click', () => {
            this.closeCamera();
        });

        document.getElementById('cancelCameraBtn').addEventListener('click', () => {
            this.closeCamera();
        });

        document.getElementById('captureBtn').addEventListener('click', () => {
            this.capturePhoto();
        });

        document.getElementById('switchCameraBtn').addEventListener('click', () => {
            this.switchCamera();
        });

        document.getElementById('retakeBtn').addEventListener('click', () => {
            this.retakePhoto();
        });

        document.getElementById('useCaptureBtn').addEventListener('click', () => {
            this.useCapture();
        });
    }

    /**
     * Handle Upload Bill - triggers file picker
     */
    handleUploadBill() {
        document.getElementById('billImages').click();
    }

    /**
     * Handle Scan Bill - opens camera modal
     */
    async handleScanBill() {
        const modal = document.getElementById('cameraModal');
        const loading = document.getElementById('cameraLoading');
        const error = document.getElementById('cameraError');
        const video = document.getElementById('cameraVideo');
        const controls = document.getElementById('cameraControls');

        // Show modal
        modal.style.display = 'block';
        loading.style.display = 'block';
        error.style.display = 'none';
        video.style.display = 'none';
        controls.style.display = 'none';

        try {
            // Check if camera is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported on this device/browser');
            }

            // Request camera access
            await this.startCamera();

            // Show video and controls
            loading.style.display = 'none';
            video.style.display = 'block';
            controls.style.display = 'flex';

        } catch (err) {
            console.error('Camera error:', err);
            loading.style.display = 'none';
            error.style.display = 'block';
            error.textContent = this.getCameraErrorMessage(err);
        }
    }

    /**
     * Start camera stream
     */
    async startCamera() {
        const video = document.getElementById('cameraVideo');

        const constraints = {
            video: {
                facingMode: this.currentFacingMode,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };

        try {
            // Stop existing stream if any
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }

            // Get new stream
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = this.stream;

            console.log('✅ Camera started successfully');
        } catch (error) {
            throw error;
        }
    }

    /**
     * Switch between front and back camera
     */
    async switchCamera() {
        this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';

        const loading = document.getElementById('cameraLoading');
        const video = document.getElementById('cameraVideo');
        const controls = document.getElementById('cameraControls');

        loading.style.display = 'block';
        video.style.display = 'none';
        controls.style.display = 'none';

        try {
            await this.startCamera();
            loading.style.display = 'none';
            video.style.display = 'block';
            controls.style.display = 'flex';
        } catch (error) {
            console.error('Switch camera error:', error);
            alert('Failed to switch camera: ' + error.message);
        }
    }

    /**
     * Capture photo from video stream
     */
    capturePhoto() {
        const video = document.getElementById('cameraVideo');
        const canvas = document.getElementById('captureCanvas');
        const capturedImage = document.getElementById('capturedImage');
        const preview = document.getElementById('capturedImagePreview');
        const controls = document.getElementById('cameraControls');

        // Set canvas size to video size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get image data
        this.capturedImageData = canvas.toDataURL('image/jpeg', 0.95);

        // Show preview
        capturedImage.src = this.capturedImageData;
        video.style.display = 'none';
        controls.style.display = 'none';
        preview.style.display = 'block';

        console.log('📸 Photo captured');
    }

    /**
     * Retake photo
     */
    retakePhoto() {
        const video = document.getElementById('cameraVideo');
        const preview = document.getElementById('capturedImagePreview');
        const controls = document.getElementById('cameraControls');

        preview.style.display = 'none';
        video.style.display = 'block';
        controls.style.display = 'flex';
        this.capturedImageData = null;
    }

    /**
     * Use captured photo for OCR
     */
    async useCapture() {
        if (!this.capturedImageData) {
            alert('No photo captured!');
            return;
        }

        // Close camera
        this.closeCamera();

        // Preprocess image for better OCR
        const preprocessedImage = await this.preprocessImage(this.capturedImageData);

        // Convert to File object
        const blob = await fetch(preprocessedImage).then(r => r.blob());
        const file = new File([blob], `bill_${Date.now()}.jpg`, { type: 'image/jpeg' });

        // Add to scanned images
        this.expenseTracker.scannedImages = [{
            name: file.name,
            data: preprocessedImage,
            file: file
        }];

        // Show preview in main section
        const previewContainer = document.getElementById('imagePreview');
        previewContainer.innerHTML = '';
        previewContainer.className = 'image-preview-container has-images';

        const header = document.createElement('h3');
        header.textContent = '📋 Captured Image:';
        previewContainer.appendChild(header);

        const imgDiv = document.createElement('div');
        imgDiv.className = 'preview-image';
        imgDiv.innerHTML = `
            <img src="${preprocessedImage}" alt="Captured bill">
            <p>Captured from camera</p>
        `;
        previewContainer.appendChild(imgDiv);

        // Show scan button
        document.getElementById('scanBills').style.display = 'block';

        // Automatically trigger OCR
        this.expenseTracker.scanBills();
    }

    /**
     * Preprocess image for better OCR accuracy
     * Applies: contrast enhancement, grayscale, sharpening
     */
    async preprocessImage(imageDataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                // Draw original image
                ctx.drawImage(img, 0, 0);

                // Get image data
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // 1. Convert to grayscale
                for (let i = 0; i < data.length; i += 4) {
                    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    data[i] = gray;
                    data[i + 1] = gray;
                    data[i + 2] = gray;
                }

                // 2. Increase contrast
                const contrast = 20;
                const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = factor * (data[i] - 128) + 128;
                    data[i + 1] = factor * (data[i + 1] - 128) + 128;
                    data[i + 2] = factor * (data[i + 2] - 128) + 128;
                }

                // 3. Apply sharpening filter
                const sharpened = this.applySharpen(imageData);

                // Put processed data back
                ctx.putImageData(sharpened, 0, 0);

                // Return as data URL
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.src = imageDataUrl;
        });
    }

    /**
     * Apply sharpening filter to enhance text edges
     */
    applySharpen(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const output = new ImageData(width, height);
        const outputData = output.data;

        // Sharpening kernel
        const kernel = [
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0
        ];

        // Apply convolution
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                            const kernelIdx = (ky + 1) * 3 + (kx + 1);
                            sum += data[idx] * kernel[kernelIdx];
                        }
                    }
                    const idx = (y * width + x) * 4 + c;
                    outputData[idx] = Math.min(255, Math.max(0, sum));
                }
                const idx = (y * width + x) * 4;
                outputData[idx + 3] = 255; // Alpha
            }
        }

        return output;
    }

    /**
     * Close camera and cleanup
     */
    closeCamera() {
        const modal = document.getElementById('cameraModal');
        const video = document.getElementById('cameraVideo');
        const preview = document.getElementById('capturedImagePreview');
        const controls = document.getElementById('cameraControls');

        // Stop camera stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Reset UI
        modal.style.display = 'none';
        video.style.display = 'none';
        preview.style.display = 'none';
        controls.style.display = 'none';
        this.capturedImageData = null;

        console.log('📷 Camera closed');
    }

    /**
     * Get user-friendly error messages
     */
    getCameraErrorMessage(error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            return '❌ Camera access denied. Please allow camera permissions in your browser settings.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            return '❌ No camera found on this device.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            return '❌ Camera is already in use by another application.';
        } else if (error.name === 'OverconstrainedError') {
            return '❌ Camera does not support the requested settings.';
        } else {
            return `❌ Camera error: ${error.message}`;
        }
    }

    /**
     * Advanced image preprocessing with adaptive thresholding
     */
    async advancedPreprocess(imageDataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Scale down large images for faster processing
                const maxDimension = 2000;
                let width = img.width;
                let height = img.height;

                if (width > maxDimension || height > maxDimension) {
                    const scale = maxDimension / Math.max(width, height);
                    width = Math.floor(width * scale);
                    height = Math.floor(height * scale);
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and resize
                ctx.drawImage(img, 0, 0, width, height);

                // Apply preprocessing
                let imageData = ctx.getImageData(0, 0, width, height);

                // 1. Grayscale
                imageData = this.toGrayscale(imageData);

                // 2. Denoise (simple blur)
                imageData = this.denoise(imageData);

                // 3. Adaptive threshold (makes text pop)
                imageData = this.adaptiveThreshold(imageData);

                ctx.putImageData(imageData, 0, 0);

                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.src = imageDataUrl;
        });
    }

    toGrayscale(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = data[i + 1] = data[i + 2] = gray;
        }
        return imageData;
    }

    denoise(imageData) {
        // Simple box blur
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const output = new ImageData(width, height);
        const outputData = output.data;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let sum = 0;
                let count = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const idx = ((y + dy) * width + (x + dx)) * 4;
                        sum += data[idx];
                        count++;
                    }
                }
                const idx = (y * width + x) * 4;
                const avg = sum / count;
                outputData[idx] = outputData[idx + 1] = outputData[idx + 2] = avg;
                outputData[idx + 3] = 255;
            }
        }
        return output;
    }

    adaptiveThreshold(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const blockSize = 15;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let count = 0;

                // Calculate local mean
                for (let dy = -blockSize; dy <= blockSize; dy++) {
                    for (let dx = -blockSize; dx <= blockSize; dx++) {
                        const ny = Math.min(height - 1, Math.max(0, y + dy));
                        const nx = Math.min(width - 1, Math.max(0, x + dx));
                        const idx = (ny * width + nx) * 4;
                        sum += data[idx];
                        count++;
                    }
                }

                const mean = sum / count;
                const idx = (y * width + x) * 4;
                const threshold = mean * 0.95; // Slight bias

                // Apply threshold
                const value = data[idx] > threshold ? 255 : 0;
                data[idx] = data[idx + 1] = data[idx + 2] = value;
            }
        }

        return imageData;
    }
}

// Export for use in main script
window.CameraOCRHandler = CameraOCRHandler;
