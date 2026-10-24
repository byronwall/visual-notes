import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

// Fetches a file from the public web on behalf of an untrusted caller (an
// agent passing a url). Every address the socket connects to is checked at
// connect time, including after redirects, so a hostname cannot resolve to
// the app's own network (loopback, private ranges, cloud metadata).

// IPv4-mapped IPv6 (::ffff:a.b.c.d) is unwrapped in isPublicAddress rather
// than listed: BlockList would match that prefix against every IPv4 address.
const NOT_PUBLIC = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  NOT_PUBLIC.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  NOT_PUBLIC.addSubnet(net, prefix, "ipv6");
}

export class PublicFetchError extends Error {}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (family === 6 && address.toLowerCase().startsWith("::ffff:")) {
    return isPublicAddress(address.slice(7));
  }
  return !NOT_PUBLIC.check(address, family === 4 ? "ipv4" : "ipv6");
}

const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    const list = addresses as LookupAddress[];
    const blocked = list.find((a) => !isPublicAddress(a.address));
    if (blocked || list.length === 0) {
      return callback(
        new PublicFetchError(`${hostname} is not a public address`),
        "",
        4,
      );
    }
    if (options.all) return callback(null, list as never, 4);
    callback(null, list[0].address, list[0].family);
  });
};

export type FetchedFile = {
  buffer: Buffer;
  contentType: string;
  /** The Content-Disposition header, which may name the file. */
  contentDisposition: string;
  finalUrl: string;
};

type FetchOptions = {
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Accept header; images unless the caller wants any file. */
  accept?: string;
};

function getOnce(
  url: URL,
  { maxBytes, timeoutMs, accept }: Required<Omit<FetchOptions, "maxRedirects">>,
): Promise<{ redirect?: string } & Partial<FetchedFile>> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      {
        lookup: publicOnlyLookup,
        timeout: timeoutMs,
        headers: { accept, "user-agent": "VisualNotes/1.0" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: res.headers.location });
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new PublicFetchError(`${url.host} answered ${status}`));
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > maxBytes) {
          res.destroy();
          return reject(tooLarge(maxBytes));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            res.destroy();
            reject(tooLarge(maxBytes));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: String(res.headers["content-type"] ?? ""),
            contentDisposition: String(
              res.headers["content-disposition"] ?? "",
            ),
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("timeout", () =>
      req.destroy(new PublicFetchError(`${url.host} did not answer in time`)),
    );
    req.on("error", (error) =>
      reject(
        error instanceof PublicFetchError
          ? error
          : new PublicFetchError(
              `Could not fetch ${url.host}: ${error.message}`,
            ),
      ),
    );
  });
}

const tooLarge = (maxBytes: number) =>
  new PublicFetchError(
    `The file is larger than ${Math.round(maxBytes / 1e6)} MB`,
  );

/** GET a public http(s) url, following up to `maxRedirects` redirects. */
export async function fetchPublicFile(
  rawUrl: string,
  {
    maxBytes,
    timeoutMs = 15_000,
    maxRedirects = 3,
    accept = "image/*",
  }: FetchOptions,
): Promise<FetchedFile> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PublicFetchError(`${rawUrl} is not a url`);
  }
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new PublicFetchError("Only http and https urls can be fetched");
    }
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && !isPublicAddress(host)) {
      throw new PublicFetchError(`${host} is not a public address`);
    }
    const result = await getOnce(url, { maxBytes, timeoutMs, accept });
    if (result.redirect === undefined) {
      return {
        buffer: result.buffer!,
        contentType: result.contentType!,
        contentDisposition: result.contentDisposition!,
        finalUrl: url.toString(),
      };
    }
    url = new URL(result.redirect, url);
  }
  throw new PublicFetchError(`More than ${maxRedirects} redirects`);
}
