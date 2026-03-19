import { action } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import { normalizeArchiveCanvasCardMode } from "./archive-canvas";
import type { ArchivedPageCanvasCardMode } from "./archive.types";

const updateArchivedPageCanvasStateInput = z.object({
  id: z.string().min(1),
  canvasX: z.number().finite(),
  canvasY: z.number().finite(),
  canvasCardMode: z.enum(["compact", "summary", "rich"]).optional(),
});

export const updateArchivedPageCanvasState = action(
  async (payload: z.infer<typeof updateArchivedPageCanvasStateInput>) => {
    "use server";
    const input = updateArchivedPageCanvasStateInput.parse(payload);

    const existing = await prisma.archivedPage.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        groupName: true,
        canvasX: true,
        canvasY: true,
        canvasCardMode: true,
      },
    });

    if (!existing) {
      throw new Error("Archive item not found");
    }

    if (!existing.groupName) {
      throw new Error("Archive item is not assigned to a group");
    }

    const nextMode = normalizeArchiveCanvasCardMode(
      input.canvasCardMode ?? existing.canvasCardMode,
    ) as ArchivedPageCanvasCardMode;

    const hasPositionChange =
      existing.canvasX !== input.canvasX || existing.canvasY !== input.canvasY;
    const hasModeChange = existing.canvasCardMode !== nextMode;

    if (!hasPositionChange && !hasModeChange) {
      return {
        id: existing.id,
        groupName: existing.groupName,
        canvasX: existing.canvasX ?? input.canvasX,
        canvasY: existing.canvasY ?? input.canvasY,
        canvasCardMode: nextMode,
      };
    }

    const updated = await prisma.archivedPage.update({
      where: { id: input.id },
      data: {
        canvasX: input.canvasX,
        canvasY: input.canvasY,
        canvasCardMode: nextMode,
      },
      select: {
        id: true,
        groupName: true,
        canvasX: true,
        canvasY: true,
        canvasCardMode: true,
        updatedAt: true,
      },
    });

    return {
      id: updated.id,
      groupName: updated.groupName,
      canvasX: updated.canvasX,
      canvasY: updated.canvasY,
      canvasCardMode: updated.canvasCardMode as ArchivedPageCanvasCardMode,
      updatedAt: updated.updatedAt.toISOString(),
    };
  },
  "archive-update-canvas-state",
);
