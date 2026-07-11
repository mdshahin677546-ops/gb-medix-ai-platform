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
  const provider = getConfiguredAIProviderName(env);

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

export function getConfiguredAIProviderName(env: NodeJS.ProcessEnv = process.env): AIProviderName {
  return normalizeProvider(env.AI_PROVIDER || "openai");
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

  logAIProviderRequestError(error);
  return {
    message: "AI provider request failed. Please try again later.",
    status: 502
  };
}

function logAIProviderRequestError(error: unknown) {
  console.error("[ai-provider-request-error]", {
    provider: getProviderForLog(),
    model: getModelForLog(),
    baseURLHost: getBaseURLHostForLog(),
    status: getErrorField(error, "status"),
    code: getErrorField(error, "code"),
    type: getErrorField(error, "type"),
    param: getErrorField(error, "param"),
    name: error instanceof Error ? error.name : getErrorField(error, "name"),
    message: getSanitizedErrorMessage(error)
  });
}

function getProviderForLog() {
  try {
    return getConfiguredAIProviderName();
  } catch {
    return "unknown";
  }
}

function getModelForLog() {
  const provider = getProviderForLog();
  if (provider === "deepseek") {
    return process.env.DEEPSEEK_MODEL || process.env.AI_MODEL || defaultDeepSeekModel;
  }
  if (provider === "openai") {
    return process.env.OPENAI_MODEL || process.env.AI_MODEL || defaultOpenAIModel;
  }
  return process.env.AI_MODEL || "unknown";
}

function getBaseURLHostForLog() {
  const provider = getProviderForLog();
  if (provider !== "deepseek") return undefined;
  const raw = process.env.DEEPSEEK_BASE_URL || defaultDeepSeekBaseURL;
  try {
    return new URL(raw).host;
  } catch {
    return "invalid-url";
  }
}

function getErrorField(error: unknown, key: string) {
  if (typeof error !== "object" || error === null) return undefined;
  const obj = error as Record<string, unknown>;
  const direct = obj[key];
  if (typeof direct === "string" || typeof direct === "number") return direct;

  const nested =
    typeof obj.error === "object" && obj.error !== null
      ? (obj.error as Record<string, unknown>)
      : null;
  const nestedValue = nested?.[key];
  return typeof nestedValue === "string" || typeof nestedValue === "number"
    ? nestedValue
    : undefined;
}

function getSanitizedErrorMessage(error: unknown) {
  const direct = error instanceof Error ? error.message : getErrorField(error, "message");
  if (typeof direct !== "string") return undefined;
  return direct
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{12,}/gi, "[redacted]")
    .replace(/key:\([^)]+\)/gi, "key:([redacted])")
    .replace(/\btid:\s*[A-Za-z0-9_-]+/gi, "tid:[redacted]")
    .replace(/\b[A-Za-z0-9_-]{48,}\b/g, "[redacted-token]")
    .slice(0, 300);
}
