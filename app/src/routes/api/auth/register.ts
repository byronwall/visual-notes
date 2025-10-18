import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { z } from "zod";
import { hash } from "bcryptjs";

const bodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function POST(event: APIEvent) {
  try {
    const data = await event.request.json();
    const parsed = bodySchema.parse(data);
    const email = parsed.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return json({ error: "Email already registered" }, { status: 409 });
    }
    const passwordHash = await hash(parsed.password, 10);
    const created = await prisma.user.create({
      data: {
        email,
        name: parsed.name ?? null,
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });
    return json({ user: created }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message ?? "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}

