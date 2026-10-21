// Markdown shapes seen in real imported notes (Notion, Evernote, web clips).
// The block migration's false loss reports (#143) and the 6k-note memory
// blowups (#144) only showed up on these shapes at production volume, so the
// unit corpus test and the scale seeder both draw from this list.

export type CorpusSample = { name: string; markdown: string };

export const importedMarkdownSamples: CorpusSample[] = [
  {
    name: "setext heading and bare link",
    markdown:
      "On Talent\n=========\n\n[https://example.com/blog/talent](https://example.com/blog/talent)\n\n===",
  },
  {
    name: "image-only clip",
    markdown: `Saved Photo\n===========\n\n![](/api/doc-images/${"a".repeat(64)}.jpeg)\n\n===`,
  },
  {
    name: "empty link label",
    markdown:
      "Reading list\n\n- [](https://example.com/one)\n- [Two](https://example.com/two)",
  },
  {
    name: "table with inline marks",
    markdown:
      "## Budget\n\n| Item | Cost | Notes |\n| --- | ---: | --- |\n| Tent | $120 | **borrow** if possible |\n| Stove | $45 | _maybe_ |\n| Fuel | $9 | `isobutane` |",
  },
  {
    name: "entities and angle brackets",
    markdown: "Q&amp;A: is a &lt; b &amp;&amp; b &gt; c? Use A & B < C.",
  },
  {
    name: "fenced code with language",
    markdown:
      "Snippet\n\n```ts\nconst total = items.reduce((sum, item) => sum + item.cost, 0);\nconsole.info(`[budget] ${total}`);\n```\n\nAfter the code.",
  },
  {
    name: "task checkboxes and nesting",
    markdown:
      "# Weekend\n\n- [ ] Pack the car\n  - [x] Tent\n  - [ ] Water filter\n- [x] Book the site\n\n1. First\n2. Second\n   - nested bullet",
  },
  {
    name: "blockquote and rule",
    markdown:
      "> The best way to predict the future is to invent it.\n>\n> — attributed\n\n---\n\nTrailing paragraph with a footnote-ish marker[^1].",
  },
  {
    name: "raw html fragment",
    markdown:
      '<div class="clip"><p>Clipped <b>bold</b> and <a href="https://example.com">a link</a>.</p><br><span style="color:red">styled</span></div>',
  },
  {
    name: "long unbroken paragraph",
    markdown: Array.from(
      { length: 120 },
      (_, i) => `Sentence ${i} keeps going with ordinary words.`,
    ).join(" "),
  },
];

/** Small deterministic PRNG so seeded databases are reproducible. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const words =
  "project meeting notes idea follow up draft review budget travel recipe garden reading book client design research weekly plan decision question answer".split(
    " ",
  );

/** One synthetic note: 1–12 corpus samples plus filler, 0.3–30 KB. */
export function syntheticNote(index: number, random: () => number) {
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  const title = `${pick(words)} ${pick(words)} ${index}`;
  const parts: string[] = [`# ${title}`];
  const sections = 1 + Math.floor(random() * 12);
  for (let i = 0; i < sections; i += 1) {
    parts.push(pick(importedMarkdownSamples).markdown);
    const filler = Math.floor(random() * 40);
    parts.push(
      Array.from({ length: filler }, () => pick(words)).join(" ") + ".",
    );
  }
  return { title, markdown: parts.join("\n\n") };
}
