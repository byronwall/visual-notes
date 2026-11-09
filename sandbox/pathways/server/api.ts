import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import type { AgentAction, PMap } from "../src/types";
import { runAgent } from "./agent";
import { createStore } from "./store";

// Dev-server API: /api/maps, /api/maps/:id, /api/maps/:id/undo,
// /api/maps/:id/agent. A change to any map file (from this API or from an
// outside agent editing the JSON) is pushed to the page over Vite's socket.

const body = async (req: IncomingMessage) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
};

const send = (res: ServerResponse, status: number, data: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
};

export function pathwaysApi(): Plugin {
  return {
    name: "pathways-api",
    configureServer(server) {
      const root = server.config.root;
      const store = createStore(root);

      const seed = path.join(root, "seed");
      if (store.list().length === 0 && fs.existsSync(seed)) {
        for (const f of fs.readdirSync(seed)) fs.copyFileSync(path.join(seed, f), path.join(store.mapsDir, f));
      }

      server.watcher.add(store.mapsDir);
      const notify = (file: string) => {
        if (!file.startsWith(store.mapsDir)) return;
        server.ws.send({ type: "custom", event: "pathways:changed", data: { id: path.basename(file, ".json") } });
      };
      server.watcher.on("change", notify);
      server.watcher.on("add", notify);

      server.middlewares.use("/api", async (req, res) => {
        const url = (req.url ?? "").split("?")[0];
        const [, maps, id, verb] = url.split("/");
        try {
          if (maps !== "maps") return send(res, 404, { error: "not found" });

          if (!id) {
            if (req.method === "GET") return send(res, 200, store.list());
            if (req.method === "POST") {
              const { title } = await body(req);
              return send(res, 200, store.create(String(title || "Untitled decision")));
            }
          }

          if (id && !verb) {
            if (req.method === "GET") {
              const map = store.get(id);
              return map ? send(res, 200, map) : send(res, 404, { error: "no map" });
            }
            if (req.method === "PUT") {
              const map = (await body(req)) as PMap;
              return send(res, 200, store.save({ ...map, id }));
            }
          }

          if (id && verb === "undo" && req.method === "POST") {
            const map = store.undo(id);
            return map ? send(res, 200, map) : send(res, 409, { error: "nothing to undo" });
          }

          if (id && verb === "agent" && req.method === "POST") {
            const { action, nodeId, hint } = (await body(req)) as {
              action: AgentAction;
              nodeId?: string;
              hint?: string;
            };
            const map = store.get(id);
            if (!map) return send(res, 404, { error: "no map" });
            const result = await runAgent(map, action, nodeId ?? "root", hint ?? "");
            store.save(result.map);
            return send(res, 200, result);
          }

          send(res, 405, { error: "method not allowed" });
        } catch (err) {
          console.error("[pathways] api error", err);
          send(res, 500, { error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}
