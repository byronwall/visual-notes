import {
  FileArchiveIcon,
  FileHeadphoneIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FilePlayIcon,
  PresentationIcon,
} from "lucide-solid";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  fileExtension,
  type FileKind,
} from "~/services/doc-files/doc-files.shared";

const ICONS: Record<FileKind, Component<{ size?: number }>> = {
  pdf: FileTextIcon,
  doc: FileTextIcon,
  text: FileTextIcon,
  image: FileImageIcon,
  audio: FileHeadphoneIcon,
  video: FilePlayIcon,
  sheet: FileSpreadsheetIcon,
  slides: PresentationIcon,
  code: FileCodeIcon,
  archive: FileArchiveIcon,
  file: FileIcon,
};

export function FileKindIcon(props: { kind: FileKind; size?: number }) {
  return <Dynamic component={ICONS[props.kind]} size={props.size ?? 18} />;
}

const LABELS: Partial<Record<FileKind, string>> = {
  pdf: "PDF",
  image: "Image",
  audio: "Audio",
  video: "Video",
  sheet: "Spreadsheet",
  slides: "Slides",
  doc: "Document",
  text: "Text",
  code: "Code",
  archive: "Archive",
};

/** "PDF", "XLSX spreadsheet", "ZIP archive", ... for the card's meta line. */
export function fileKindLabel(kind: FileKind, name: string): string {
  const ext = fileExtension(name).toUpperCase();
  if (kind === "pdf") return "PDF";
  const label = LABELS[kind];
  if (!label || kind === "text" || kind === "code")
    return ext ? `${ext} file` : "File";
  return ext ? `${ext} ${label.toLowerCase()}` : label;
}

/** Kinds a browser tab can show, so the card offers Open as well as Download. */
export const PREVIEWABLE_KINDS = new Set<FileKind>([
  "pdf",
  "image",
  "audio",
  "video",
  "text",
]);
