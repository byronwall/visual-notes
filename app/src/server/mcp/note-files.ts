import { z } from "zod";
import type { NoteNode } from "~/lib/note-content/types";
import { fileAttachmentNodes } from "~/lib/note-content/note-markdown";
import { MAX_IMAGE_BYTES, storeImageBytes } from "~/server/lib/doc-image-store";
import {
  DOC_FILE_MAX_BYTES,
  fetchFileFromUrl,
  FileRejectedError,
  mimeForFileName,
  storedFileSize,
  storeFileBytes,
  type FetchedUpload,
} from "~/server/lib/doc-file-store";
import { detectImageType } from "~/server/lib/inline-image-migration";
import {
  cleanFileName,
  parseDocFileSrc,
} from "~/services/doc-files/doc-files.shared";
import { decodeData } from "./note-images";
import {
  appLink,
  ConnectorError,
  nothingWritten,
  type ConnectorContext,
} from "./shared";

// Files in agent-written notes. Any file type is kept, content-addressed
// under /api/doc-files, and shown in the note as an attachment card; pictures
// can instead be shown inline like a pasted image.

export { DOC_FILE_MAX_BYTES };

/**
 * A file the user gave ChatGPT. Listed in the tool's `openai/fileParams`, so
 * ChatGPT fills it with a short-lived download url instead of the model
 * having to copy the bytes. Exactly these four properties, with only the
 * first two required, or ChatGPT's tool scan rejects the schema.
 */
export const openAiFileArg = z
  .object({
    download_url: z.string().describe("Temporary download url"),
    file_id: z.string().describe("ChatGPT file id"),
    mime_type: z.string().optional(),
    file_name: z.string().optional(),
  })
  .strict();

export type OpenAiFile = z.infer<typeof openAiFileArg>;

export const MAX_FILES_PER_CALL = 10;

/** Formats shown inline as a picture rather than as a file card. */
const INLINE_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "gif",
  "webp",
  "avif",
  "heic",
  "bmp",
]);

export type AttachedFile = {
  name: string;
  /** "image" when shown inline as a picture, "file" for an attachment card. */
  display: "file" | "image";
  mime: string;
  bytes: number;
  /** What to put in markdown; the app stores file paths relative. */
  src: string;
  /** Full web address of the stored file (opens or downloads it). */
  url: string;
  markdown: string;
};

const asConnectorError = (error: unknown): never => {
  if (error instanceof FileRejectedError)
    throw new ConnectorError("invalid", error.message);
  throw error;
};

const escapeLabel = (label: string) =>
  label.replace(/\n/g, " ").replace(/[[\]\\]/g, "\\$&");

/** Markdown for an attachment: a stored-file link alone on its line. */
export const fileMarkdown = (name: string, src: string) =>
  `[${escapeLabel(name)}](${src})`;

export type FileSource = {
  files?: OpenAiFile[];
  data?: string;
  url?: string;
  /** File name for data or url (ChatGPT files carry their own). */
  name?: string;
  /** Type of data, when the name has no extension. */
  mimeType?: string;
};

/** Reads every file the call names, before anything is stored. */
async function loadSources(input: FileSource): Promise<FetchedUpload[]> {
  const given = [
    Boolean(input.files?.length),
    Boolean(input.data),
    Boolean(input.url),
  ];
  if (given.filter(Boolean).length !== 1) {
    throw new ConnectorError(
      "invalid",
      "Pass exactly one of files (files the user gave you), data (base64), or url.",
    );
  }
  if (input.files?.length) {
    if (input.files.length > MAX_FILES_PER_CALL) {
      throw new ConnectorError(
        "invalid",
        `Attach at most ${MAX_FILES_PER_CALL} files per call`,
      );
    }
    return Promise.all(
      input.files.map((file) =>
        fetchFileFromUrl(file.download_url, {
          name: file.file_name,
          mime: file.mime_type,
        }).catch(asConnectorError),
      ),
    );
  }
  if (input.data) {
    return [
      {
        buffer: decodeData(input.data),
        name: input.name,
        mime: input.mimeType ?? "",
      },
    ];
  }
  return [
    await fetchFileFromUrl(input.url!, {
      name: input.name,
      mime: input.mimeType,
    }).catch(asConnectorError),
  ];
}

async function storeOne(
  ctx: ConnectorContext,
  upload: FetchedUpload,
  asImage: boolean,
  label: string,
): Promise<AttachedFile> {
  // Pictures over the image limit still keep as a file.
  if (asImage && upload.buffer.length <= MAX_IMAGE_BYTES) {
    const kind = detectImageType(upload.buffer, "");
    if (INLINE_IMAGE_EXTENSIONS.has(kind.ext)) {
      const stored = await storeImageBytes(upload.buffer, label);
      const name = cleanFileName(upload.name ?? "", "image");
      return {
        name,
        display: "image",
        mime: stored.mime,
        bytes: upload.buffer.length,
        src: stored.publicUrl,
        url: appLink(ctx, stored.publicUrl),
        markdown: `![${escapeLabel(name.replace(/\.[a-z0-9]+$/i, ""))}](${stored.publicUrl})`,
      };
    }
  }
  const stored = await storeFileBytes(upload.buffer, {
    name: upload.name,
    mime: upload.mime,
    label,
  }).catch(asConnectorError);
  return {
    name: stored.name,
    display: "file",
    mime: stored.mime,
    bytes: stored.bytes,
    src: stored.src,
    url: appLink(ctx, stored.src),
    markdown: fileMarkdown(stored.name, stored.src),
  };
}

/** Stores the files and returns markdown for each; no note changes. */
export async function storeFiles(
  ctx: ConnectorContext,
  input: FileSource & { display?: "auto" | "file" },
): Promise<AttachedFile[]> {
  const uploads = await loadSources(input);
  const asImage = (input.display ?? "auto") === "auto";
  const stored: AttachedFile[] = [];
  for (const [index, upload] of uploads.entries()) {
    const label =
      uploads.length > 1
        ? `File ${index + 1} (${upload.name ?? "unnamed"})`
        : `The file${upload.name ? ` ${upload.name}` : ""}`;
    stored.push(await storeOne(ctx, upload, asImage, label));
  }
  return stored;
}

/**
 * Checks attachments new to these blocks point at stored files, and fills in
 * each one's type and size so the card renders without asking the server.
 * Attachments already in `previous` are left as they are.
 */
export async function describeFileAttachments(
  blocks: NoteNode[],
  previous: NoteNode[] = [],
): Promise<void> {
  const had = new Set(
    fileAttachmentNodes(previous).map((n) => String(n.attrs?.src)),
  );
  const problems: string[] = [];
  for (const node of fileAttachmentNodes(blocks)) {
    const src = String(node.attrs!.src);
    if (had.has(src)) continue;
    const stored = parseDocFileSrc(src);
    const size = stored ? await storedFileSize(stored.hash) : null;
    if (!stored || size === null) {
      problems.push(
        `${src} is not a stored file; store it with notes_attach_file first`,
      );
      continue;
    }
    node.attrs = {
      ...node.attrs,
      name: node.attrs?.name || stored.name,
      mime: mimeForFileName(stored.name),
      size,
    };
  }
  if (problems.length) {
    throw new ConnectorError("invalid", nothingWritten(problems));
  }
}
