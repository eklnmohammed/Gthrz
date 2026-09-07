import { supabase } from "@/src/lib/supabase";

/** Upper bound for the Smart Planner prompt (UI + client validation). */
export const SMART_PLANNER_PROMPT_MAX_LENGTH = 300;

export type SmartPlannerConfidence = "high" | "medium" | "low";

export type SmartPlannerField<T> = {
  value: T | null;
  confidence: SmartPlannerConfidence;
  explanation: string;
};

/** Draft returned by the smart-planner Edge Function. Not applied to the form yet. */
export type SmartPlan = {
  title: SmartPlannerField<string>;
  details: SmartPlannerField<string>;
  eventType: SmartPlannerField<string>;
  visibility: SmartPlannerField<string>;
  approvalRequired: SmartPlannerField<boolean>;
  capacityValue: SmartPlannerField<number>;
  dressCode: SmartPlannerField<string>;
  audience: SmartPlannerField<string>;
  bringItems: SmartPlannerField<string[]>;
};

export type SmartPlannerResult =
  | { ok: true; plan: SmartPlan }
  | { ok: false; message: string };

function messageForErrorCode(code: string | undefined): string {
  switch (code) {
    case "missing_prompt":
    case "empty_prompt":
      return "Enter a short description of your event.";
    case "openai_not_configured":
      return "Smart Planner isn’t available right now. Try again later.";
    case "empty_model_response":
    case "invalid_model_json":
    case "invalid_plan_shape":
    case "openai_request_failed":
      return "Smart Planner couldn’t prepare a draft. Try again.";
    default:
      return "Smart Planner couldn’t prepare a draft. Try again.";
  }
}

/**
 * Calls the smart-planner Edge Function and returns a typed plan or a user-facing error.
 * Does not mutate Create Event form state.
 */
export async function requestSmartPlan(prompt: string): Promise<SmartPlannerResult> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter a short description of your event." };
  }
  if (trimmed.length > SMART_PLANNER_PROMPT_MAX_LENGTH) {
    return {
      ok: false,
      message: `Keep your description under ${SMART_PLANNER_PROMPT_MAX_LENGTH} characters.`,
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, message: "Sign in to use Smart Planner." };
  }

  try {
    const { data, error } = await supabase.functions.invoke("smart-planner", {
      body: { prompt: trimmed },
    });

    if (error) {
      // Prefer the function JSON body when present (FunctionsHttpError).
      let code: string | undefined;
      try {
        const ctx = error as { context?: Response };
        if (ctx.context && typeof ctx.context.json === "function") {
          const body = await ctx.context.json();
          if (body && typeof body === "object" && "error" in body) {
            code = String((body as { error: unknown }).error);
          }
        }
      } catch {
        // ignore parse failures; fall through to generic message
      }
      return { ok: false, message: messageForErrorCode(code) };
    }

    if (!data || typeof data !== "object" || data.success !== true || !data.plan) {
      return { ok: false, message: messageForErrorCode(data?.error) };
    }

    if (typeof data.plan !== "object" || Array.isArray(data.plan)) {
      return { ok: false, message: messageForErrorCode("invalid_plan_shape") };
    }

    return { ok: true, plan: data.plan as SmartPlan };
  } catch {
    return { ok: false, message: "Can’t reach Smart Planner. Check your connection and try again." };
  }
}
