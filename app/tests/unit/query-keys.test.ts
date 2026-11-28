import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../../src");
const UNREADABLE = "(name the scan cannot read)";

/** A router import that registers queries under a name the scan can't follow. */
const hidesQueries = (binding: ts.NamedImportBindings) =>
  ts.isNamespaceImport(binding) ||
  binding.elements.some((element) => {
    const imported = (element.propertyName ?? element.name).text;
    if (imported === "cache") return true;
    return imported === "query" && element.name.text !== "query";
  });

/** Every `query(fn, name)` call in a file that imports the router's `query`. */
const queryNames = (file: string) => {
  const text = readFileSync(file, "utf8");
  if (!text.includes("@solidjs/router")) return [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest);
  const found: { name: string; file: string }[] = [];
  const add = (name: string) => found.push({ name, file: relative(SRC, file) });
  const imports = source.statements.flatMap((node) =>
    ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === "@solidjs/router" &&
    node.importClause?.namedBindings
      ? [node.importClause.namedBindings]
      : [],
  );
  if (imports.some(hidesQueries)) add(UNREADABLE);
  // Elsewhere `query()` is usually a search-text signal.
  const importsQuery = imports.some(
    (binding) =>
      ts.isNamedImports(binding) &&
      binding.elements.some((element) => element.name.text === "query"),
  );
  const walk = (node: ts.Node) => {
    if (
      importsQuery &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "query"
    ) {
      const [, name, ...rest] = node.arguments;
      const literal = name && ts.isStringLiteralLike(name) && !rest.length;
      add(literal ? name.text : UNREADABLE);
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
  return found;
};

describe("router query names", () => {
  // The router caches by name plus arguments. Two queries with one name read
  // each other's entries, whatever their return types say.
  it("are readable and used once each", () => {
    const all = readdirSync(SRC, { recursive: true, encoding: "utf8" })
      .filter((path) => /\.tsx?$/.test(path))
      .flatMap((path) => queryNames(join(SRC, path)));
    const byName = Map.groupBy(all, (query) => query.name);
    const clashes = [...byName]
      .filter(([name, uses]) => uses.length > 1 || name === UNREADABLE)
      .map(([name, uses]) => `${name}: ${uses.map((u) => u.file).join(", ")}`);

    expect(all.length).toBeGreaterThan(50);
    expect(clashes).toEqual([]);
  });
});
