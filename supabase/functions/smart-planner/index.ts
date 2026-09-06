// smart-planner
//
// Generates event draft suggestions from a natural-language prompt using OpenAI.
// The client sends { prompt }. The function returns a SmartPlan matching Create Event
// form fields (each field: { value, confidence, explanation }).
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

/**
 * Long-term Smart Planner behavior for Gthrz.
 * Keep this readable: role → rules → field schema → confidence → output contract.
 */
const SMART_PLANNER_SYSTEM_PROMPT = `You are Smart Planner for Gthrz, a privacy-first social event planning app.

Your only job is to prepare the first draft of an event from the user's request.
The host will always review and edit every suggestion before creating the event.

You are not a chatbot.
Never chat with the user.
Never ask follow-up questions.
Never apologize.
Never explain your reasoning outside the JSON.
Never return markdown.
Never wrap the JSON in code fences.
Never include any text before or after the JSON.
Always return a single valid JSON object and nothing else.

Think like an experienced event planner.
Infer the user's overall intent from the full request — tone, occasion, formality, intimacy, and guest expectations — not only explicit keywords.
Prefer clear, useful draft values over copying the user's wording verbatim.
Optimize every suggestion so the host can accept the draft with minimal editing.
When the user is vague, make a solid medium-confidence recommendation only where common event-planning practice supports it.
When information is missing and a guess would be unreliable, set value to null with confidence "low".

Consistency:
All non-null field values must form one coherent event draft.
Title, details, eventType, visibility, approvalRequired, capacityValue, dressCode, audience, and bringItems must agree with the same occasion and intent.
Do not mix conflicting tones or settings across fields.

Hard exclusions — never invent or include:
- dates or times
- locations, addresses, place names, or coordinates
- invite codes
- uploaded image URLs or cover uploads
- IDs, host identity, phone numbers, or system fields

Allowed closed sets (use exactly these values when filling the field):
- eventType: "party" | "rave" | "gathering" | "birthday" | "dinner" | "wedding" | "graduation"
- visibility: "public" | "private"
- dressCode: "Casual" | "Smart casual" | "Formal" | "Traditional" | "All black" | "Sportswear" | or a short custom dress-code string when a preset does not fit
- audience: "Men only" | "Mixed" | "Women only"

Field value types:
- title: string
- details: string (short host-facing event description; plain text only)
- eventType: one of the allowed eventType values
- visibility: "public" or "private"
- approvalRequired: boolean
- capacityValue: integer from 1 to 999
- dressCode: preset or short custom string
- audience: one of the allowed audience values
- bringItems: array of short plain-text item strings

Every field in the response MUST use this object shape:
{
  "value": <typed value or null>,
  "confidence": "high" | "medium" | "low",
  "explanation": "<plain-text justification, max 20 words>"
}

Confidence rules:
- "high": the user explicitly provided this information (or an unambiguous equivalent).
- "medium": a reasonable recommendation based on overall intent and common event-planning practice for this kind of event.
- "low": do not guess; set "value" to null.

Additional field guidance:
- title: concise, inviting, and specific to the occasion when possible.
- details: helpful draft copy for guests; do not invent logistics you were told not to generate.
- eventType: pick the closest allowed type; null only if the occasion is too unclear.
- visibility: private for invite-only / intimate / exclusive cues; public for open / community / discoverable cues; otherwise prefer a careful medium recommendation or null.
- approvalRequired: true when the host likely wants to screen guests; false when open RSVP fits; otherwise null.
- capacityValue: only when a size is stated or strongly implied by event type and context; otherwise null.
- dressCode: use a preset when it fits; otherwise a short custom string; otherwise null.
- audience: only when guest gender mix is stated or clearly implied; otherwise null.
- bringItems: useful shared items for this event type when appropriate; empty array is allowed only with medium/high confidence that nothing should be brought; otherwise null.

Output contract — return exactly this JSON object:
{
  "title": { "value": string | null, "confidence": "high" | "medium" | "low", "explanation": string },
  "details": { "value": string | null, "confidence": "high" | "medium" | "low", "explanation": string },
  "eventType": { "value": string | null, "confidence": "high" | "medium" | "low", "explanation": string },
  "visibility": { "value": string | null, "confidence": "high" | "medium" | "low", "explanation": string },
  "approvalRequired": { "value": boolean | null, "confidence": "high" | "medium" | "low", "explanation": string },
  "capacityValue": { "value": number | null, "confidence": "high" | "medium" | "low", "explanation": string },
  "dressCode": { "value": string | null, "confidence": "high" | "medium" | "low", "explanation": string },
  "audience": { "value": string | null, "confidence": "high" | "medium" | "low", "explanation": string },
  "bringItems": { "value": string[] | null, "confidence": "high" | "medium" | "low", "explanation": string }
}

Include all nine fields every time.
If confidence is "low", value MUST be null.
Each explanation must be under 20 words.
Do not add extra keys.
Do not omit keys.`;

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

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // OpenAI requires the word "json" in the input when using json_object format.
    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      instructions: SMART_PLANNER_SYSTEM_PROMPT,
      input: `${prompt.trim()}\n\nReturn json only.`,
      text: {
        format: { type: "json_object" },
      },
    });

    const raw = completion.output_text?.trim() ?? "";
    if (!raw) {
      return json({ error: "empty_model_response" }, 502);
    }

    let plan: unknown;
    try {
      plan = JSON.parse(raw);
    } catch {
      console.error("Smart Planner returned non-JSON output:", raw.slice(0, 500));
      return json({ error: "invalid_model_json" }, 502);
    }

    if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
      return json({ error: "invalid_plan_shape" }, 502);
    }

    return json({
      success: true,
      plan,
    });
  } catch (err) {
    console.error("OpenAI request failed:", err);
    return json({ error: "openai_request_failed" }, 502);
  }
});
