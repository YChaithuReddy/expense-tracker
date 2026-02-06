const { PaddleOCR } = require('ppu-paddle-ocr');
const path = require('path');
const fs = require('fs');
const os = require('os');

let ocrInstance = null;
let isInitializing = false;
let initPromise = null;

/**
 * Initialize PaddleOCR instance (singleton pattern)
 * Models are downloaded automatically on first use
 */
async function getOCR() {
    if (ocrInstance) {
        return ocrInstance;
    }

    if (isInitializing && initPromise) {
        return initPromise;
    }

    isInitializing = true;
    initPromise = (async () => {
        try {
            console.log('🔧 Initializing PaddleOCR...');

            ocrInstance = new PaddleOCR({
                // Use multilingual model for better Indian receipt support
                detectionModelPath: undefined, // Use default
                recognitionModelPath: undefined, // Use default
                classificationModelPath: undefined, // Use default
            });

            console.log('✅ PaddleOCR initialized successfully');
            return ocrInstance;
        } catch (error) {
            console.error('❌ Failed to initialize PaddleOCR:', error);
            ocrInstance = null;
            throw error;
        } finally {
            isInitializing = false;
        }
    })();

    return initPromise;
}

/**
 * Process image and extract text using PaddleOCR
 * @param {string} imageData - Base64 encoded image data (with or without data URL prefix)
 * @returns {Promise<{success: boolean, text: string, confidence: number, lines: Array}>}
 */
async function recognizeText(imageData) {
    const startTime = Date.now();
    let tempFilePath = null;

    try {
        const ocr = await getOCR();

        // Remove data URL prefix if present
        let base64Data = imageData;
        if (imageData.includes('base64,')) {
            base64Data = imageData.split('base64,')[1];
        }

        // Create temporary file for OCR processing
        const tempDir = os.tmpdir();
        tempFilePath = path.join(tempDir, `ocr_${Date.now()}.jpg`);

        // Write base64 image to temp file
        const imageBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(tempFilePath, imageBuffer);

        console.log(`📸 Processing image (${(imageBuffer.length / 1024).toFixed(1)}KB)...`);

        // Perform OCR
        const result = await ocr.recognize(tempFilePath);

        // Extract text and calculate confidence
        let fullText = '';
        let totalConfidence = 0;
        let lineCount = 0;
        const lines = [];

        if (result && result.length > 0) {
            for (const item of result) {
                if (item.text) {
                    fullText += item.text + '\n';
                    lines.push({
                        text: item.text,
                        confidence: item.score || 0,
                        bbox: item.box || null
                    });
                    totalConfidence += (item.score || 0);
                    lineCount++;
                }
            }
        }

        const avgConfidence = lineCount > 0 ? (totalConfidence / lineCount) * 100 : 0;
        const processingTime = Date.now() - startTime;

        console.log(`✅ OCR completed in ${processingTime}ms`);
        console.log(`   Lines: ${lineCount}, Confidence: ${avgConfidence.toFixed(1)}%`);
        console.log(`   Text length: ${fullText.length} characters`);

        return {
            success: true,
            text: fullText.trim(),
            confidence: avgConfidence,
            lines: lines,
            processingTime: processingTime,
            charCount: fullText.length,
            lineCount: lineCount
        };

    } catch (error) {
        console.error('❌ OCR Error:', error);
        return {
            success: false,
            text: '',
            confidence: 0,
            lines: [],
            error: error.message
        };
    } finally {
        // Clean up temp file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (e) {
                console.warn('Failed to delete temp file:', e.message);
            }
        }
    }
}

/**
 * Batch process multiple images
 * @param {Array<string>} images - Array of base64 encoded images
 * @returns {Promise<Array>} - Array of OCR results
 */
async function recognizeBatch(images) {
    const results = [];

    for (let i = 0; i < images.length; i++) {
        console.log(`📸 Processing image ${i + 1}/${images.length}...`);
        const result = await recognizeText(images[i]);
        results.push(result);
    }

    return results;
}

module.exports = {
    recognizeText,
    recognizeBatch,
    getOCR
};
