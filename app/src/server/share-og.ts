import { buildShareAbsoluteUrl } from "~/services/doc-shares.shared";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value: string, maxChars: number, maxLines: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
      continue;
    }
    current = next;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

export function buildShareOgSvg(input: {
  title: string;
  previewText: string;
  shareUrl: string;
  baseUrl: string;
  path?: string | null;
}) {
  const resolvedTitle = input.title.trim() || "Untitled note";
  const resolvedPreview =
    input.previewText.trim() &&
    input.previewText.trim() !== "No preview available."
      ? input.previewText.trim()
      : "Open a shared note from Visual Notes.";
  const titleLines = wrapText(resolvedTitle, 24, 3);
  const previewLines = wrapText(resolvedPreview, 48, 4);
  const shareHref = buildShareAbsoluteUrl(input.baseUrl, input.shareUrl);
  const pathText = input.path ? input.path : "Shared note";

  const titleMarkup = titleLines
    .map(
      (line, index) =>
        `<tspan x="72" dy="${index === 0 ? 0 : 58}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  const previewMarkup = previewLines
    .map(
      (line, index) =>
        `<tspan x="72" dy="${index === 0 ? 0 : 34}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" rx="36" fill="#F7F5EF"/>
  <rect x="28" y="28" width="1144" height="574" rx="30" fill="#FFFCF2" stroke="#DDD6C8" stroke-width="2"/>
  <rect x="72" y="72" width="178" height="36" rx="18" fill="#E6F4EA"/>
  <text x="103" y="95" fill="#216E39" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="700">PUBLIC SHARE</text>
  <text x="72" y="158" fill="#3D352B" font-family="ui-sans-serif, system-ui" font-size="54" font-weight="700">
    ${titleMarkup}
  </text>
  <text x="72" y="348" fill="#5A5146" font-family="ui-sans-serif, system-ui" font-size="28" font-weight="500">
    ${previewMarkup}
  </text>
  <rect x="72" y="500" width="1056" height="74" rx="18" fill="#F1ECE0" stroke="#DDD6C8"/>
  <text x="108" y="530" fill="#6C6256" font-family="ui-monospace, monospace" font-size="18">${escapeXml(pathText)}</text>
  <text x="108" y="559" fill="#3D352B" font-family="ui-monospace, monospace" font-size="22" font-weight="600">${escapeXml(shareHref)}</text>
  <circle cx="1044" cy="92" r="12" fill="#216E39"/>
  <circle cx="1082" cy="92" r="12" fill="#D97706"/>
</svg>`;
}
