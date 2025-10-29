import { createEffect, createMemo, createResource } from "solid-js";
import { marked } from "marked";
import { codeToHtml } from "shiki";
import { sanitizeHtmlContent } from "~/server/lib/markdown";

type Props = {
  markdown?: string;
  html?: string;
  class?: string;
  theme?: string; // e.g., 'github-light' | 'github-dark-default'
};

async function highlightHtmlWithShiki(html: string, theme: string) {
  // Parse the HTML to find <pre><code> blocks and replace them with Shiki output
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const codeBlocks = Array.from(doc.querySelectorAll("pre > code"));

  for (const codeEl of codeBlocks) {
    const pre = codeEl.parentElement as HTMLElement | null;
    const className = codeEl.getAttribute("class") || "";
    const m = className.match(/language-([a-zA-Z0-9_+-]+)/);
    const lang = m ? m[1] : "text";
    const codeText = codeEl.textContent || "";
    try {
      const shikiHtml = await codeToHtml(codeText, {
        lang,
        theme: theme as any,
      });
      if (pre) {
        // Replace the outer <pre> with Shiki's <pre class="shiki ...">
        const wrapper = doc.createElement("div");
        wrapper.innerHTML = shikiHtml;
        const shikiPre = wrapper.firstElementChild;
        if (shikiPre) pre.replaceWith(shikiPre);
      }
    } catch (err) {
      // Fall back to leaving the original code block
      console.warn("[MarkdownView] Shiki highlight failed", err);
    }
  }

  return doc.body.innerHTML;
}

export default function MarkdownView(props: Props) {
  const theme = createMemo(() => props.theme || "github-light");

  const [rendered] = createResource(
    () => ({ md: props.markdown, html: props.html, theme: theme() }),
    async ({ md, html, theme }) => {
      try {
        console.log("[MarkdownView] rendering, theme=", theme);
      } catch {}
      let baseHtml: string;
      if (md && md.trim()) {
        // Render markdown to HTML first
        baseHtml = String(marked.parse(md, { breaks: true }));
      } else {
        baseHtml = html || "";
      }

      if (!baseHtml) return "";

      // On the server, DOMParser is not available → skip Shiki highlight
      let processed = baseHtml;
      if (typeof window !== "undefined") {
        processed = await highlightHtmlWithShiki(baseHtml, theme);
      }

      // Sanitize the final HTML before rendering
      const safe = sanitizeHtmlContent(processed);
      return safe;
    }
  );

  // Debug: log length when content changes
  createEffect(() => {
    const h = rendered();
    if (h) {
      try {
        console.log("[MarkdownView] rendered html length:", h.length);
      } catch {}
    }
  });

  return (
    <div
      class={props.class || "prose max-w-none"}
      // eslint-disable-next-line solid/no-innerhtml
      innerHTML={rendered() || ""}
    />
  );
}
