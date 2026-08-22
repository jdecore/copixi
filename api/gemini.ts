/**
 * Copixi — Vercel Function proxy to Gemini API
 * AGENTS.md §11: Minimal proxy only. Protects GEMINI_API_KEY, validates payload,
 * calls Gemini, returns response. No traditional backend.
 *
 * Runtime: Vercel Serverless (Node). Keep single endpoint, no complex API.
 */

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

// Basic rate-limit in-memory (per function instance). Trivial, not distributed.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = hits.get(ip) ?? [];
  const recent = arr.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? "unknown";
  if (Array.isArray(forwarded)) return forwarded[0] ?? "unknown";
  return "unknown";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server misconfiguration: GEMINI_API_KEY not set." });
    return;
  }

  // Validate payload — expect CopilotKit / generic chat format
  const body = req.body as { messages?: unknown; context?: unknown } | undefined;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Invalid payload: expected JSON object." });
    return;
  }

  // Sanitize: limit messages length and context size to control tokens (AGENTS.md §9)
  const messages = (body as { messages?: unknown }).messages;
  if (messages !== undefined && !Array.isArray(messages)) {
    res.status(400).json({ error: "Invalid payload: messages must be array." });
    return;
  }
  if (Array.isArray(messages) && messages.length > 50) {
    res.status(400).json({ error: "Too many messages (max 50)." });
    return;
  }

  try {
    // Forward to Gemini API — minimal example using @google/generative-ai REST
    // Keep token-efficient: caller should have sent aggregated context only (§8)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const prompt = Array.isArray(messages)
      ? messages
          .map((m: unknown) => {
            const msg = m as { role?: string; content?: string };
            return `${msg.role ?? "user"}: ${msg.content ?? ""}`;
          })
          .join("\n")
      : JSON.stringify(body).slice(0, 8000);

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      res.status(geminiRes.status).json({ error: "Gemini API error", detail: errText.slice(0, 500) });
      return;
    }

    const data = await geminiRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ text, raw: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Internal error calling Gemini", detail: message.slice(0, 500) });
  }
}
