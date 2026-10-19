import { action, json, query } from "@solidjs/router";
import { prisma } from "~/server/db";

export type OAuthConnection = {
  id: string;
  clientId: string;
  clientName: string | null;
  scope: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  notesCreated: number;
};

export const fetchOAuthConnections = query(
  async (): Promise<OAuthConnection[]> => {
    "use server";
    const [grants, created] = await Promise.all([
      prisma.oAuthGrant.findMany({
        orderBy: { createdAt: "desc" },
        include: { client: { select: { clientName: true } } },
        take: 100,
      }),
      prisma.actionEvent.groupBy({
        by: ["actorId"],
        where: { actorType: "chatgpt", eventType: "doc.create" },
        _count: { _all: true },
      }),
    ]);
    const createdByActor = new Map(
      created.map((row) => [row.actorId, row._count._all]),
    );
    // Active connections first, newest first within each group.
    const ordered = [
      ...grants.filter((grant) => !grant.revokedAt),
      ...grants.filter((grant) => grant.revokedAt),
    ];
    return ordered.map((grant) => ({
      id: grant.id,
      clientId: grant.clientId,
      clientName: grant.client.clientName,
      scope: grant.scope,
      createdAt: grant.createdAt.toISOString(),
      lastUsedAt: grant.lastUsedAt?.toISOString() ?? null,
      revokedAt: grant.revokedAt?.toISOString() ?? null,
      notesCreated: createdByActor.get(`chatgpt:${grant.clientId}`) ?? 0,
    }));
  },
  "oauth-connections",
);

/** Takes effect on the next MCP call: access tokens are checked per request. */
export const revokeOAuthConnection = action(async (grantId: string) => {
  "use server";
  await prisma.oAuthGrant.update({
    where: { id: grantId },
    data: { revokedAt: new Date() },
  });
  console.info(`[oauth] revoked grant ${grantId}`);
  return json({ ok: true }, { revalidate: [fetchOAuthConnections.key] });
}, "oauth-connection-revoke");
