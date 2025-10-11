/**
 * Azure OCR Service
 * Uses Azure AI Form Recognizer (Document Intelligence) to extract text from receipts
 *
 * Features:
 * - Receipt-optimized OCR with 95-97% accuracy
 * - Extracts merchant name, date, total, tax, line items
 * - Supports handwritten text and low-quality images
 * - 5,000 free transactions per month
 */

const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');

class AzureOcrService {
    constructor() {
        this.endpoint = process.env.AZURE_VISION_ENDPOINT;
        this.apiKey = process.env.AZURE_VISION_KEY;

        if (!this.endpoint || !this.apiKey) {
            console.warn('⚠️  Azure Vision credentials not found in environment variables');
            console.warn('    Please set AZURE_VISION_ENDPOINT and AZURE_VISION_KEY');
        } else {
            this.client = new DocumentAnalysisClient(
                this.endpoint,
                new AzureKeyCredential(this.apiKey)
            );
            console.log('✅ Azure OCR Service initialized successfully');
        }
    }

    /**
     * Check if service is ready
     */
    isReady() {
        return !!(this.endpoint && this.apiKey && this.client);
    }

    /**
     * Extract text from receipt image using Azure OCR
     * @param {Buffer} imageBuffer - Image buffer from uploaded file
     * @returns {Promise<Object>} - Extracted text and confidence
     */
    async extractTextFromImage(imageBuffer) {
        try {
            if (!this.isReady()) {
                throw new Error('Azure OCR service not configured. Please set environment variables.');
            }

            console.log('📄 Processing image with Azure OCR...');

            // Use the Read model for general text extraction (best for receipts)
            const poller = await this.client.beginAnalyzeDocument('prebuilt-read', imageBuffer);
            const result = await poller.pollUntilDone();

            if (!result || !result.content) {
                console.warn('⚠️  No text extracted from image');
                return {
                    success: false,
                    text: '',
                    confidence: 0,
                    message: 'No text found in image'
                };
            }

            // Extract all text content
            const extractedText = result.content;

            // Calculate average confidence from all lines
            let totalConfidence = 0;
            let lineCount = 0;

            if (result.pages && result.pages.length > 0) {
                result.pages.forEach(page => {
                    if (page.lines) {
                        page.lines.forEach(line => {
                            totalConfidence += (line.confidence || 0);
                            lineCount++;
                        });
                    }
                });
            }

            const averageConfidence = lineCount > 0 ? (totalConfidence / lineCount) : 0;

            console.log('✅ Azure OCR extraction successful');
            console.log(`   Text length: ${extractedText.length} characters`);
            console.log(`   Confidence: ${(averageConfidence * 100).toFixed(1)}%`);
            console.log(`   Lines detected: ${lineCount}`);

            return {
                success: true,
                text: extractedText,
                confidence: averageConfidence,
                lineCount: lineCount,
                provider: 'Azure Read OCR'
            };

        } catch (error) {
            console.error('❌ Azure OCR Error:', error.message);

            // Provide helpful error messages
            if (error.message.includes('401')) {
                throw new Error('Azure OCR authentication failed. Please check your API key.');
            } else if (error.message.includes('403')) {
                throw new Error('Azure OCR access denied. Please check your subscription.');
            } else if (error.message.includes('429')) {
                throw new Error('Azure OCR rate limit exceeded. Please try again later.');
            } else {
                throw new Error(`Azure OCR failed: ${error.message}`);
            }
        }
    }

    /**
     * Extract text from receipt with enhanced receipt-specific model
     * @param {Buffer} imageBuffer - Image buffer from uploaded file
     * @returns {Promise<Object>} - Structured receipt data
     */
    async extractReceiptData(imageBuffer) {
        try {
            if (!this.isReady()) {
                throw new Error('Azure OCR service not configured.');
            }

            console.log('🧾 Processing receipt with Azure Receipt Processor...');

            // Use prebuilt-receipt model for better structure
            const poller = await this.client.beginAnalyzeDocument('prebuilt-receipt', imageBuffer);
            const result = await poller.pollUntilDone();

            if (!result || !result.documents || result.documents.length === 0) {
                console.warn('⚠️  No receipt data found, falling back to text extraction');
                return await this.extractTextFromImage(imageBuffer);
            }

            const receipt = result.documents[0];
            const fields = receipt.fields || {};

            // Extract structured data
            const receiptData = {
                success: true,
                provider: 'Azure Receipt Processor',
                merchantName: fields.MerchantName?.content || '',
                transactionDate: fields.TransactionDate?.content || '',
                total: fields.Total?.content || '',
                subtotal: fields.Subtotal?.content || '',
                tax: fields.TotalTax?.content || '',
                items: [],
                rawText: result.content || ''
            };

            // Extract line items if available
            if (fields.Items && fields.Items.values) {
                receiptData.items = fields.Items.values.map(item => {
                    const itemFields = item.properties || {};
                    return {
                        description: itemFields.Description?.content || '',
                        quantity: itemFields.Quantity?.content || '',
                        price: itemFields.Price?.content || '',
                        totalPrice: itemFields.TotalPrice?.content || ''
                    };
                });
            }

            console.log('✅ Azure Receipt extraction successful');
            console.log(`   Merchant: ${receiptData.merchantName || 'Not found'}`);
            console.log(`   Date: ${receiptData.transactionDate || 'Not found'}`);
            console.log(`   Total: ${receiptData.total || 'Not found'}`);
            console.log(`   Items: ${receiptData.items.length}`);

            return receiptData;

        } catch (error) {
            console.error('❌ Azure Receipt Processor Error:', error.message);
            console.log('⚠️  Falling back to basic text extraction');
            // Fallback to basic text extraction
            return await this.extractTextFromImage(imageBuffer);
        }
    }
}

// Export singleton instance
module.exports = new AzureOcrService();
