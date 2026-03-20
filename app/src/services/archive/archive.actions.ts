import { action } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import {
  persistDataImage,
  resolveDocImageStorageDir,
} from "~/server/lib/inline-image-migration";
import { normalizeArchiveCanvasCardMode } from "./archive-canvas";
import type { ArchivedPageCanvasCardMode } from "./archive.types";

const DEFAULT_CANVAS_NODE_SIZE = {
  note: { width: 420, height: 300 },
  image: { width: 360, height: 280 },
} as const;

function getDefaultCanvasNodeSize(kind: "note" | "image") {
  return DEFAULT_CANVAS_NODE_SIZE[kind];
}

const updateArchivedPageCanvasStateInput = z.object({
  id: z.string().min(1),
  canvasX: z.number().finite(),
  canvasY: z.number().finite(),
  canvasCardMode: z.enum(["compact", "summary", "rich"]).optional(),
});

const saveArchiveGroupCanvasLayoutInput = z.object({
  items: z
    .array(
      z.object({
        entityType: z.enum(["page", "node"]),
        id: z.string().min(1),
        canvasX: z.number().finite(),
        canvasY: z.number().finite(),
        canvasWidth: z.number().finite().positive().optional(),
        canvasHeight: z.number().finite().positive().optional(),
        canvasCardMode: z.enum(["compact", "summary", "rich"]).optional(),
      }),
    )
    .min(1),
});

const updateArchivedPageInput = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(300).optional(),
  groupName: z.string().max(200).optional(),
});

const createArchivedPageNoteInput = z.object({
  pageId: z.string().min(1),
  noteText: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
});

const updateArchivedPageNoteInput = z.object({
  id: z.string().min(1),
  noteText: z.string().max(2000),
});

const deleteArchivedPageNoteInput = z.object({
  id: z.string().min(1),
});

const addArchivedPageNoteImageInput = z.object({
  noteId: z.string().min(1),
  imageUrl: z.string().url(),
});

const updateArchivedPageNoteImageInput = z.object({
  noteId: z.string().min(1),
  index: z.number().int().min(0),
  imageUrl: z.string().url(),
});

const deleteArchivedPageNoteImageInput = z.object({
  noteId: z.string().min(1),
  index: z.number().int().min(0),
});

const deleteArchivedPageInput = z.object({
  id: z.string().min(1),
});

const createArchiveCanvasNodeInput = z
  .object({
    groupName: z.string().trim().min(1).max(200),
    kind: z.enum(["note", "image"]),
    canvasX: z.number().finite(),
    canvasY: z.number().finite(),
    contentHtml: z.string().max(20000).optional(),
    imageDataUrl: z.string().optional(),
    imageUrl: z.string().url().optional(),
    canvasWidth: z.number().finite().positive().optional(),
    canvasHeight: z.number().finite().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "note") return;
    if (value.imageDataUrl || value.imageUrl) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Image nodes require image data or an image URL",
      path: ["imageDataUrl"],
    });
  });

const updateArchiveCanvasNodeInput = z.object({
  id: z.string().min(1),
  contentHtml: z.string().max(20000).optional(),
  imageUrl: z.string().url().optional(),
});

const updateArchiveCanvasNodeStateInput = z.object({
  id: z.string().min(1),
  canvasX: z.number().finite(),
  canvasY: z.number().finite(),
  canvasWidth: z.number().finite().positive().optional(),
  canvasHeight: z.number().finite().positive().optional(),
});

const deleteArchiveCanvasNodeInput = z.object({
  id: z.string().min(1),
});

function normalizeOptionalGroupName(value: string | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

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

export const saveArchiveGroupCanvasLayout = action(
  async (payload: z.infer<typeof saveArchiveGroupCanvasLayoutInput>) => {
    "use server";
    const input = saveArchiveGroupCanvasLayoutInput.parse(payload);

    const pageItems = input.items.filter((item) => item.entityType === "page");
    const existing = await prisma.archivedPage.findMany({
      where: { id: { in: pageItems.map((item) => item.id) } },
      select: {
        id: true,
        canvasCardMode: true,
      },
    });

    const existingById = new Map(existing.map((item) => [item.id, item]));

    await prisma.$transaction(
      input.items.map((item) => {
        if (item.entityType === "node") {
          return prisma.archivedCanvasNode.update({
            where: { id: item.id },
            data: {
              canvasX: item.canvasX,
              canvasY: item.canvasY,
              ...(typeof item.canvasWidth === "number"
                ? { canvasWidth: item.canvasWidth }
                : {}),
              ...(typeof item.canvasHeight === "number"
                ? { canvasHeight: item.canvasHeight }
                : {}),
            },
          });
        }

        const current = existingById.get(item.id);
        const nextMode = normalizeArchiveCanvasCardMode(
          item.canvasCardMode ?? current?.canvasCardMode,
        ) as ArchivedPageCanvasCardMode;

        return prisma.archivedPage.update({
          where: { id: item.id },
          data: {
            canvasX: item.canvasX,
            canvasY: item.canvasY,
            canvasCardMode: nextMode,
          },
        });
      }),
    );

    return {
      saved: input.items.length,
    };
  },
  "archive-save-group-canvas-layout",
);

export const createArchiveCanvasNode = action(
  async (payload: z.infer<typeof createArchiveCanvasNodeInput>) => {
    "use server";
    const input = createArchiveCanvasNodeInput.parse(payload);

    let imageUrl: string | null = null;
    const size = getDefaultCanvasNodeSize(input.kind);
    if (input.kind === "image") {
      if (input.imageDataUrl) {
        const persisted = await persistDataImage(
          input.imageDataUrl,
          resolveDocImageStorageDir(),
        );
        imageUrl = persisted.publicUrl;
      } else {
        imageUrl = input.imageUrl?.trim() ?? null;
      }
    }

    const created = await prisma.archivedCanvasNode.create({
      data: {
        groupName: input.groupName,
        kind: input.kind,
        contentHtml:
          input.kind === "note"
            ? input.contentHtml?.trim() || "<p>New note</p>"
            : null,
        imageUrl,
        canvasX: input.canvasX,
        canvasY: input.canvasY,
        canvasWidth: input.canvasWidth ?? size.width,
        canvasHeight: input.canvasHeight ?? size.height,
      },
      select: {
        id: true,
        groupName: true,
        kind: true,
        contentHtml: true,
        imageUrl: true,
        canvasX: true,
        canvasY: true,
        canvasWidth: true,
        canvasHeight: true,
        updatedAt: true,
      },
    });

    return {
      entityType: "node" as const,
      id: created.id,
      groupName: created.groupName,
      kind: created.kind,
      contentHtml: created.contentHtml,
      imageUrl: created.imageUrl,
      canvasX: created.canvasX,
      canvasY: created.canvasY,
      canvasWidth: created.canvasWidth,
      canvasHeight: created.canvasHeight,
      updatedAt: created.updatedAt.toISOString(),
    };
  },
  "archive-create-canvas-node",
);

export const updateArchiveCanvasNode = action(
  async (payload: z.infer<typeof updateArchiveCanvasNodeInput>) => {
    "use server";
    const input = updateArchiveCanvasNodeInput.parse(payload);
    const updates: Record<string, string | null> = {};

    if (input.contentHtml !== undefined) {
      updates.contentHtml = input.contentHtml.trim() || "<p></p>";
    }
    if (input.imageUrl !== undefined) {
      updates.imageUrl = input.imageUrl.trim();
    }

    if (!Object.keys(updates).length) {
      throw new Error("No canvas node updates provided");
    }

    const updated = await prisma.archivedCanvasNode.update({
      where: { id: input.id },
      data: updates,
      select: {
        id: true,
        updatedAt: true,
      },
    });

    return {
      id: updated.id,
      updatedAt: updated.updatedAt.toISOString(),
    };
  },
  "archive-update-canvas-node",
);

export const updateArchiveCanvasNodeState = action(
  async (payload: z.infer<typeof updateArchiveCanvasNodeStateInput>) => {
    "use server";
    const input = updateArchiveCanvasNodeStateInput.parse(payload);
    const updated = await prisma.archivedCanvasNode.update({
      where: { id: input.id },
      data: {
        canvasX: input.canvasX,
        canvasY: input.canvasY,
        ...(typeof input.canvasWidth === "number"
          ? { canvasWidth: input.canvasWidth }
          : {}),
        ...(typeof input.canvasHeight === "number"
          ? { canvasHeight: input.canvasHeight }
          : {}),
      },
      select: {
        id: true,
        groupName: true,
        canvasX: true,
        canvasY: true,
        canvasWidth: true,
        canvasHeight: true,
        updatedAt: true,
      },
    });

    return {
      id: updated.id,
      groupName: updated.groupName,
      canvasX: updated.canvasX,
      canvasY: updated.canvasY,
      canvasWidth: updated.canvasWidth,
      canvasHeight: updated.canvasHeight,
      updatedAt: updated.updatedAt.toISOString(),
    };
  },
  "archive-update-canvas-node-state",
);

export const deleteArchiveCanvasNode = action(
  async (payload: z.infer<typeof deleteArchiveCanvasNodeInput>) => {
    "use server";
    const input = deleteArchiveCanvasNodeInput.parse(payload);
    const deleted = await prisma.archivedCanvasNode.delete({
      where: { id: input.id },
      select: { id: true },
    });
    return { ok: true, id: deleted.id };
  },
  "archive-delete-canvas-node",
);

export const updateArchivedPage = action(
  async (payload: z.infer<typeof updateArchivedPageInput>) => {
    "use server";
    const input = updateArchivedPageInput.parse(payload);
    const updates: Record<string, string | null> = {};

    if (input.title !== undefined) {
      updates.title = input.title.trim();
    }
    if (input.groupName !== undefined) {
      updates.groupName = normalizeOptionalGroupName(input.groupName);
    }

    if (Object.keys(updates).length === 0) {
      throw new Error("No explorer fields to update");
    }

    const updated = await prisma.archivedPage.update({
      where: { id: input.id },
      data: updates,
      select: {
        id: true,
        title: true,
        groupName: true,
        updatedAt: true,
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      groupName: updated.groupName,
      updatedAt: updated.updatedAt.toISOString(),
    };
  },
  "archive-update-page",
);

export const deleteArchivedPage = action(
  async (payload: z.infer<typeof deleteArchivedPageInput>) => {
    "use server";
    const input = deleteArchivedPageInput.parse(payload);
    const deleted = await prisma.archivedPage.delete({
      where: { id: input.id },
      select: { id: true },
    });
    return { ok: true, id: deleted.id };
  },
  "archive-delete-page",
);

export const createArchivedPageNote = action(
  async (payload: z.infer<typeof createArchivedPageNoteInput>) => {
    "use server";
    const input = createArchivedPageNoteInput.parse(payload);
    const noteText = input.noteText?.trim() ?? "";
    const imageUrls = input.imageUrl ? [input.imageUrl.trim()] : [];

    if (!noteText && imageUrls.length === 0) {
      throw new Error("Add note text or an image URL");
    }

    const created = await prisma.archivedPageNote.create({
      data: {
        archivedPageId: input.pageId,
        noteText,
        imageUrls,
      },
      select: {
        id: true,
        archivedPageId: true,
      },
    });

    return {
      id: created.id,
      pageId: created.archivedPageId,
    };
  },
  "archive-create-note",
);

export const updateArchivedPageNote = action(
  async (payload: z.infer<typeof updateArchivedPageNoteInput>) => {
    "use server";
    const input = updateArchivedPageNoteInput.parse(payload);
    const existing = await prisma.archivedPageNote.findUnique({
      where: { id: input.id },
      select: { id: true, imageUrls: true },
    });

    if (!existing) throw new Error("Note not found");

    const noteText = input.noteText.trim();
    if (!noteText && existing.imageUrls.length === 0) {
      throw new Error("Empty note must keep at least one image");
    }

    const updated = await prisma.archivedPageNote.update({
      where: { id: input.id },
      data: { noteText },
      select: {
        id: true,
        updatedAt: true,
      },
    });

    return {
      id: updated.id,
      updatedAt: updated.updatedAt.toISOString(),
    };
  },
  "archive-update-note",
);

export const deleteArchivedPageNote = action(
  async (payload: z.infer<typeof deleteArchivedPageNoteInput>) => {
    "use server";
    const input = deleteArchivedPageNoteInput.parse(payload);
    const deleted = await prisma.archivedPageNote.delete({
      where: { id: input.id },
      select: { id: true },
    });
    return { ok: true, id: deleted.id };
  },
  "archive-delete-note",
);

export const addArchivedPageNoteImage = action(
  async (payload: z.infer<typeof addArchivedPageNoteImageInput>) => {
    "use server";
    const input = addArchivedPageNoteImageInput.parse(payload);
    const existing = await prisma.archivedPageNote.findUnique({
      where: { id: input.noteId },
      select: { id: true, imageUrls: true },
    });
    if (!existing) throw new Error("Note not found");

    const nextImageUrl = input.imageUrl.trim();
    if (existing.imageUrls.includes(nextImageUrl)) {
      return { id: existing.id, imageUrls: existing.imageUrls };
    }

    const updated = await prisma.archivedPageNote.update({
      where: { id: input.noteId },
      data: { imageUrls: [...existing.imageUrls, nextImageUrl] },
      select: { id: true, imageUrls: true },
    });

    return updated;
  },
  "archive-add-note-image",
);

export const updateArchivedPageNoteImage = action(
  async (payload: z.infer<typeof updateArchivedPageNoteImageInput>) => {
    "use server";
    const input = updateArchivedPageNoteImageInput.parse(payload);
    const existing = await prisma.archivedPageNote.findUnique({
      where: { id: input.noteId },
      select: { id: true, imageUrls: true },
    });
    if (!existing) throw new Error("Note not found");
    if (input.index >= existing.imageUrls.length) {
      throw new Error("Image not found");
    }

    const nextImageUrls = existing.imageUrls.slice();
    nextImageUrls[input.index] = input.imageUrl.trim();
    const updated = await prisma.archivedPageNote.update({
      where: { id: input.noteId },
      data: { imageUrls: nextImageUrls },
      select: { id: true, imageUrls: true },
    });

    return updated;
  },
  "archive-update-note-image",
);

export const deleteArchivedPageNoteImage = action(
  async (payload: z.infer<typeof deleteArchivedPageNoteImageInput>) => {
    "use server";
    const input = deleteArchivedPageNoteImageInput.parse(payload);
    const existing = await prisma.archivedPageNote.findUnique({
      where: { id: input.noteId },
      select: { id: true, noteText: true, imageUrls: true },
    });
    if (!existing) throw new Error("Note not found");
    if (input.index >= existing.imageUrls.length) {
      throw new Error("Image not found");
    }

    const nextImageUrls = existing.imageUrls.filter((_, index) => index !== input.index);
    if (!existing.noteText.trim() && nextImageUrls.length === 0) {
      await prisma.archivedPageNote.delete({ where: { id: input.noteId } });
      return { id: input.noteId, deleted: true };
    }

    const updated = await prisma.archivedPageNote.update({
      where: { id: input.noteId },
      data: { imageUrls: nextImageUrls },
      select: { id: true, imageUrls: true },
    });

    return updated;
  },
  "archive-delete-note-image",
);
