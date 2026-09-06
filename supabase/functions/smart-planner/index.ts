// smart-planner
//
// Generates event draft suggestions from a natural-language prompt using OpenAI.
// The client sends { prompt }. The function returns structured event data matching
// the Create Event form fields.
//
// Deploy: supabase functions deploy smart-planner
// Env: OPENAI_API_KEY

import OpenAI from "npm:openai";

interface RequestBody {
  prompt?: string;
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only accept POST requests.
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // Parse and validate the request body.
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { prompt } = body;

  // Validate required fields.
  if (!prompt || typeof prompt !== "string") {
    return json({ error: "missing_prompt" }, 400);
  }

  if (prompt.trim().length === 0) {
    return json({ error: "empty_prompt" }, 400);
  }

  // Check that OpenAI API key is configured.
  if (!OPENAI_API_KEY) {
    return json({ error: "openai_not_configured" }, 503);
  }

  // Call OpenAI — connection check only (no SmartPlan yet).
  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "user",
          content:
            `Reply with one short plain-text sentence acknowledging this event planning request:\n\n${prompt.trim()}`,
        },
      ],
    });

    const response = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!response) {
      return json({ error: "empty_model_response" }, 502);
    }

    return json({
      success: true,
      response,
    });
  } catch (err) {
    console.error("OpenAI request failed:", err);
    return json({ error: "openai_request_failed" }, 502);
  }
});
