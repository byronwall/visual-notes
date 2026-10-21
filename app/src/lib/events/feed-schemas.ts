// Input schemas for calendar feeds, shared by server actions and MCP tools.
import { z } from "zod";
import { decisionSchema } from "./schemas";

export const feedInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  collectionId: z.string().min(1).nullable().optional(),
  viewId: z.string().min(1).nullable().optional(),
  decisions: z.array(decisionSchema).max(6).optional(),
  pastDays: z.number().int().min(0).max(3650).optional(),
});
export type FeedInput = z.infer<typeof feedInputSchema>;

export const feedPatchSchema = feedInputSchema.partial();
export type FeedPatch = z.infer<typeof feedPatchSchema>;

/** `null` clears the manual entry so only the rule applies. */
export const feedEntryModeSchema = z.enum(["include", "exclude"]).nullable();
