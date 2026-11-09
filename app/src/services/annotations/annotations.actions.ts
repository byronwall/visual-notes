import { action } from "@solidjs/router";
import { z } from "zod";

export const resolveProposal = action(
  async (payload: {
    proposalId: string;
    indexes: number[];
    state: "accepted" | "rejected";
  }) => {
    "use server";
    const input = z
      .object({
        proposalId: z.string().min(1),
        indexes: z.array(z.number().int().min(0)).min(1),
        state: z.enum(["accepted", "rejected"]),
      })
      .parse(payload);
    const { resolveProposalOps } = await import(
      "~/server/annotations/proposals"
    );
    return resolveProposalOps(input);
  },
  "annotations-resolve-proposal",
);
