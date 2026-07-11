import type { z } from "zod";
import type { StructuredReport } from "@/lib/report-schema";

export type AIProviderName =
  | "openai"
  | "deepseek"
  | "qwen"
  | "kimi"
  | "glm"
  | "doubao";

export type AIProviderUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens: number;
};

export type AIProviderResult<TContent = string> = {
  content: TContent;
  raw: unknown;
  usage: AIProviderUsage;
  provider: AIProviderName;
  model: string;
};

export type AIChatMessage = {
  role: "system" | "user" | "assistant";
  content: unknown;
};

export type ChatCompletionRequest = {
  systemPrompt: string;
  messages: AIChatMessage[];
  temperature?: number;
  fallbackContent?: string;
};

export type StructuredJSONRequest<TSchema extends z.ZodTypeAny> = {
  systemPrompt: string;
  payload: unknown;
  schema: TSchema;
  temperature?: number;
};

export type HealthAssessmentRequest = {
  systemPrompt: string;
  input: unknown;
  temperature?: number;
};

export type ReportGenerationRequest = {
  systemPrompt: string;
  input: unknown;
  temperature?: number;
};

export interface AIProvider {
  name: AIProviderName;
  model: string;
  generateHealthAssessment(
    input: HealthAssessmentRequest
  ): Promise<AIProviderResult<StructuredReport>>;
  generateReport(input: ReportGenerationRequest): Promise<AIProviderResult<StructuredReport>>;
  generateChatCompletion(input: ChatCompletionRequest): Promise<AIProviderResult<string>>;
  generateStructuredJSON<TSchema extends z.ZodTypeAny>(
    input: StructuredJSONRequest<TSchema>
  ): Promise<AIProviderResult<z.output<TSchema>>>;
}

export class AIProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIProviderConfigError";
  }
}

export type AIOutputFailureStage = "json_parse" | "schema_validation";

export class AIProviderOutputError extends Error {
  readonly stage: AIOutputFailureStage;
  constructor(message: string, stage: AIOutputFailureStage = "json_parse") {
    super(message);
    this.name = "AIProviderOutputError";
    this.stage = stage;
  }
}
