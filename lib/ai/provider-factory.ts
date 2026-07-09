import { DeepSeekProvider } from "@/lib/ai/providers/deepseek";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import {
  AIProviderConfigError,
  type AIProvider,
  type AIProviderName
} from "@/lib/ai/providers/types";

const defaultOpenAIModel = "gpt-4o-mini";
const defaultDeepSeekBaseURL = "https://api.deepseek.com";
const defaultDeepSeekModel = "deepseek-chat";

export function getAIProvider(env: NodeJS.ProcessEnv = process.env): AIProvider {
  const provider = normalizeProvider(env.AI_PROVIDER || "openai");

  if (provider === "openai") {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AIProviderConfigError(
        "OPENAI_API_KEY is required when AI_PROVIDER=openai."
      );
    }

    return new OpenAIProvider({
      name: "openai",
      apiKey,
      model: env.OPENAI_MODEL || env.AI_MODEL || defaultOpenAIModel
    });
  }

  if (provider === "deepseek") {
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new AIProviderConfigError(
        "DEEPSEEK_API_KEY is required when AI_PROVIDER=deepseek."
      );
    }

    return new DeepSeekProvider({
      name: "deepseek",
      apiKey,
      baseURL: env.DEEPSEEK_BASE_URL || defaultDeepSeekBaseURL,
      model: env.DEEPSEEK_MODEL || env.AI_MODEL || defaultDeepSeekModel
    });
  }

  throw new AIProviderConfigError(`AI provider "${provider}" is reserved but not implemented.`);
}

export function normalizeProvider(value: string): AIProviderName {
  const provider = value.toLowerCase().trim();
  if (
    provider === "openai" ||
    provider === "deepseek" ||
    provider === "qwen" ||
    provider === "kimi" ||
    provider === "glm" ||
    provider === "doubao"
  ) {
    return provider;
  }

  throw new AIProviderConfigError(`Unsupported AI_PROVIDER: ${value}`);
}

export function getSafeAIError(error: unknown) {
  if (error instanceof AIProviderConfigError) {
    return { message: "AI provider is not configured.", status: 503 };
  }

  if (error instanceof Error && error.name === "AIProviderOutputError") {
    return { message: error.message, status: 502 };
  }

  return {
    message: "AI provider request failed. Please try again later.",
    status: 502
  };
}
