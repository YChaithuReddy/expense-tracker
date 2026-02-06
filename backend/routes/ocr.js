const express = require('express');
const router = express.Router();
const { recognizeText, recognizeBatch } = require('../services/paddleocr');

/**
 * POST /api/ocr/scan
 * Process a single image and return OCR results
 *
 * Request body:
 * {
 *   image: string (base64 encoded image with or without data URL prefix)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   text: string,
 *   confidence: number,
 *   lines: Array<{text, confidence, bbox}>,
 *   processingTime: number
 * }
 */
router.post('/scan', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                error: 'No image provided'
            });
        }

        console.log('📸 OCR scan request received');
        const result = await recognizeText(image);

        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }

    } catch (error) {
        console.error('❌ OCR scan error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ocr/batch
 * Process multiple images and return OCR results
 *
 * Request body:
 * {
 *   images: Array<string> (array of base64 encoded images)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   results: Array<OCRResult>,
 *   totalProcessingTime: number
 * }
 */
router.post('/batch', async (req, res) => {
    try {
        const { images } = req.body;

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No images provided'
            });
        }

        if (images.length > 10) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 10 images per batch'
            });
        }

        console.log(`📸 OCR batch request received: ${images.length} images`);
        const startTime = Date.now();
        const results = await recognizeBatch(images);
        const totalTime = Date.now() - startTime;

        const successCount = results.filter(r => r.success).length;
        console.log(`✅ Batch OCR completed: ${successCount}/${images.length} successful in ${totalTime}ms`);

        res.json({
            success: true,
            results: results,
            totalProcessingTime: totalTime,
            successCount: successCount,
            failCount: images.length - successCount
        });

    } catch (error) {
        console.error('❌ OCR batch error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/ocr/health
 * Check OCR service health
 */
router.get('/health', async (req, res) => {
    try {
        const { getOCR } = require('../services/paddleocr');
        await getOCR(); // This will initialize if not already done

        res.json({
            success: true,
            status: 'ready',
            engine: 'PaddleOCR',
            message: 'OCR service is ready'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'error',
            error: error.message
        });
    }
});

module.exports = router;
