# Anthropic (Claude) Integration Setup

This project includes comprehensive Anthropic Claude integration with Vision capabilities for invoice scanning and extraction.

## Features

### 🤖 Claude AI Models
- **Claude 3 Opus**: Most capable model for complex tasks
- **Claude 3 Sonnet**: Balanced performance and speed
- **Claude 3 Haiku**: Fast, cost-effective model

### 👁️ Vision Capabilities
- **Invoice Scanning**: Extract data from invoice images
- **Multi-format Support**: JPEG, PNG, GIF, WebP
- **Batch Processing**: Analyze multiple images at once
- **Structured Extraction**: Get JSON data from invoices

## Setup Instructions

### 1. Get Your Anthropic API Key

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

### 2. Local Development Setup

Add your API key to `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. Railway Deployment

In your Railway project:

1. Go to your Next.js app service (not database)
2. Click on "Variables" tab
3. Add new variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: Your Anthropic API key

Railway will automatically redeploy with the new configuration.

## Usage

### Configure in Settings

1. Navigate to Settings page (`/settings`)
2. Click on "Anthropic (Claude + Vision)" tab
3. Enter your API key and validate
4. Once validated, Vision features become available

### Invoice Scanner

The Invoice Scanner can extract:

- **Vendor Information**: Name, address, contact details
- **Invoice Details**: Number, date, due date
- **Line Items**: Description, quantity, price, amount
- **Totals**: Subtotal, tax, discount, total
- **Payment Terms**: Net terms, payment conditions
- **Additional Data**: PO numbers, notes

#### How to Use:

1. Go to Settings → Anthropic tab
2. Upload an invoice image (drag & drop or click)
3. Click "Extract Invoice Data"
4. Review extracted data
5. Edit if needed and save

### Agent Builder Chat

The Agent Builder chat assistant runs on Claude Opus 5 (`POST /api/agent-builder/chat`):

1. Navigate to Agent Builder (`/agent-builder`)
2. Describe what you want your agent to do in the chat panel
3. Claude streams back a reply and a full configuration block you can apply

The model, output limit, and reasoning effort live in `anthropicConfig.chat`
(`lib/anthropic/config.ts`). The route streams Claude's response and re-shapes it
into the SSE frames the chat interface parses.

### API Endpoints

#### Chat Endpoint
```typescript
POST /api/anthropic/chat
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "Hello, Claude!"
    }
  ],
  "model": "claude-3-sonnet-20240229", // optional
  "max_tokens": 1024 // optional
}
```

#### Vision Endpoint
```typescript
POST /api/anthropic/vision
Content-Type: application/json

{
  "image": "base64_encoded_image_data",
  "mediaType": "image/jpeg",
  "prompt": "Analyze this image"
}
```

#### Invoice Extraction Endpoint
```typescript
POST /api/anthropic/extract-invoice
Content-Type: multipart/form-data

FormData:
- file: [invoice image file]
```

### React Hooks

#### useAnthropic
```typescript
import { useAnthropic } from '@/app/hooks/useAnthropic';

const { sendMessage, validateApiKey } = useAnthropic();

// Send a message to Claude
const response = await sendMessage([
  { role: 'user', content: 'Hello!' }
]);
```

#### useAnthropicVision
```typescript
import { useAnthropicVision } from '@/app/hooks/useAnthropicVision';

const { extractInvoice, analyzeImage } = useAnthropicVision();

// Extract invoice data
const invoiceData = await extractInvoice(file);

// Analyze any image
const analysis = await analyzeImage(file, 'What is in this image?');
```

## Service Configuration

The Anthropic service is configured in `/lib/anthropic/config.ts`:

```typescript
{
  defaultModel: 'claude-3-sonnet-20240229',
  visionModel: 'claude-3-opus-20240229',
  maxImageSize: 10MB,
  maxImagesPerRequest: 20,
  tokensPerImage: ~1600
}
```

## Vision Limitations

- **Max file size**: 10MB per image
- **Supported formats**: JPEG, PNG, GIF, WebP
- **Max images per request**: 20 (API supports 100)
- **Token usage**: ~1600 tokens per image

## Error Handling

The integration includes comprehensive error handling:

- Invalid API key detection
- Rate limit handling
- Image format validation
- Size limit checking
- Network error recovery

## Cost Considerations

- **Claude 3 Opus**: ~$15/1M input tokens
- **Claude 3 Sonnet**: ~$3/1M input tokens
- **Claude 3 Haiku**: ~$0.25/1M input tokens
- **Images**: ~1600 tokens each

## Security

- API keys are stored securely in environment variables
- Keys are never exposed to the client
- All API calls are made server-side
- Images are processed ephemerally (not stored)

## Troubleshooting

### API Key Issues
- Ensure key starts with `sk-ant-`
- Check for trailing spaces
- Verify key is active in Anthropic Console

### Vision Not Working
- Check image format (JPEG, PNG, GIF, WebP only)
- Verify file size (<10MB)
- Ensure API key has vision access

### Railway Deployment
- Verify ANTHROPIC_API_KEY is set in Variables
- Check build logs for errors
- Ensure deployment succeeded

## Examples

### Extract Invoice from Code
```typescript
const handleInvoiceUpload = async (file: File) => {
  const { extractInvoice } = useAnthropicVision();
  
  try {
    const data = await extractInvoice(file);
    console.log('Vendor:', data.vendor?.name);
    console.log('Total:', data.totals.total);
    console.log('Due Date:', data.invoice.dueDate);
  } catch (error) {
    console.error('Extraction failed:', error);
  }
};
```

### Custom Image Analysis
```typescript
const analyzeDocument = async (file: File) => {
  const { analyzeImage } = useAnthropicVision();
  
  const result = await analyzeImage(
    file,
    'Is this a valid invoice? List any issues you find.'
  );
  
  console.log(result.content[0].text);
};
```

## Support

For issues or questions:
- Check [Anthropic Documentation](https://docs.anthropic.com/)
- Review error messages in browser console
- Verify environment variables are set correctly