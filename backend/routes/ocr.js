const express = require('express');
const router = express.Router();

/**
 * POST /api/ocr/scan
 * Proxy endpoint for OCR.space API — keeps API key on server side.
 * Accepts base64 image, forwards to OCR.space, returns parsed text.
 */
router.post('/scan', async (req, res) => {
    const apiKey = process.env.OCR_SPACE_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ success: false, error: 'OCR API key not configured on server.' });
    }

    const { base64Image, language, ocrEngine } = req.body;
    if (!base64Image) {
        return res.status(400).json({ success: false, error: 'base64Image is required.' });
    }

    try {
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        formData.append('apikey', apiKey);
        formData.append('base64Image', base64Image);
        formData.append('language', language || 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');
        formData.append('OCREngine', ocrEngine || '2');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders(),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: `OCR API returned ${response.status}`
            });
        }

        const result = await response.json();
        return res.json({ success: true, data: result });
    } catch (err) {
        const isTimeout = err.name === 'AbortError';
        return res.status(isTimeout ? 504 : 500).json({
            success: false,
            error: isTimeout ? 'OCR request timed out.' : 'OCR processing failed.'
        });
    }
});

module.exports = router;
