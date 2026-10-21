import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import { pathToRoute } from "~/utils/path-links";
import {
  RECENT_EVENT_TYPES,
  mergeRecentTouches,
  recentKey,
  recentKindForEvent,
  type RecentTouch,
} from "./recents.merge";
import type { RecentItem } from "./recents.types";

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TAKE = 50;

/**
 * Recently visited or edited notes, collections, research topics, tags, and
 * paths, newest first. Visits come from `ActionEvent`; `updatedAt` covers
 * edits that never logged one (imports, agents).
 */
export const fetchRecentItems = query(
  async (requested = 30): Promise<RecentItem[]> => {
    "use server";
    // Server functions take client input; never let it size the queries.
    const take = Math.min(Math.max(Math.floor(Number(requested) || 30), 1), MAX_TAKE);
    const startedAt = Date.now();
    const since = new Date(Date.now() - WINDOW_MS);
    const [events, docs, collections, topics] = await Promise.all([
      prisma.actionEvent.groupBy({
        by: ["eventType", "entityId"],
        where: {
          eventType: { in: RECENT_EVENT_TYPES },
          entityId: { not: null },
          createdAt: { gte: since },
        },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: "desc" } },
        take: take * 3,
      }),
      prisma.doc.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true, updatedAt: true },
        take,
      }),
      prisma.collection.findMany({
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true, updatedAt: true },
        take: 8,
      }),
      prisma.researchTopic.findMany({
        where: { archivedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { slug: true, updatedAt: true },
        take: 8,
      }),
    ]);

    const touches: RecentTouch[] = [
      ...docs.map((d) => ({ kind: "note" as const, id: d.id, at: d.updatedAt })),
      ...collections.map((c) => ({
        kind: "collection" as const,
        id: c.id,
        at: c.updatedAt,
      })),
      ...topics.map((t) => ({
        kind: "research" as const,
        id: t.slug,
        at: t.updatedAt,
      })),
    ];
    for (const event of events) {
      const kind = recentKindForEvent(event.eventType);
      if (!kind || !event.entityId || !event._max.createdAt) continue;
      touches.push({ kind, id: event.entityId, at: event._max.createdAt });
    }
    // Over-fetch so entities deleted since their last visit can drop out.
    const merged = mergeRecentTouches(touches).slice(0, take * 2);
    const idsOf = (kind: RecentTouch["kind"]) =>
      merged.filter((t) => t.kind === kind).map((t) => t.id);

    const [docRows, collectionRows, topicRows] = await Promise.all([
      prisma.doc.findMany({
        where: { id: { in: idsOf("note") } },
        select: { id: true, title: true, path: true, meta: true, updatedAt: true },
      }),
      prisma.collection.findMany({
        where: { id: { in: idsOf("collection") }, deletedAt: null },
        select: { id: true, name: true, icon: true },
      }),
      prisma.researchTopic.findMany({
        where: { slug: { in: idsOf("research") }, archivedAt: null },
        select: { slug: true, title: true },
      }),
    ]);

    const resolved = new Map<string, Omit<RecentItem, "at">>();
    for (const d of docRows) {
      resolved.set(recentKey("note", d.id), {
        kind: "note",
        id: d.id,
        title: d.title || "Untitled",
        href: `/docs/${d.id}`,
        path: d.path,
        meta: d.meta as RecentItem["meta"],
        updatedAt: d.updatedAt.toISOString(),
      });
    }
    for (const c of collectionRows) {
      resolved.set(recentKey("collection", c.id), {
        kind: "collection",
        id: c.id,
        title: c.name || "Untitled collection",
        href: `/collections/${c.id}`,
        icon: c.icon,
      });
    }
    for (const t of topicRows) {
      resolved.set(recentKey("research", t.slug), {
        kind: "research",
        id: t.slug,
        title: t.title,
        href: `/research/${encodeURIComponent(t.slug)}`,
      });
    }

    const items: RecentItem[] = [];
    for (const touch of merged) {
      if (items.length >= take) break;
      const at = touch.at.toISOString();
      if (touch.kind === "tag") {
        items.push({
          kind: "tag",
          id: touch.id,
          title: touch.id,
          href: `/tags/${encodeURIComponent(touch.id)}`,
          at,
        });
      } else if (touch.kind === "path") {
        items.push({
          kind: "path",
          id: touch.id,
          title: touch.id,
          href: pathToRoute(touch.id),
          at,
        });
      } else {
        const item = resolved.get(recentKey(touch.kind, touch.id));
        if (item) items.push({ ...item, at });
      }
    }

    console.debug("[recents] fetchRecentItems", {
      ms: Date.now() - startedAt,
      events: events.length,
      count: items.length,
    });
    return items;
  },
  "sidebar-recent-items",
);
