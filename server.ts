import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      service: 'AgriHub Gateway',
      aiConfigured: Boolean(getGeminiClient()),
      timestamp: new Date().toISOString(),
    });
  });

  // Server-side Gemini AI Assistant endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, language, history, catalogSummary } = req.body ?? {};

      if (typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a message before sending.',
        });
      }

      if (message.trim().length > 1500) {
        return res.status(400).json({
          success: false,
          message: 'Message is too long. Please keep questions under 1,500 characters.',
        });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          success: false,
          code: 'GEMINI_KEY_MISSING',
          message:
            language === 'bn'
              ? 'এআই সহায়ক চালু করতে Settings > Secrets প্যানেলে GEMINI_API_KEY সেট করুন।'
              : 'AI Assistant requires a GEMINI_API_KEY configured in the Settings > Secrets panel.',
        });
      }

      const langInstruction =
        language === 'bn'
          ? 'Respond primarily in natural, warm, professional Bangla (বাংলা) unless the user clearly writes in English.'
          : 'Respond in clear, concise, friendly English unless the user writes in Bangla (বাংলা), in which case reply in natural Bangla.';

      const catalogContext =
        typeof catalogSummary === 'string' && catalogSummary.trim().length > 0
          ? `\n\nLive Marketplace Catalog Snapshot:\n${catalogSummary.slice(0, 3500)}`
          : '';

      const systemInstruction = `You are the AgriHub Agricultural Assistant for "AgriHub — Bangladesh's Trusted Agricultural Trade Network".
Your purpose is to help Farmers, Buyers, Transport Partners, and Marketplace visitors across Bangladesh.

Core Capabilities:
1. Product Search & Sourcing: Help buyers find fresh harvest batches (mangoes, aromatic rice, fresh milk, mustard oil, seasonal vegetables), pricing, organic status, and ideal cold-storage temperatures.
2. Farmer Guidance: Explain how farmers register on /register, get verified, prepare harvest batches, and coordinate collection at regional hubs (Dhaka, Rajshahi, Bogura, Chattogram, Sylhet).
3. Buyer Guidance: Explain how buyers browse /marketplace, inspect harvest origin/batch traceability, place wholesale orders, and track delivery in /buyer or /portal.
4. Logistics & Cold-Chain FAQs: Explain refrigerated transport (2°C-8°C), route checkpoints, and tracking codes (e.g., TRK-COLD-2026-8812).
5. Platform Navigation: Direct users to relevant routes such as /marketplace, /login, /register, /forgot-password, /farmer, /buyer, /logistics.

Rules:
- Keep answers concise, practical, and easy to read (short paragraphs or bullet points).
- Format all prices in Bangladeshi Taka: use "BDT 1,250" when writing in English and "৳ ১,২৫০" when writing in Bangla. Never use "$".
- Never mention internal software terms like MySQL, SQL, PDO, backend diagnostics, schemas, or APIs. Speak naturally about AgriHub's agricultural trade network, verified farmers, cold-chain hubs, and marketplace.
- Never fabricate order confirmations or claim an order was placed unless the user submits an order through the marketplace UI.
- ${langInstruction}${catalogContext}`;

      const safeHistory = Array.isArray(history)
        ? history
            .slice(-8)
            .filter(
              (item: any) =>
                item &&
                (item.role === 'user' || item.role === 'model') &&
                typeof item.text === 'string' &&
                item.text.trim().length > 0
            )
            .map((item: any) => ({
              role: item.role as 'user' | 'model',
              parts: [{ text: item.text.slice(0, 1200) }],
            }))
        : [];

      const contents = [
        ...safeHistory,
        {
          role: 'user' as const,
          parts: [{ text: message.trim() }],
        },
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        return res.status(502).json({
          success: false,
          message: 'Assistant returned an empty response. Please try again.',
        });
      }

      return res.json({
        success: true,
        reply,
      });
    } catch (err: any) {
      const rawMessage = String(err?.message || 'Unable to generate assistant response.');
      const parsedStatus =
        Number(err?.status || err?.statusCode || err?.code) ||
        (rawMessage.includes('429')
          ? 429
          : rawMessage.includes('404')
          ? 404
          : rawMessage.includes('403')
          ? 403
          : rawMessage.includes('401')
          ? 401
          : rawMessage.includes('400')
          ? 400
          : 500);
      console.error('AgriHub AI Chat error:', parsedStatus, rawMessage);

      if (parsedStatus === 400 || parsedStatus === 401 || parsedStatus === 403) {
        return res.status(parsedStatus).json({
          success: false,
          message:
            'AI service credentials could not be verified. Please verify GEMINI_API_KEY in Settings > Secrets.',
        });
      }
      if (parsedStatus === 404) {
        return res.status(502).json({
          success: false,
          message: 'Configured AI model is temporarily unavailable. Please try again shortly.',
        });
      }
      if (parsedStatus === 429) {
        return res.status(429).json({
          success: false,
          message: 'AI assistant is currently busy. Please wait a few seconds and try again.',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Unable to connect to the AI assistant right now. Please try again shortly.',
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgriHub server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AgriHub server:', err);
  process.exit(1);
});
