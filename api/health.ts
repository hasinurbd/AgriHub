export default function handler(_req: any, res: any) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const aiConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');

  res.status(200).json({
    success: true,
    service: 'AgriHub Vercel Serverless Gateway',
    aiConfigured,
    phpBackendConfigured: Boolean(process.env.VITE_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL),
    timestamp: new Date().toISOString(),
  });
}
