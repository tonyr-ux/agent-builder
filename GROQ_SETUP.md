# Groq Integration Setup

This project includes Groq integration for fast, cost-effective AI chat capabilities, especially useful for the Agent Builder feature.

## Features

### 🚀 Groq AI Models
- **Llama 3.3 70B Versatile**: Most capable model for complex tasks
- **Llama 3.1 70B Versatile**: Balanced performance and speed
- **Llama 3.1 8B Instant**: Fast, cost-effective model
- **Mixtral 8x7B**: High-quality open-source model
- **Gemma 7B IT**: Google's efficient model

### ⚡ Key Benefits
- **Fast inference**: Groq's LPU (Language Processing Unit) provides ultra-fast responses
- **Cost-effective**: Lower costs compared to other providers
- **Open-source models**: Access to leading open-source LLMs
- **OpenAI-compatible API**: Easy integration

## Setup Instructions

### 1. Get Your Groq API Key

1. Visit [Groq Console](https://console.groq.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key

### 2. Local Development Setup

Add your API key to `.env.local`:

```env
GROQ_API_KEY=your-groq-api-key-here
```

Optional configuration:
```env
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_MAX_TOKENS=2048
```

### 3. Railway Deployment

In your Railway project:

1. Go to your Next.js app service (not database)
2. Click on "Variables" tab
3. Add new variable:
   - Name: `GROQ_API_KEY`
   - Value: Your Groq API key

Railway will automatically redeploy with the new configuration.

## Usage

### Agent Builder Chat

> **Note:** The Agent Builder chat now runs on Claude, not Groq - see
> `ANTHROPIC_SETUP.md`. Groq remains available through the endpoints below.

### API Endpoints

- **POST /api/groq/chat** - Send chat messages (streaming)
- **POST /api/groq/validate** - Validate API key
- **GET /api/groq/validate** - Check configuration status

### React Hook

Use the `useGroq` hook in your components:

```typescript
import { useGroq } from '@/app/hooks/useGroq';

const { loading, error, sendMessage, validateApiKey } = useGroq();

// Validate API key
await validateApiKey('your-api-key');

// Send a message
const response = await sendMessage([
  { role: 'user', content: 'Hello!' }
]);
```

## Available Models

- `llama-3.3-70b-versatile` (default) - Best for complex tasks
- `llama-3.1-70b-versatile` - Balanced performance
- `llama-3.1-8b-instant` - Fast responses
- `mixtral-8x7b-32768` - High quality
- `gemma-7b-it` - Efficient

## Rate Limits

- 30 requests per minute
- 10,000 tokens per minute
- 1,000 requests per day

## Troubleshooting

### API Key Not Working

1. Verify your API key in the Groq Console
2. Check that `GROQ_API_KEY` is set in your environment variables
3. Restart your development server after adding the key

### Rate Limit Errors

- Groq has generous free tier limits
- If you hit limits, wait a few minutes and try again
- Consider upgrading your Groq plan for higher limits

### Connection Errors

- Check your internet connection
- Verify Groq API status at [status.groq.com](https://status.groq.com)
- Ensure your API key hasn't been revoked

## Architecture

### Service Layer (`/lib/groq/`)
- **client.ts** - Groq client singleton
- **service.ts** - Core service methods (chat, validation)
- **config.ts** - Configuration and validation
- **types.ts** - TypeScript interfaces

### API Routes (`/app/api/groq/`)
- **POST /api/groq/chat** - Send chat messages (streaming)
- **POST /api/groq/validate** - Validate API keys

### React Hooks (`/app/hooks/`)
- **useGroq** - Main hook for all Groq operations
