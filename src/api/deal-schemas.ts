import { z } from "zod";
import { DEAL_STAGES } from "../config/constants.js";

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional();
const nullableDate = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional();
const nullableMoney = z
  .number()
  .int()
  .nonnegative()
  .max(1_000_000_000_00)
  .nullable()
  .optional();
const nullablePercent = z.number().int().min(0).max(100).nullable().optional();
const httpUrl = z
  .string()
  .url()
  .refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    "Must be an HTTP or HTTPS URL",
  )
  .nullable()
  .optional();
const jsonObject = z.record(z.string(), z.unknown());

const fields = {
  brandName: z.string().trim().min(1, "Brand name is required").max(200),
  brandContactEmail: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(320)
    .nullable()
    .optional(),
  brandContactName: nullableText(200),
  brandDomain: nullableText(255),
  stage: z.enum(DEAL_STAGES).optional(),
  fitScore: nullablePercent,
  estimatedValueCents: nullableMoney,
  actualValueCents: nullableMoney,
  sourceUrl: httpUrl,
  sourceType: nullableText(100),
  sourceConfidence: nullablePercent,
  sourceEvidence: z.array(jsonObject).max(100).optional(),
  deliverables: z.array(jsonObject).max(100).optional(),
  deadlineAt: nullableDate,
  followUpAt: nullableDate,
  probability: nullablePercent,
  nextAction: nullableText(2_000),
  agentProvenance: jsonObject.optional(),
  archivedAt: nullableDate,
  pitchText: nullableText(50_000),
  pitchSentAt: nullableDate,
  responseText: nullableText(50_000),
  respondedAt: nullableDate,
  contractNotes: nullableText(10_000),
  notes: nullableText(10_000),
  metadata: jsonObject.optional(),
};

export const createDealRequestSchema = z.object(fields).strict();
export const updateDealRequestSchema = z
  .object({ ...fields, brandName: fields.brandName.optional() })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );
export const updateDealStageRequestSchema = z
  .object({ stage: z.enum(DEAL_STAGES) })
  .strict();

export type DealRequest = z.infer<typeof createDealRequestSchema>;

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const output: Record<string, string[]> = {};
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) output[key] = ["Unknown field"];
      continue;
    }
    const field = String(issue.path[0] ?? "form");
    (output[field] ??= []).push(issue.message);
  }
  return output;
}
