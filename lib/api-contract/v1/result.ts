import { z } from "zod";
import { API_ERROR_CODES, type ApiErrorCode, RETRYABLE_API_ERROR_CODES } from "./error-codes";

/**
 * Unified success / failure envelopes shared across Web / Mobile / Agent.
 * The error envelope NEVER carries stack traces, provider raw errors, request /
 * response bodies, cookies, tokens, email, health data, or Prisma objects.
 * Planning: SHARED_WEB_MOBILE_API_CONTRACT.md §4.
 */
export type ApiSuccess<TData> = {
  ok: true;
  data: TData;
  requestId?: string;
};

export type ApiErrorResponse = {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    requestId?: string;
    retryable: boolean;
  };
};

export type ApiResult<TData> = ApiSuccess<TData> | ApiErrorResponse;

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);

export const apiErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: apiErrorCodeSchema,
        message: z.string().min(1),
        requestId: z.string().min(1).optional(),
        retryable: z.boolean()
      })
      .strict()
  })
  .strict();

export function apiSuccessSchema<TSchema extends z.ZodTypeAny>(dataSchema: TSchema) {
  return z
    .object({
      ok: z.literal(true),
      data: dataSchema,
      requestId: z.string().min(1).optional()
    })
    .strict();
}

export function ok<TData>(data: TData, requestId?: string): ApiSuccess<TData> {
  return requestId ? { ok: true, data, requestId } : { ok: true, data };
}

export function fail(
  code: ApiErrorCode,
  message: string,
  requestId?: string
): ApiErrorResponse {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(requestId ? { requestId } : {}),
      retryable: RETRYABLE_API_ERROR_CODES.has(code)
    }
  };
}
