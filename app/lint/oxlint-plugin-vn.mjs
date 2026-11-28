// Repo-specific guard rules for oxlint, loaded through `jsPlugins` in
// .oxlintrc.json. Each rule reports every node that matches its selector.
const selectorRule = (selector, message) => ({
  create(context) {
    return {
      [selector](node) {
        context.report({ node, message });
      },
    };
  },
});

// Only a read inside a <Suspense> child can fall back there. `Suspense` in a
// fallback attribute is outside it.
const insideSuspense = (node) => {
  for (let child = node; child.parent; child = child.parent) {
    const parent = child.parent;
    if (
      parent.type === "JSXElement" &&
      child !== parent.openingElement &&
      parent.openingElement.name.name === "Suspense"
    ) {
      return true;
    }
  }
  return false;
};

const resourceName = ({ id, init }) => {
  const callee = init?.type === "CallExpression" ? init.callee.name : null;
  if (!/^(createAsync|createKeptAsync|createResource)$/.test(callee ?? "")) {
    return null;
  }
  const binding = id.type === "ArrayPattern" ? id.elements[0] : id;
  return binding?.type === "Identifier" ? binding.name : null;
};

// Reports `data()` on a resource declared in the same file. Resources returned
// from a hook are out of reach, so review those by hand.
const resourceReadLatest = {
  create(context) {
    const names = new Set();
    const calls = [];
    return {
      VariableDeclarator(node) {
        const name = resourceName(node);
        if (name) names.add(name);
      },
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.arguments.length === 0 &&
          !insideSuspense(node)
        ) {
          calls.push(node);
        }
      },
      "Program:exit"() {
        for (const node of calls) {
          if (!names.has(node.callee.name)) continue;
          context.report({
            node,
            message: `Read ${node.callee.name}.latest here, or move this read inside a <Suspense> child in this file. A plain read outside one falls back at the page's boundary on every refetch and unmounts the page.`,
          });
        }
      },
    };
  },
};

// A row that sets its own columns sizes them from its own cells, so an
// `auto` column (a chip, a date) drifts from row to row. Rows are subgrids of
// a RowList, which owns the one template. Flags content-sized column
// templates in *Row.tsx files and inside <For>/<Index> callbacks.
const ROW_FILE = /Row\.tsx$/;
const insideLoop = (node) => {
  for (let n = node.parent; n; n = n.parent) {
    if (
      n.type === "JSXElement" &&
      /^(For|Index)$/.test(n.openingElement.name.name ?? "")
    ) {
      return true;
    }
  }
  return false;
};
// Content-sized tracks are the ones that differ per row. `auto-fill` and
// `auto-fit` card grids and fixed or `fr` tracks line up on their own.
const CONTENT_TRACK = /\b(?:auto(?!-f)|max-content|min-content|fit-content)\b/;
const strings = (node) => {
  if (!node) return [];
  if (node.type === "Literal" && typeof node.value === "string") {
    return [node.value];
  }
  if (node.type === "TemplateLiteral") {
    return node.quasis.map((q) => q.value.cooked ?? "");
  }
  if (node.type === "JSXExpressionContainer") return strings(node.expression);
  if (node.type === "ObjectExpression") {
    return node.properties.flatMap((p) => strings(p.value));
  }
  return [];
};
const contentSized = (value) =>
  strings(value).some((v) => CONTENT_TRACK.test(v));
const MESSAGE =
  "A row must not size its own columns to content (auto, max-content, fit-content): each row measures only its own cells, so columns drift between rows. Put the template on a RowList (~/components/ui/row-list) and render the row as a RowListRow subgrid.";
const identifiers = (node, out = []) => {
  if (!node || typeof node !== "object") return out;
  if (node.type === "Identifier") out.push(node.name);
  for (const key of [
    "expression",
    "expressions",
    "left",
    "right",
    "arguments",
    "consequent",
    "alternate",
  ]) {
    const child = node[key];
    if (Array.isArray(child)) child.forEach((c) => identifiers(c, out));
    else if (child) identifiers(child, out);
  }
  return out;
};
const rowColumns = {
  create(context) {
    const rowFile = ROW_FILE.test(context.filename ?? "");
    // Module styles with a content-sized template, and class names used in loops.
    const styles = new Map();
    const loopClasses = new Set();
    const check = (node, value) => {
      if (!contentSized(value)) return;
      if (rowFile || insideLoop(node)) {
        context.report({ node, message: MESSAGE });
        return;
      }
      const decl = node.parent?.parent;
      if (
        decl?.type === "CallExpression" &&
        decl.parent?.type === "VariableDeclarator"
      ) {
        styles.set(decl.parent.id.name, node);
      }
    };
    return {
      "Property[key.name='gridTemplateColumns']"(node) {
        check(node, node.value);
      },
      "JSXAttribute[name.name='gridTemplateColumns']"(node) {
        check(node, node.value);
      },
      "JSXAttribute[name.name=/^(class|className)$/]"(node) {
        if (!insideLoop(node)) return;
        for (const name of identifiers(node.value)) loopClasses.add(name);
      },
      "Program:exit"() {
        for (const [name, node] of styles) {
          if (loopClasses.has(name)) context.report({ node, message: MESSAGE });
        }
      },
    };
  },
};

export default {
  meta: { name: "vn" },
  rules: {
    "resource-read-latest": resourceReadLatest,
    "row-columns": rowColumns,
    "note-body-writes": selectorRule(
      "CallExpression[callee.object.property.name='doc'][callee.property.name=/^(create|createMany|update|updateMany|upsert)$/] Property[key.name=/^(data|create|update)$/] > ObjectExpression > Property[key.name=/^(content|html|markdown)$/]",
      "Write note bodies only through server/notes/note-write.ts or note-store.ts (contentColumns), so validation, dual-write, search text, and the block index stay in step.",
    ),
    "no-nested-select-spread": selectorRule(
      "Property[key.name='select'] Property[key.name='select'] > ObjectExpression > SpreadElement",
      "List nested Prisma select fields explicitly. Spreading a shared object into a nested select made tsc take minutes.",
    ),
    "no-router-actions-in-server": selectorRule(
      ":matches(ImportDeclaration[importKind!='type'], ImportExpression)[source.value=/\\.actions(\\.[\\w-]+)?$/]",
      "Server-only code runs without a request, so router actions fail there (router.singleFlight). Call a plain function from a *.server.ts module and keep the action as a thin wrapper.",
    ),
    "color-tokens": selectorRule(
      ":matches(Property[key.name=/^(color|bg|background|backgroundColor|borderColor|outlineColor|fill|stroke|stopColor)$/], JSXAttribute[name.name=/^(color|bg|background|backgroundColor|borderColor|outlineColor|fill|stroke|stopColor)$/]) > Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
      "Use a color token (fg.*, bg.*, border.*, or a palette step) instead of a raw hex color, so light and dark mode and the palette stay in step.",
    ),
    "no-query-result-cast": selectorRule(
      "TSAsExpression:matches([expression.callee.name=/^fetch[A-Z]/], [expression.argument.callee.name=/^fetch[A-Z]/])",
      "Do not cast a fetch* query's result. Its return type is the contract: import the type from the query module, or derive it with Awaited<ReturnType<typeof fetchX>>, instead of copying it here.",
    ),
    "known-color-steps": selectorRule(
      "Literal[value=/^(olive|grass|slate)\\.|^(gray|blue|red|green|amber)\\.a?(0|1[3-9]|[2-9][0-9]|[0-9]{3,})$/]",
      "This color does not exist: palettes are gray, blue, red, green, and amber with steps 1-12 and a1-a12.",
    ),
  },
};
