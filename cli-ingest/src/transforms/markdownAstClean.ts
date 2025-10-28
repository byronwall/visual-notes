import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import { visit, SKIP } from "unist-util-visit";

// AST-based cleanup for ChatGPT markdown output
export function cleanChatgptMarkdownAst(markdown: string): string {
  if (!markdown) return markdown;

  let removedEmpty = 0;

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    // Using 'any' here because the project doesn't include mdast/unist types at build time,
    // and we only need minimal structural access to remove empty paragraphs.
    .use(() => (tree: any) => {
      // Remove empty paragraphs/text nodes created by cleanup
      visit(tree, (node: any, index?: number, parent?: any) => {
        if (!parent || typeof index !== "number") return;
        if (node.type === "paragraph") {
          if (!paragraphHasVisibleContent(node)) {
            parent.children.splice(index, 1);
            removedEmpty++;
            return [SKIP, index];
          }
        }
      });
    })
    .use(remarkStringify, {
      fences: true,
      listItemIndent: "one",
      bullet: "-",
    });

  const out = String(processor.processSync(markdown));
  if (removedEmpty > 0)
    console.log(
      `[cleanChatgptMarkdownAst] removed ${removedEmpty} empty node(s)`
    );
  return out;
}

function flattenText(node: any): string {
  let acc = "";
  visit(node as any, "text", (n: any) => {
    acc += n.value || "";
  });
  return acc;
}

function paragraphHasVisibleContent(node: any): boolean {
  if (!node || node.type !== "paragraph" || !Array.isArray(node.children)) {
    return true;
  }
  for (const child of node.children) {
    if (child.type === "image" || child.type === "imageReference") return true;
    if (child.type === "link" || child.type === "linkReference") return true;
    if (child.type === "inlineCode" || child.type === "code") return true;
    if (child.type === "strong" || child.type === "emphasis") {
      // Check nested content
      if (
        paragraphHasVisibleContent({
          type: "paragraph",
          children: child.children || [],
        })
      )
        return true;
    }
    if (child.type === "text") {
      if (String(child.value || "").trim().length > 0) return true;
    }
  }
  return false;
}
