import OpenAI from "openai";
import { z } from "zod";
import { ReportSchema } from "@/lib/report-schema";
import { buildMinimalHealthPayload, sanitizeAIInput } from "@/lib/ai/sanitize";
import type {
  AIProvider,
  AIProviderName,
  AIProviderResult,
  AIProviderUsage,
  ChatCompletionRequest,
  HealthAssessmentRequest,
  ReportGenerationRequest,
  StructuredJSONRequest
} from "@/lib/ai/providers/types";
import { AIProviderOutputError } from "@/lib/ai/providers/types";

type ProviderConfig = {
  name: AIProviderName;
  apiKey: string;
  model: string;
  baseURL?: string;
};

export class OpenAICompatibleProvider implements AIProvider {
  readonly name: AIProviderName;
  readonly model: string;
  private readonly client: OpenAI;

  constructor({ name, apiKey, model, baseURL }: ProviderConfig) {
    this.name = name;
    this.model = model;
    this.client = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {})
    });
  }

  async generateHealthAssessment(input: HealthAssessmentRequest) {
    return this.generateStructuredJSON({
      systemPrompt: input.systemPrompt,
      payload: input.input,
      schema: ReportSchema,
      temperature: input.temperature ?? 0.5
    });
  }

  async generateReport(input: ReportGenerationRequest) {
    return this.generateStructuredJSON({
      systemPrompt: input.systemPrompt,
      payload: input.input,
      schema: ReportSchema,
      temperature: input.temperature ?? 0.4
    });
  }

  async generateChatCompletion(input: ChatCompletionRequest): Promise<AIProviderResult<string>> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: input.temperature ?? 0.4,
      messages: [
        { role: "system", content: input.systemPrompt },
        ...input.messages.map((message) => ({
          role: message.role,
          content: sanitizeAIInput(message.content)
        }))
      ] as any
    });

    return {
      content: completion.choices[0]?.message.content || input.fallbackContent || "",
      raw: completion,
      usage: normalizeUsage(completion.usage),
      provider: this.name,
      model: this.model
    };
  }

  async generateStructuredJSON<TSchema extends z.ZodTypeAny>(
    input: StructuredJSONRequest<TSchema>
  ): Promise<AIProviderResult<z.output<TSchema>>> {
    const minimalPayload = buildMinimalHealthPayload(input.payload);
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: input.temperature ?? 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: JSON.stringify(minimalPayload) }
      ]
    });

    const content = completion.choices[0]?.message.content || "";
    // Some OpenAI-compatible providers (e.g. DeepSeek) may wrap the JSON in a
    // markdown code fence or surround a single JSON object with prose, even in
    // json_object mode. Extract exactly one top-level JSON object, then STILL
    // enforce strict JSON.parse + Zod validation. Anything else (top-level
    // array, multiple objects, truncated, empty) is rejected with a safe error
    // (502) and is never stored.
    const candidate = extractTopLevelJsonObject(content);
    if (candidate === null) {
      throw new AIProviderOutputError("AI report output was not valid JSON.");
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(candidate);
    } catch {
      throw new AIProviderOutputError("AI report output was not valid JSON.");
    }

    const parsed = input.schema.safeParse(rawJson);
    if (!parsed.success) {
      throw new AIProviderOutputError("AI report output failed schema validation.");
    }

    return {
      content: parsed.data,
      raw: completion,
      usage: normalizeUsage(completion.usage),
      provider: this.name,
      model: this.model
    };
  }
}

/**
 * Extract exactly one top-level JSON object from a model response.
 *
 * Accepts: a bare JSON object, an object wrapped in a ```json code fence, or a
 * single object surrounded by plain prose. Rejects (returns null): top-level
 * arrays (including single-element arrays), multiple parallel objects, an
 * object followed by another object/array, truncated/unbalanced input, and
 * empty input. Scanning is string- and escape-aware, so braces inside JSON
 * string values do not affect brace balancing, and nested objects are handled.
 *
 * This does NOT relax validation: the caller still runs JSON.parse + Zod
 * safeParse on the returned candidate, so anything non-JSON or schema-invalid
 * is still rejected with a safe error (502) and never stored.
 */
export function extractTopLevelJsonObject(text: string): string | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = (fenced ? fenced[1] : trimmed).trim();
  if (!body) return null;

  // A top-level JSON array is never a valid report object.
  if (body[0] === "[") return null;

  const start = body.indexOf("{");
  if (start === -1) return null;
  // Reject an array that merely has leading prose/whitespace before it.
  if (body.slice(0, start).includes("[")) return null;

  const end = scanBalancedObjectEnd(body, start);
  if (end === -1) return null; // truncated / unbalanced

  // Nothing resembling a second JSON value may follow the object. Plain prose
  // (containing neither '{' nor '[') after the object is allowed.
  const after = body.slice(end + 1);
  if (after.includes("{") || after.includes("[")) return null;

  return body.slice(start, end + 1);
}

/**
 * Index of the '}' that closes the object beginning at `start`, or -1 if it
 * never closes. String- and escape-aware: braces inside JSON string literals
 * are ignored so they cannot corrupt the depth count.
 */
function scanBalancedObjectEnd(s: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function normalizeUsage(usage?: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
} | null): AIProviderUsage {
  const inputTokens = usage?.prompt_tokens || 0;
  const outputTokens = usage?.completion_tokens || 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage?.total_tokens || inputTokens + outputTokens
  };
}
