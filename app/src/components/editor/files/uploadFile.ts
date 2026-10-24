import {
  DOC_FILE_MAX_BYTES,
  DOC_FILE_URL_PREFIX,
  formatFileSize,
  type DocFileUploadResult,
} from "~/services/doc-files/doc-files.shared";

// Attachments can be tens of megabytes, so uploads use XHR for progress
// (fetch has no upload progress). Network blips and 5xx answers retry.

const RETRY_DELAYS_MS = [800, 2_400];

export class FileUploadError extends Error {
  /** False when retrying cannot help (too large, empty, refused). */
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

function sendOnce(
  file: File,
  onProgress: (fraction: number) => void,
): Promise<DocFileUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", DOC_FILE_URL_PREFIX);
    xhr.setRequestHeader(
      "content-type",
      file.type || "application/octet-stream",
    );
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () =>
      reject(new FileUploadError("Could not reach the server", true));
    xhr.onload = () => {
      let body: Partial<DocFileUploadResult & { error: string }> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // fall through to the status message
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.src) {
        return resolve(body as DocFileUploadResult);
      }
      reject(
        new FileUploadError(
          body.error || `Upload failed (${xhr.status})`,
          xhr.status >= 500,
        ),
      );
    };
    xhr.send(file);
  });
}

/** Stores a file as a note attachment, reporting upload progress (0–1). */
export async function uploadDocFile(
  file: File,
  onProgress: (fraction: number) => void = () => {},
): Promise<DocFileUploadResult> {
  if (file.size === 0)
    throw new FileUploadError(`${file.name} is empty`, false);
  if (file.size > DOC_FILE_MAX_BYTES) {
    throw new FileUploadError(
      `${file.name} is ${formatFileSize(file.size)}; attachments can be up to ${formatFileSize(DOC_FILE_MAX_BYTES)}`,
      false,
    );
  }
  let lastError: FileUploadError | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
    try {
      return await sendOnce(file, onProgress);
    } catch (error) {
      lastError =
        error instanceof FileUploadError
          ? error
          : new FileUploadError("Upload failed", true);
      if (!lastError.retryable) break;
    }
  }
  throw lastError ?? new FileUploadError("Upload failed", true);
}
