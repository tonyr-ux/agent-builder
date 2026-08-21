import { getAnthropicClient, createAnthropicClient } from './client';
import { anthropicConfig, getModelForUseCase, isValidImageFormat, isValidImageSize } from './config';
import type {
  AnthropicMessage,
  AnthropicRequest,
  AnthropicResponse,
  MessageContent,
  ImageContent,
  InvoiceExtractionResult,
  ImageAnalysisRequest,
  BatchImageAnalysisRequest,
} from './types';

export class AnthropicService {
  /**
   * Send a message to Claude
   */
  static async createMessage(request: Partial<AnthropicRequest>): Promise<AnthropicResponse> {
    try {
      const client = getAnthropicClient();
      
      const response = await client.messages.create({
        model: request.model || anthropicConfig.defaultModel,
        messages: request.messages as any || [],
        max_tokens: request.max_tokens || anthropicConfig.defaultMaxTokens,
        temperature: request.temperature ?? anthropicConfig.defaultTemperature,
        system: request.system,
        top_p: request.top_p,
        top_k: request.top_k,
        stop_sequences: request.stop_sequences,
      } as any);
      
      return response as AnthropicResponse;
    } catch (error: any) {
      throw new Error(`Anthropic Message Error: ${error.message}`);
    }
  }
  
  /**
   * Stream a message response from Claude
   */
  static async createMessageStream(request: Partial<AnthropicRequest>): Promise<any> {
    try {
      const client = getAnthropicClient();
      
      const stream = await client.messages.create({
        model: request.model || anthropicConfig.defaultModel,
        messages: request.messages as any || [],
        max_tokens: request.max_tokens || anthropicConfig.defaultMaxTokens,
        temperature: request.temperature ?? anthropicConfig.defaultTemperature,
        system: request.system,
        stream: true,
      } as any);
      
      return stream;
    } catch (error: any) {
      throw new Error(`Anthropic Stream Error: ${error.message}`);
    }
  }

  /**
   * Stream a conversational reply from Claude.
   *
   * Deliberately different from createMessageStream in two ways:
   * - No sampling parameters. temperature/top_p/top_k are rejected outright by
   *   the current Opus and Sonnet models, so sending them fails the request.
   * - Errors are not re-wrapped, so callers can still read error.status and
   *   distinguish an invalid key from a rate limit.
   *
   * Thinking is left at the model default (adaptive on Opus 5); depth is
   * controlled with effort instead of a token budget.
   */
  static async createChatStream(request: {
    messages: AnthropicMessage[];
    system?: string;
    model?: string;
    maxTokens?: number;
    effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  }): Promise<AsyncIterable<any>> {
    const client = getAnthropicClient();

    const stream = await client.messages.create({
      model: request.model || anthropicConfig.chat.model,
      max_tokens: request.maxTokens || anthropicConfig.chat.maxTokens,
      system: request.system,
      messages: request.messages as any,
      output_config: { effort: request.effort || anthropicConfig.chat.effort },
      stream: true,
    } as any);

    return stream as unknown as AsyncIterable<any>;
  }

  /**
   * Analyze an image with Claude Vision
   */
  static async analyzeImage(request: ImageAnalysisRequest): Promise<AnthropicResponse> {
    try {
      // Validate format
      if (!isValidImageFormat(request.mediaType)) {
        throw new Error(`Unsupported format: ${request.mediaType}`);
      }
      
      // Build the message content
      const content: MessageContent[] = [];
      
      // Handle PDFs and images
      if (request.mediaType === 'application/pdf') {
        // For PDFs, we'll send as document type (Claude can handle PDFs)
        const documentContent: any = {
          type: 'document',
          source: {
            type: 'base64',
            media_type: request.mediaType,
            data: request.image,
          },
        };
        content.push(documentContent);
      } else {
        // For images, use image type
        const imageContent: ImageContent = {
          type: 'image',
          source: {
            type: 'base64',
            media_type: request.mediaType as any,
            data: request.image,
          },
        };
        content.push(imageContent);
      }
      
      // Add the prompt
      const prompt = request.prompt || 'Analyze this image and describe what you see.';
      content.push({
        type: 'text',
        text: prompt,
      });
      
      const message: AnthropicMessage = {
        role: 'user',
        content,
      };
      
      return await this.createMessage({
        model: request.model || getModelForUseCase('vision'),
        messages: [message],
        max_tokens: anthropicConfig.defaultMaxTokens,
        temperature: 0.3, // Lower temperature for analysis
      });
    } catch (error: any) {
      throw new Error(`Image Analysis Error: ${error.message}`);
    }
  }
  
  /**
   * Extract invoice data from an image
   */
  static async extractInvoiceData(
    imageData: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf'
  ): Promise<InvoiceExtractionResult> {
    try {
      const extractionPrompt = `
        You are an expert AP invoice extractor. Analyze this invoice image and extract all relevant information.
        
        Return STRICT JSON that matches this schema (omit fields you cannot read confidently; do not guess; numbers are JSON numbers):
        
        {
          "invoice_headers": {
            "type": "invoice|credit_memo|debit_memo",
            "vendor_name_snapshot": "string",
            "vendor_tax_id_snapshot": "string",
            "vendor_address_snapshot": "string",
            "vendor_country_code": "ISO 3166-1 alpha-2 code (e.g., US, GB, DE, FR) - extract from vendor address",
            "invoice_number": "string",
            "invoice_date": "YYYY-MM-DD",
            "due_date": "YYYY-MM-DD",
            "currency": "GBP|EUR|USD|other ISO code",
            "payment_terms_text": "string",
            "payment_method": "bank_transfer|check|credit_card|paypal|wire_transfer|cash|other|null",
            "payment_bank_details": {
              "bank_name": "string|null",
              "account_name": "string|null",
              "account_number": "string|null",
              "sort_code": "string|null",
              "iban": "string|null",
              "swift_bic": "string|null",
              "routing_number": "string|null"
            },
            "po_numbers_cached": ["string", "..."],
            "subtotal": number,
            "tax_total": number,
            "tax_rate": number,
            "discount_total": number,
            "shipping_total": number,
            "other_charges_total": number,
            "total": number,
            "ledger": "Accounts Payable|Fixed Assets|Prepaid Expenses|Accruals|Inventory",
            "cost_center": "IT-100|MKT-200|OPS-300|HR-400|FIN-500|R&D-600|FAC-700|EXEC-800|SALES-900|LEGAL-1000|null",
            "cost_center_name": "string|null",
            "gl_code": "string|null",
            "department": "string|null",
            "ai_classification_confidence": number,
            "ai_classification_reasoning": "string"
          },
          "invoice_lines": [
            {
              "line_no": number,
              "description": "string",
              "uom": "string",
              "qty": number,
              "unit_price": number,
              "net_amount": number,
              "tax_amount": number,
              "line_total": number,
              "po_number_snapshot": "string"
            }
          ],
          "customer": {
            "name": "string",
            "address": "string"
          },
          "field_confidences": {
            "vendor_name_snapshot": number,
            "vendor_tax_id_snapshot": number,
            "vendor_address_snapshot": number,
            "invoice_number": number,
            "invoice_date": number,
            "due_date": number,
            "currency": number,
            "payment_terms_text": number,
            "po_numbers_cached": number,
            "subtotal": number,
            "tax_total": number,
            "tax_rate": number,
            "discount_total": number,
            "shipping_total": number,
            "other_charges_total": number,
            "total": number
          },
          "warnings": [ 
            { 
              "code": "string", 
              "message": "string" 
            } 
          ],
          "confidence_overall": number
        }
        
        Normalization rules:
        - Dates: ISO 8601 format (YYYY-MM-DD)
        - Currency: Map symbols to ISO codes (£→GBP, €→EUR, $→USD, ¥→JPY)
        - vendor_country_code: Extract ISO 3166-1 alpha-2 country code from vendor address:
          * Look for country name in address (e.g., "United Kingdom" → GB, "Germany" → DE, "France" → FR)
          * Common mappings: UK/United Kingdom/Great Britain → GB, USA/United States → US, Deutschland → DE
          * Look for postal code patterns: UK postcodes (e.g., EC2N 4AY) → GB, US ZIP codes → US, German PLZ → DE
          * Look for city/region clues: London → GB, Berlin/München → DE, Paris → FR, New York → US
          * If currency is GBP → likely GB, EUR → likely EU country, USD → likely US
          * Default to US only if completely uncertain
        - Numbers: Use '.' as decimal separator, no thousands separators
        - Keep negative signs for credit amounts
        - line_no starts at 1 and increments
        - uom defaults to "EA" if not specified
        - tax_rate: Express as percentage (e.g., 20 for 20%, 7.5 for 7.5%)
        - If tax percentage is shown (e.g., "VAT 20%", "Tax (20%)", "20.0% VAT"), extract as tax_rate: 20
        - IMPORTANT: Extract tax_rate even if tax_total is 0 (e.g., "Tax (20%) £0.00" means tax_rate: 20, tax_total: 0)
        - If only tax amount shown, calculate rate from subtotal if possible
        - shipping_total: Extract freight, shipping, delivery, postage charges (set to 0 if not present)
        - other_charges_total: Sum of handling fees, insurance, fuel surcharges, processing fees, service charges (set to 0 if not present)
        - IMPORTANT: Do NOT include shipping/freight as line items - extract them separately
        - total should equal: subtotal + tax_total + shipping_total + other_charges_total - discount_total
        - Omit fields if unclear rather than guessing
        
        Payment Method Extraction Rules:
        - payment_method: Look for payment instructions, remittance details, or payment method sections
        - Common indicators: "Bank Transfer", "Wire Transfer", "Check", "Credit Card", "PayPal", "ACH", "EFT", "BACS"
        - payment_bank_details: Extract ALL bank details found on invoice:
          * bank_name: Bank or financial institution name
          * account_name: Account holder/beneficiary name
          * account_number: Bank account number (preserve full number, do not mask)
          * sort_code: UK sort code (format: XX-XX-XX or XXXXXX)
          * iban: International Bank Account Number
          * swift_bic: SWIFT/BIC code for international transfers
          * routing_number: US routing/ABA number
        - Set payment_method to "bank_transfer" if any bank details are present
        - Set to null if no payment information found
        
        Accounting Classification Rules:
        - ledger: Determine based on invoice type and amount:
          * "Fixed Assets": Equipment/furniture/machinery > $5000
          * "Prepaid Expenses": Insurance, annual licenses, subscriptions paid in advance
          * "Accruals": Utilities, services crossing month boundaries
          * "Inventory": Raw materials, resale items, stock
          * "Accounts Payable": Default for standard vendor invoices
        - cost_center: Based on vendor and items:
          * IT-100: Software, hardware, IT services
          * MKT-200: Advertising, marketing campaigns, events
          * OPS-300: Operational supplies, shipping
          * HR-400: Recruitment, training, benefits
          * FIN-500: Audit, compliance, financial services
          * R&D-600: Product development, research
          * FAC-700: Rent, utilities, maintenance
          * EXEC-800: Executive expenses, board costs
          * SALES-900: Sales operations, commissions
          * LEGAL-1000: Legal services, contracts
        - cost_center_name: Full name matching the code (e.g., "Information Technology" for IT-100)
        - gl_code: Suggest based on expense type (e.g., 6210 for software, 5410 for rent)
        - department: Department name (e.g., "Technology", "Marketing", "Operations")
        - ai_classification_confidence: 0.00 to 1.00 based on certainty
        - ai_classification_reasoning: Brief explanation of classification logic
        
        Field Confidence Rules:
        - field_confidences: For each extracted field, provide confidence score 0-100
        - 90-100: Very clear, unambiguous text/numbers
        - 70-89: Readable but may have minor ambiguity (e.g., slightly blurry, unusual format)
        - 50-69: Difficult to read, significant ambiguity
        - 0-49: Very unclear, highly uncertain extraction
        - If field is omitted/null, don't include in field_confidences
        - confidence_overall: Average of all field confidences (0.00 to 1.00)
        
        Return STRICT JSON only, no additional text.
      `;
      
      const response = await this.analyzeImage({
        image: imageData,
        mediaType,
        prompt: extractionPrompt,
        model: anthropicConfig.invoiceExtraction.model,
      });
      
      // Parse the response
      const responseText = response.content[0]?.text || '';
      
      // Extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from response');
      }
      
      const extractedData = JSON.parse(jsonMatch[0]) as InvoiceExtractionResult;
      
      // Debug: log the raw AI response
      console.log('AI raw JSON response (first 500 chars):', jsonMatch[0].substring(0, 500));
      console.log('AI classification fields in response:', {
        headers_ledger: extractedData.invoice_headers?.ledger,
        headers_cost_center: extractedData.invoice_headers?.cost_center,
        headers_gl_code: extractedData.invoice_headers?.gl_code,
      });
      
      // Add raw text for reference
      extractedData.rawText = responseText;
      
      // Store field confidences if provided
      if (extractedData.field_confidences) {
        console.log('Field confidences extracted:', extractedData.field_confidences);
      }
      
      // Map new format to legacy format for backward compatibility
      if (extractedData.invoice_headers && !extractedData.invoice) {
        extractedData.vendor = {
          name: extractedData.invoice_headers.vendor_name_snapshot,
          taxId: extractedData.invoice_headers.vendor_tax_id_snapshot || '',
          address: extractedData.invoice_headers.vendor_address_snapshot || '',
        };
        
        extractedData.invoice = {
          number: extractedData.invoice_headers.invoice_number,
          date: extractedData.invoice_headers.invoice_date,
          dueDate: extractedData.invoice_headers.due_date,
          poNumber: extractedData.invoice_headers.po_numbers_cached?.[0],
        };
        
        extractedData.totals = {
          subtotal: extractedData.invoice_headers.subtotal,
          tax: extractedData.invoice_headers.tax_total || 0,
          taxRate: extractedData.invoice_headers.tax_rate || undefined,
          discount: extractedData.invoice_headers.discount_total || 0,
          shipping: extractedData.invoice_headers.shipping_total || 0,
          otherCharges: extractedData.invoice_headers.other_charges_total || 0,
          total: extractedData.invoice_headers.total,
          currency: extractedData.invoice_headers.currency,
        };
        
        extractedData.paymentTerms = extractedData.invoice_headers.payment_terms_text;
        extractedData.confidence = extractedData.confidence_overall || 0.95;
        
        // Preserve accounting classification fields
        extractedData.ledger = extractedData.invoice_headers.ledger;
        extractedData.cost_center = extractedData.invoice_headers.cost_center;
        extractedData.cost_center_name = extractedData.invoice_headers.cost_center_name;
        extractedData.gl_code = extractedData.invoice_headers.gl_code;
        extractedData.department = extractedData.invoice_headers.department;
        extractedData.ai_classification_confidence = extractedData.invoice_headers.ai_classification_confidence;
        extractedData.ai_classification_reasoning = extractedData.invoice_headers.ai_classification_reasoning;
        
        // Map invoice_lines to items for backward compatibility
        if (extractedData.invoice_lines) {
          extractedData.items = extractedData.invoice_lines.map(line => ({
            description: line.description,
            quantity: line.qty,
            unitPrice: line.unit_price,
            amount: line.net_amount,
            tax: line.tax_amount,
          }));
        }
      }
      
      return extractedData;
    } catch (error: any) {
      throw new Error(`Invoice Extraction Error: ${error.message}`);
    }
  }
  
  /**
   * Analyze multiple images in a single request
   */
  static async analyzeMultipleImages(request: BatchImageAnalysisRequest): Promise<AnthropicResponse> {
    try {
      if (request.images.length > anthropicConfig.vision.maxImagesPerRequest) {
        throw new Error(`Maximum ${anthropicConfig.vision.maxImagesPerRequest} images per request`);
      }
      
      // Build the message content with multiple images
      const content: MessageContent[] = [];
      
      for (const image of request.images) {
        if (!isValidImageFormat(image.mediaType)) {
          throw new Error(`Unsupported image format: ${image.mediaType}`);
        }
        
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: image.mediaType as any,
            data: image.data,
          },
        });
        
        if (image.prompt) {
          content.push({
            type: 'text',
            text: image.prompt,
          });
        }
      }
      
      const message: AnthropicMessage = {
        role: 'user',
        content,
      };
      
      return await this.createMessage({
        model: request.model || getModelForUseCase('vision'),
        messages: [message],
        max_tokens: anthropicConfig.defaultMaxTokens,
      });
    } catch (error: any) {
      throw new Error(`Batch Image Analysis Error: ${error.message}`);
    }
  }
  
  /**
   * Convert an image file to base64
   */
  static async convertImageToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Validate an API key by attempting to send a simple message
   */
  static async validateApiKey(apiKey?: string): Promise<boolean> {
    try {
      const client = apiKey ? createAnthropicClient(apiKey) : getAnthropicClient();
      
      // Use a minimal request to validate the key
      // This will fail with 401 if the key is invalid
      await client.messages.create({
        model: anthropicConfig.fastModel,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
        metadata: { user_id: 'validation-check' }
      });
      
      return true;
    } catch (error: any) {
      console.error('Anthropic API key validation error:', error.message);
      return false;
    }
  }
  
  /**
   * Get available models (hardcoded since Anthropic doesn't have a list endpoint)
   */
  static getAvailableModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
    ];
  }
  
  /**
   * Estimate token count for text (approximate)
   */
  static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Estimate tokens for an image
   */
  static estimateImageTokens(): number {
    return anthropicConfig.vision.tokensPerImage;
  }
  
  /**
   * Validate image file before processing
   */
  static validateImageFile(file: File): { valid: boolean; error?: string } {
    // Check file type
    if (!isValidImageFormat(file.type)) {
      return {
        valid: false,
        error: `Unsupported format. Supported: ${anthropicConfig.vision.supportedFormats.join(', ')}`,
      };
    }
    
    // Check file size
    if (!isValidImageSize(file.size)) {
      const maxSizeMB = anthropicConfig.vision.maxImageSize / (1024 * 1024);
      return {
        valid: false,
        error: `Image too large. Maximum size: ${maxSizeMB}MB`,
      };
    }
    
    return { valid: true };
  }
}