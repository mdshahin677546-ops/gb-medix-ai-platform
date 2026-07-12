import { z } from "zod";

/**
 * Device metadata privacy allowlist (pure).
 *
 * ONLY platform / appVersion / deviceLabel / locale are permitted. The strict
 * schema rejects everything else — advertising ids, IMEI, Android ID, IDFA, MAC,
 * serials, contacts, precise location, full User-Agent, persistent fingerprints,
 * patient data, email, phone — and there is no arbitrary-object escape hatch.
 */

export const ALLOWED_DEVICE_METADATA_KEYS = [
  "platform",
  "appVersion",
  "deviceLabel",
  "locale"
] as const;

export const DEVICE_LABEL_MAX_LENGTH = 64;

/**
 * Reject C0 controls, DEL, and the Unicode line/paragraph separators (U+2028 /
 * U+2029) — these enable log/UI injection. All other Unicode (accents, CJK,
 * emoji) is allowed; the label is NOT restricted to ASCII and is never turned
 * into a persistent device fingerprint.
 */
function hasUnsafeLabelChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029) return true;
  }
  return false;
}

/**
 * A human-readable device name: no control/separator chars, surrounding
 * whitespace trimmed, and not blank after trimming.
 */
export const deviceLabelSchema = z
  .string()
  .min(1)
  .max(DEVICE_LABEL_MAX_LENGTH)
  .refine((s) => !hasUnsafeLabelChars(s))
  .transform((s) => s.trim())
  .refine((s) => s.length > 0);

export const deviceMetadataSchema = z
  .object({
    platform: z.enum(["ios", "android"]).optional(),
    appVersion: z
      .string()
      .min(1)
      .max(32)
      .regex(/^[0-9A-Za-z.+-]+$/)
      .optional(),
    deviceLabel: deviceLabelSchema.optional(),
    locale: z.enum(["en", "zh"]).optional()
  })
  .strict();
export type DeviceMetadata = z.infer<typeof deviceMetadataSchema>;

export type DeviceMetadataResult =
  | { ok: true; metadata: DeviceMetadata }
  | { ok: false; rejectedKeys: string[] };

/**
 * Validate untrusted device metadata. Returns the offending keys on rejection
 * (never the values), so a forbidden field can never be silently dropped and
 * then carried forward.
 */
export function sanitizeDeviceMetadata(input: unknown): DeviceMetadataResult {
  const parsed = deviceMetadataSchema.safeParse(input);
  if (parsed.success) return { ok: true, metadata: parsed.data };

  const allowed = new Set<string>(ALLOWED_DEVICE_METADATA_KEYS);
  const rejectedKeys =
    input && typeof input === "object" && !Array.isArray(input)
      ? Object.keys(input as Record<string, unknown>).filter((k) => !allowed.has(k))
      : ["<invalid>"];
  return { ok: false, rejectedKeys: rejectedKeys.length ? rejectedKeys : ["<invalid>"] };
}
