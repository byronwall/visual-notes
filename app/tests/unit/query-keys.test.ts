import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../../src");

/** Every `query(fn, name)` call in a file that imports from the router. */
const queryNames = (file: string) => {
  const text = readFileSync(file, "utf8");
  if (!text.includes("@solidjs/router")) return [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest);
  const found: { name: string; file: string }[] = [];
  const walk = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "query" &&
      node.arguments.length === 2
    ) {
      const name = node.arguments[1];
      found.push({
        name: ts.isStringLiteralLike(name) ? name.text : "(not a literal)",
        file: relative(SRC, file),
      });
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
  return found;
};

describe("router query names", () => {
  // The router caches by name plus arguments. Two queries with one name read
  // each other's entries, whatever their return types say.
  it("are literal and used once each", () => {
    const all = readdirSync(SRC, { recursive: true, encoding: "utf8" })
      .filter((path) => /\.tsx?$/.test(path))
      .flatMap((path) => queryNames(join(SRC, path)));
    const byName = Map.groupBy(all, (query) => query.name);
    const clashes = [...byName]
      .filter(([name, uses]) => uses.length > 1 || name === "(not a literal)")
      .map(([name, uses]) => `${name}: ${uses.map((u) => u.file).join(", ")}`);

    expect(all.length).toBeGreaterThan(50);
    expect(clashes).toEqual([]);
  });
});
