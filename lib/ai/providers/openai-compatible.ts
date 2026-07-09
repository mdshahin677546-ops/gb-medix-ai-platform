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
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(content);
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
