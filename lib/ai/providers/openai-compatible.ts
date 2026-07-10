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
    // markdown code fence or add surrounding prose even in json_object mode.
    // Extract the JSON object defensively, then STILL require strict JSON +
    // schema validation. Invalid output throws (safe 502) and is never stored.
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(extractJsonObject(content));
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
 * Extract a JSON object string from a model response that may be wrapped in a
 * markdown code fence (```json ... ```) or surrounded by prose. This does NOT
 * relax validation: the caller still runs JSON.parse + Zod safeParse, so any
 * non-JSON or schema-invalid output is rejected with a safe error. When no
 * object boundary is found, the trimmed input is returned unchanged so the
 * subsequent JSON.parse fails and a safe 502 is raised.
 */
export function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = (fenced ? fenced[1] : trimmed).trim();
  if (body.startsWith("{") && body.endsWith("}")) return body;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start !== -1 && end > start) return body.slice(start, end + 1);
  return body;
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
