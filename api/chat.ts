import { GoogleGenAI, ThinkingLevel } from '@google/genai';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
    const { message, language, history, catalogSummary } = body;

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
            ? 'এআই সহায়ক চালু করতে সার্ভার এনভায়রনমেন্টে GEMINI_API_KEY সেট করুন।'
            : 'AI Assistant requires GEMINI_API_KEY to be configured in your deployment environment.',
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
Keep answers concise, practical, and easy to read. Format all prices in Bangladeshi Taka ("BDT 1,250" in English, "৳ ১,২৫০" in Bangla).
Direct users to routes like /marketplace, /login, /register, /farmer, /buyer, /logistics, /admin/dashboard.
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

    return res.status(200).json({
      success: true,
      reply,
    });
  } catch (err: any) {
    console.error('AgriHub Vercel AI Chat error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: 'Unable to connect to the AI assistant right now. Please try again shortly.',
    });
  }
}
