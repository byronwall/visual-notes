import fs from "node:fs";
import path from "node:path";
import type { MapInfo, PMap } from "../src/types";

// One JSON file per map in data/maps. Every write first copies the old file
// into data/history/<id>/ so undo can step back, including after an outside
// agent edits the file directly.

export const newId = () => Math.random().toString(36).slice(2, 8);

export function createStore(root: string) {
  const mapsDir = path.join(root, "data", "maps");
  const histDir = path.join(root, "data", "history");
  fs.mkdirSync(mapsDir, { recursive: true });

  const file = (id: string) => path.join(mapsDir, `${id.replace(/[^\w-]/g, "")}.json`);

  const get = (id: string): PMap | null => {
    const f = file(id);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as PMap) : null;
  };

  const list = (): MapInfo[] =>
    fs
      .readdirSync(mapsDir)
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => {
        try {
          const m = JSON.parse(fs.readFileSync(path.join(mapsDir, f), "utf8")) as PMap;
          return [{ id: m.id, title: m.title, updatedAt: m.updatedAt }];
        } catch {
          return [];
        }
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const save = (map: PMap) => {
    const f = file(map.id);
    if (fs.existsSync(f)) {
      const dir = path.join(histDir, map.id);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(f, path.join(dir, `${Date.now()}.json`));
      const old = fs.readdirSync(dir).sort();
      for (const name of old.slice(0, Math.max(0, old.length - 100))) {
        fs.rmSync(path.join(dir, name));
      }
    }
    map.updatedAt = new Date().toISOString();
    fs.writeFileSync(f, JSON.stringify(map, null, 2));
    return map;
  };

  const undo = (id: string): PMap | null => {
    const dir = path.join(histDir, id);
    const snaps = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
    const last = snaps.at(-1);
    if (!last) return null;
    fs.copyFileSync(path.join(dir, last), file(id));
    fs.rmSync(path.join(dir, last));
    return get(id);
  };

  const create = (title: string): PMap =>
    save({
      id: newId(),
      title,
      nodes: [{ id: "root", kind: "root", title, note: "", by: "me", status: "open" }],
      edges: [],
      updatedAt: "",
    });

  return { mapsDir, get, list, save, undo, create };
}

export type Store = ReturnType<typeof createStore>;
