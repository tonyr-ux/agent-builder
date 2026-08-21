import { CLAUDE_MODELS } from './types';

export const anthropicConfig = {
  // Default model for general use
  defaultModel: CLAUDE_MODELS.SONNET_3_5,
  
  // Vision-optimized model (Sonnet 3.5 is now the best available)
  visionModel: CLAUDE_MODELS.SONNET_3_5,
  
  // Fast model for simple tasks
  fastModel: CLAUDE_MODELS.HAIKU_3_5,

  // Conversational model for the Agent Builder chat
  chatModel: CLAUDE_MODELS.OPUS_5,
  
  // Default parameters
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7,
  
  // Vision-specific settings
  vision: {
    maxImageSize: 10 * 1024 * 1024, // 10MB
    maxImagesPerRequest: 20, // Claude supports up to 100, but we'll be conservative
    supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'] as const,
    // Approximate token usage per image
    tokensPerImage: 1600,
  },
  
  // Agent Builder chat settings
  chat: {
    model: CLAUDE_MODELS.OPUS_5,
    // Streaming, so we can afford headroom: thinking and the reply share this
    // budget, and a truncated configuration block can't be parsed by the client
    maxTokens: 16000,
    // 'low' | 'medium' | 'high' | 'xhigh' | 'max' - medium keeps the chat
    // responsive without shallow reasoning on configuration edits
    effort: 'medium' as const,
  },

  // Invoice extraction settings
  invoiceExtraction: {
    model: CLAUDE_MODELS.SONNET_3_5, // Use best available model for accuracy
    maxTokens: 4096,
    temperature: 0.1, // Low temperature for consistent extraction
    systemPrompt: `You are an expert invoice data extractor. Extract all relevant information from the invoice image and return it as structured JSON. Be precise and accurate. If a field is not visible or unclear, omit it rather than guessing.`,
  },
  
  // Rate limiting
  rateLimits: {
    maxRequestsPerMinute: 50,
    maxTokensPerMinute: 100000,
  },
  
  // Timeout settings
  timeouts: {
    default: 30000, // 30 seconds
    vision: 60000, // 60 seconds for image processing
    batch: 120000, // 2 minutes for batch operations
  },
  
  // API endpoints (for reference)
  endpoints: {
    messages: '/v1/messages',
    complete: '/v1/complete',
  },
};

// Helper to get model based on use case
export function getModelForUseCase(useCase: 'general' | 'vision' | 'fast' | 'invoice'): string {
  switch (useCase) {
    case 'vision':
      return anthropicConfig.visionModel;
    case 'fast':
      return anthropicConfig.fastModel;
    case 'invoice':
      return anthropicConfig.invoiceExtraction.model;
    default:
      return anthropicConfig.defaultModel;
  }
}

// Helper to validate image format
export function isValidImageFormat(mimeType: string): boolean {
  return anthropicConfig.vision.supportedFormats.includes(mimeType as any);
}

// Helper to check image size
export function isValidImageSize(sizeInBytes: number): boolean {
  return sizeInBytes <= anthropicConfig.vision.maxImageSize;
}