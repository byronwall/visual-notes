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

export default {
  meta: { name: "vn" },
  rules: {
    "note-body-writes": selectorRule(
      "CallExpression[callee.object.property.name='doc'][callee.property.name=/^(create|createMany|update|updateMany|upsert)$/] Property[key.name=/^(data|create|update)$/] > ObjectExpression > Property[key.name=/^(content|html|markdown)$/]",
      "Write note bodies only through server/notes/note-write.ts or note-store.ts (contentColumns), so validation, dual-write, search text, and the block index stay in step.",
    ),
    "no-nested-select-spread": selectorRule(
      "Property[key.name='select'] Property[key.name='select'] > ObjectExpression > SpreadElement",
      "List nested Prisma select fields explicitly. Spreading a shared object into a nested select made tsc take minutes.",
    ),
  },
};
