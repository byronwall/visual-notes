import { z } from "zod";

const jsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const flatJsonRecord = z.record(jsonPrimitive);

export const archiveMetaSchema = z.object({
  description: z.string().nullable().optional(),
  ogTitle: z.string().nullable().optional(),
  ogDescription: z.string().nullable().optional(),
  ogImage: z.string().nullable().optional(),
  ogUrl: z.string().nullable().optional(),
  ogSiteName: z.string().nullable().optional(),
  twitterCard: z.string().nullable().optional(),
  twitterTitle: z.string().nullable().optional(),
  twitterDescription: z.string().nullable().optional(),
  twitterImage: z.string().nullable().optional(),
  faviconUrl: z.string().nullable().optional(),
  byName: flatJsonRecord.optional(),
  byProperty: flatJsonRecord.optional(),
});

export const bulkCaptureItemSchema = z.object({
  tabId: z.number().int().optional(),
  url: z.string().url(),
  title: z.string().min(1).max(500),
  html: z.string().min(1),
  meta: archiveMetaSchema.optional().default({}),
  textSnippet: z.string().max(5000).optional(),
  extensionPayload: z.record(z.string(), z.unknown()).optional(),
});

export const bulkCapturePayloadSchema = z.object({
  groupName: z.string().min(1).max(160),
  capturedAt: z.string().datetime(),
  windowId: z.number().int().optional(),
  items: z.array(bulkCaptureItemSchema).min(1).max(500),
});

export const targetedSelectionSchema = z.object({
  mode: z.enum(["node", "region"]).optional(),
  selector: z.string().optional(),
  elementText: z.string().optional(),
  rect: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      devicePixelRatio: z.number().optional(),
    })
    .optional(),
});

export const targetedCapturePayloadSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(500),
  capturedAt: z.string().datetime(),
  groupName: z.string().min(1).max(160).optional(),
  html: z.string().min(1).optional(),
  meta: archiveMetaSchema.optional().default({}),
  noteText: z.string().trim().max(10000).optional().default(""),
  screenshotDataUrl: z.string().optional(),
  selection: targetedSelectionSchema.optional(),
  textSnippet: z.string().max(5000).optional(),
  extensionPayload: z.record(z.string(), z.unknown()).optional(),
  skipSnapshot: z.boolean().optional().default(false),
}).superRefine((value, ctx) => {
  if (!value.skipSnapshot && !value.html) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "html is required unless skipSnapshot is true",
      path: ["html"],
    });
  }
  if (!value.screenshotDataUrl && !value.noteText?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "noteText or screenshotDataUrl is required",
      path: ["noteText"],
    });
  }
});

export type BulkCapturePayload = z.infer<typeof bulkCapturePayloadSchema>;
export type TargetedCapturePayload = z.infer<
  typeof targetedCapturePayloadSchema
>;
