// Anthropic API Types with Vision Support

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string; // base64 encoded image data (required for base64 type)
  } | {
    type: 'url';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    url: string; // URL to the image (required for url type)
  };
}

export type MessageContent = TextContent | ImageContent;

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | MessageContent[];
}

export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  system?: string;
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Invoice Extraction Types
export interface InvoiceVendor {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  taxId?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  tax?: number;
}

export interface InvoiceTotal {
  subtotal: number;
  tax?: number;
  taxRate?: number;
  discount?: number;
  shipping?: number;
  otherCharges?: number;
  total: number;
  currency: string;
}

export interface InvoiceExtractionResult {
  invoice_headers: {
    type?: 'invoice' | 'credit_memo' | 'debit_memo';
    vendor_name_snapshot: string;
    vendor_tax_id_snapshot?: string;
    vendor_address_snapshot?: string;
    vendor_country_code?: string;
    invoice_number: string;
    invoice_date: string;
    due_date?: string;
    currency: string;
    payment_terms_text?: string;
    po_numbers_cached?: string[];
    subtotal: number;
    tax_total?: number;
    tax_rate?: number;
    discount_total?: number;
    shipping_total?: number;
    other_charges_total?: number;
    total: number;
    ledger?: string;
    cost_center?: string | null;
    cost_center_name?: string | null;
    gl_code?: string | null;
    department?: string | null;
    ai_classification_confidence?: number | null;
    ai_classification_reasoning?: string | null;
  };
  invoice_lines?: Array<{
    line_no: number;
    description: string;
    uom?: string;
    qty: number;
    unit_price: number;
    net_amount: number;
    tax_amount?: number;
    line_total: number;
    po_number_snapshot?: string;
  }>;
  customer?: {
    name?: string;
    address?: string;
  };
  warnings?: Array<{
    code: string;
    message: string;
  }>;
  field_confidences?: Record<string, number>;
  confidence_overall?: number;
  
  // Legacy fields for backward compatibility
  confidence?: number;
  vendor?: InvoiceVendor;
  invoice?: {
    number: string;
    date: string;
    dueDate?: string;
    poNumber?: string;
  };
  items?: InvoiceLineItem[];
  totals?: InvoiceTotal;
  paymentTerms?: string;
  notes?: string;
  rawText?: string;
  
  // Accounting classification fields
  ledger?: string;
  cost_center?: string | null;
  cost_center_name?: string | null;
  gl_code?: string | null;
  department?: string | null;
  ai_classification_confidence?: number | null;
  ai_classification_reasoning?: string | null;
}

export interface AnthropicError {
  error: {
    type: string;
    message: string;
  };
}

export interface ApiKeyValidationResult {
  valid: boolean;
  error?: string;
  models?: string[];
}

// Vision-specific types
export interface ImageAnalysisRequest {
  image: string; // base64 or URL
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';
  prompt?: string;
  extractInvoice?: boolean;
  model?: string;
}

export interface BatchImageAnalysisRequest {
  images: Array<{
    data: string;
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';
    prompt?: string;
  }>;
  model?: string;
}

// Supported Claude models (Updated September 2025)
export const CLAUDE_MODELS = {
  // Current models
  OPUS_5: 'claude-opus-5',          // Most capable; used for the Agent Builder chat
  SONNET_5: 'claude-sonnet-5',      // Balanced speed/intelligence

  // Claude 4 models
  SONNET_4: 'claude-sonnet-4-20250514', // Latest Sonnet model
  SONNET_3_5: 'claude-sonnet-4-20250514', // Alias for compatibility
  HAIKU_3_5: 'claude-3-5-haiku-20241022',   // Fast and efficient
  
  // Legacy models (some deprecated)
  OPUS: 'claude-3-opus-20240229',  // DEPRECATED - will be removed Jan 2026
  SONNET: 'claude-3-sonnet-20240229',
  HAIKU: 'claude-3-haiku-20240307',
  
  // Aliases for latest models
  OPUS_LATEST: 'claude-sonnet-4-20250514', // Using latest Sonnet as Opus replacement
  SONNET_LATEST: 'claude-sonnet-4-20250514',
  HAIKU_LATEST: 'claude-3-5-haiku-20241022',
} as const;

export type ClaudeModel = typeof CLAUDE_MODELS[keyof typeof CLAUDE_MODELS];