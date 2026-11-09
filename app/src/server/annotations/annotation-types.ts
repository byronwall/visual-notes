import { prisma } from "~/server/db";
import { publishAppChange } from "~/server/note-events";
import {
  ANNOTATION_COLORS,
  type AnnotationColor,
  type AnnotationTypeView,
} from "~/lib/annotations/types";
import { AnnotationError } from "./errors";

// The user's annotation types. Three exist from the start: "Note" (the
// default for highlights), "Request" (for AI; Note to AI uses it), and
// "From AI" (what agents write with). The last two cannot be deleted.

export const BUILT_IN = { request: "request", fromAi: "from-ai" } as const;

const SEED = [
  { name: "Note", color: "amber", forAi: false, isDefault: true, builtIn: null, sortOrder: 0 },
  { name: "Request", color: "blue", forAi: true, isDefault: false, builtIn: BUILT_IN.request, sortOrder: 1 },
  { name: "From AI", color: "green", forAi: false, isDefault: false, builtIn: BUILT_IN.fromAi, sortOrder: 2 },
] as const;

let seeded = false;

/** Creates the starting types once per database. */
export async function ensureAnnotationTypes(): Promise<void> {
  if (seeded) return;
  const count = await prisma.annotationType.count();
  if (count === 0) {
    await prisma.annotationType.createMany({ data: [...SEED], skipDuplicates: true });
  } else {
    // Built-ins must exist even if the seed ran before one was added.
    for (const type of SEED.filter((t) => t.builtIn)) {
      const found = await prisma.annotationType.findUnique({ where: { builtIn: type.builtIn! } });
      if (!found) {
        await prisma.annotationType.create({
          data: { ...type, isDefault: false, name: (await freeName(type.name)) },
        });
      }
    }
  }
  seeded = true;
}

async function freeName(name: string) {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? name : `${name} ${n}`;
    if (!(await prisma.annotationType.findUnique({ where: { name: candidate } }))) return candidate;
  }
}

type TypeRow = {
  id: string;
  name: string;
  color: string;
  forAi: boolean;
  isDefault: boolean;
  builtIn: string | null;
};

export const toTypeView = (row: TypeRow): AnnotationTypeView => ({
  id: row.id,
  name: row.name,
  color: (ANNOTATION_COLORS as readonly string[]).includes(row.color)
    ? (row.color as AnnotationColor)
    : "gray",
  forAi: row.forAi,
  isDefault: row.isDefault,
  builtIn: row.builtIn,
});

export async function listAnnotationTypes(): Promise<AnnotationTypeView[]> {
  await ensureAnnotationTypes();
  const rows = await prisma.annotationType.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toTypeView);
}

export async function builtInTypeId(key: string): Promise<string> {
  await ensureAnnotationTypes();
  const row = await prisma.annotationType.findUniqueOrThrow({ where: { builtIn: key } });
  return row.id;
}

export async function defaultTypeId(): Promise<string> {
  await ensureAnnotationTypes();
  const row =
    (await prisma.annotationType.findFirst({ where: { isDefault: true } })) ??
    (await prisma.annotationType.findFirstOrThrow({ orderBy: { sortOrder: "asc" } }));
  return row.id;
}

const cleanName = (name: string) => {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) throw new AnnotationError("A type needs a name");
  return trimmed;
};

const assertColor = (color: string) => {
  if (!(ANNOTATION_COLORS as readonly string[]).includes(color)) {
    throw new AnnotationError(`color must be one of ${ANNOTATION_COLORS.join(", ")}`);
  }
};

export async function createAnnotationType(input: {
  name: string;
  color: string;
  forAi: boolean;
}): Promise<AnnotationTypeView> {
  await ensureAnnotationTypes();
  assertColor(input.color);
  const name = cleanName(input.name);
  if (await prisma.annotationType.findUnique({ where: { name } })) {
    throw new AnnotationError(`A type named "${name}" already exists`);
  }
  const last = await prisma.annotationType.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.annotationType.create({
    data: { name, color: input.color, forAi: input.forAi, sortOrder: (last._max.sortOrder ?? 0) + 1 },
  });
  publishAppChange("inbox", null);
  return toTypeView(row);
}

export async function updateAnnotationType(input: {
  id: string;
  name?: string;
  color?: string;
  forAi?: boolean;
  isDefault?: boolean;
}): Promise<AnnotationTypeView> {
  const current = await prisma.annotationType.findUnique({ where: { id: input.id } });
  if (!current) throw new AnnotationError(`No annotation type ${input.id}`);
  if (input.color !== undefined) assertColor(input.color);
  const row = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.annotationType.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.annotationType.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: cleanName(input.name) } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        // Request must stay for AI: Note to AI depends on it.
        ...(input.forAi !== undefined && current.builtIn !== BUILT_IN.request
          ? { forAi: input.forAi }
          : {}),
        ...(input.isDefault ? { isDefault: true } : {}),
      },
    });
  });
  publishAppChange("inbox", null);
  return toTypeView(row);
}

/** Deletes a type; its annotations move to the default type. */
export async function deleteAnnotationType(id: string): Promise<void> {
  const current = await prisma.annotationType.findUnique({ where: { id } });
  if (!current) throw new AnnotationError(`No annotation type ${id}`);
  if (current.builtIn) throw new AnnotationError(`"${current.name}" is built in and cannot be deleted`);
  if (current.isDefault) throw new AnnotationError("Pick another default type first");
  const fallback = await defaultTypeId();
  await prisma.$transaction([
    prisma.annotation.updateMany({ where: { typeId: id }, data: { typeId: fallback } }),
    prisma.annotationType.delete({ where: { id } }),
  ]);
  publishAppChange("inbox", null);
}
