import { describe, expect, it } from "vitest";
import { checkNodes, parseNode } from "../../scripts/pgm-report.ts";

const node = (front: string, body = "") =>
  parseNode("n.md", `---\n${front}\n---\n${body}`);

const longContext = "Evidence and reproduction details. ".repeat(5);

describe("pgm consistency report", () => {
  const nodes = [
    node("id: area-root\nlabel: Root\ntype: area\nstatus: planned"),
    node(
      "id: problem-auth-setup\nlabel: Audit runtime needs auth host\ntype: problem\nstatus: planned\nparent: area-root",
      longContext,
    ),
    node(
      "id: problem-auth-setup-2\nlabel: Audit runtime needs auth host 2\ntype: problem\nstatus: planned\nparent: area-root\nmetadata:\n  solution: |\n    Verified workaround in PR 12.",
      `${longContext} See tmp/missing-proof.png and tmp/present.md.`,
    ),
    node(
      "id: module-done\nlabel: Done\ntype: module\nstatus: implemented\nparent: area-gone",
      longContext,
    ),
    node(
      "id: module-thin\nlabel: Thin\ntype: module\nstatus: working\nparent: area-root",
      "TBD",
    ),
  ];
  const findings = checkNodes(nodes, (path) => path === "tmp/present.md");
  const byCheck = (check: string) =>
    findings.filter((finding) => finding.check === check).map((f) => f.nodeIds);

  it("reports duplicate titles, including numbered copies", () => {
    expect(byCheck("duplicate-title")).toEqual([
      ["problem-auth-setup", "problem-auth-setup-2"],
    ]);
  });

  it("flags an open node with a solution without changing it", () => {
    expect(byCheck("open-with-solution")).toEqual([["problem-auth-setup-2"]]);
    expect(nodes[2].status).toBe("planned");
  });

  it("reports implemented nodes without solutions and invalid parents", () => {
    expect(byCheck("implemented-without-solution")).toEqual([["module-done"]]);
    expect(byCheck("invalid-parent")).toEqual([["module-done"]]);
  });

  it("reports thin actionable records and missing evidence only", () => {
    expect(byCheck("thin-actionable-record")).toEqual([["module-thin"]]);
    expect(
      findings
        .filter((finding) => finding.check === "missing-evidence-path")
        .map((finding) => finding.detail),
    ).toEqual(["Referenced tmp/missing-proof.png does not exist."]);
  });

  it("is deterministic across repeat runs", () => {
    expect(checkNodes(nodes, (path) => path === "tmp/present.md")).toEqual(
      findings,
    );
  });
});
