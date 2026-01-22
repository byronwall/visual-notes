import { action } from "@solidjs/router";
import { prisma } from "~/server/db";

function splitTitleIntoTokens(title: string): string[] {
  return (title || "")
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export const processPathRound = action(async () => {
  "use server";
  const docs = await prisma.doc.findMany({
    select: { id: true, title: true, path: true },
  });

  const knownFirstSegments = new Map<string, string>();
  const knownPrefixes = new Map<string, string>();
  for (const d of docs) {
    const p = d.path?.trim();
    if (!p) continue;
    const parts = p.split(".").filter((x) => x.length > 0);
    for (let i = 0; i < parts.length; i++) {
      const prefix = parts.slice(0, i + 1).join(".");
      const prefixLower = prefix.toLowerCase();
      if (!knownPrefixes.has(prefixLower)) knownPrefixes.set(prefixLower, prefix);
      if (i === 0) {
        const firstLower = parts[0].toLowerCase();
        if (!knownFirstSegments.has(firstLower))
          knownFirstSegments.set(firstLower, parts[0]);
      }
    }
  }

  console.log(
    "[docs.path-round] knownFirstSegments=%d knownPrefixes=%d",
    knownFirstSegments.size,
    knownPrefixes.size
  );
  for (const [, v] of knownFirstSegments) {
    console.log("[docs.path-round] knownFirstSegment=%s", v);
  }
  for (const [, v] of knownPrefixes) {
    console.log("[docs.path-round] knownPrefix=%s", v);
  }

  type Update = { id: string; nextPath: string };
  const updates: Update[] = [];
  let considered = 0;
  let initCandidates = 0;
  let extendCandidates = 0;

  for (const d of docs) {
    const titleTokens = splitTitleIntoTokens(d.title || "");
    if (titleTokens.length === 0) continue;
    const currentPath = (d.path || "").trim();
    considered++;

    if (!currentPath) {
      const first = titleTokens[0];
      const firstLower = first.toLowerCase();
      if (knownFirstSegments.has(firstLower)) {
        const canonical = knownFirstSegments.get(firstLower)!;
        updates.push({ id: d.id, nextPath: canonical });
        initCandidates++;
      }
      continue;
    }

    const currentParts = currentPath.split(".").filter((x) => x.length > 0);
    const titlePrefixForCurrent = titleTokens.slice(0, currentParts.length);
    const aligns = currentParts
      .map(
        (p, i) =>
          p.toLowerCase() === (titlePrefixForCurrent[i] || "").toLowerCase()
      )
      .every(Boolean);
    if (!aligns) continue;
    if (titleTokens.length <= currentParts.length) continue;

    const nextPrefixLower = titleTokens
      .slice(0, currentParts.length + 1)
      .join(".")
      .toLowerCase();
    if (currentPath.toLowerCase() === nextPrefixLower) continue;
    if (knownPrefixes.has(nextPrefixLower)) {
      const canonical = knownPrefixes.get(nextPrefixLower)!;
      updates.push({ id: d.id, nextPath: canonical });
      extendCandidates++;
    }
  }

  if (updates.length === 0) {
    try {
      console.log("[docs.path-round] no updates; considered=%d", considered);
    } catch {}
    return { ok: true, updated: 0, failed: 0, considered };
  }

  const chunkSize = 100;
  let updated = 0;
  let failed = 0;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    try {
      await prisma.$transaction(
        chunk.map((u) =>
          prisma.doc.update({ where: { id: u.id }, data: { path: u.nextPath } })
        )
      );
      updated += chunk.length;
    } catch (e) {
      try {
        console.error(
          "[docs.path-round] chunk failed, retrying individually",
          e
        );
      } catch {}
      for (const u of chunk) {
        try {
          await prisma.doc.update({
            where: { id: u.id },
            data: { path: u.nextPath },
          });
          updated++;
        } catch {
          failed++;
        }
      }
    }
  }

  try {
    console.log(
      "[docs.path-round] completed updated=%d failed=%d considered=%d init=%d extend=%d",
      updated,
      failed,
      considered,
      initCandidates,
      extendCandidates
    );
  } catch {}

  return {
    ok: true,
    updated,
    failed,
    considered,
    init: initCandidates,
    extend: extendCandidates,
  };
}, "docs-path-round");
