import type { Page, Request, Route } from "@playwright/test";
import { isServerFn } from "./server-fn-id";

// Holds one real server-action request in flight so a spec can change the UI
// (switch notes, close a panel) before the old request completes. The held
// request either continues to the real server or fails at the network layer.

type Hold = {
  action: string;
  match: (postData: string) => boolean;
  captured: (request: Request) => void;
  outcome: Promise<"continue" | "abort">;
};

export type HeldServerAction = {
  /** Resolves once the app has sent the matching request. */
  request: Promise<Request>;
  /** Lets the request reach the real server. */
  release: () => void;
  /** Fails the request with a network error. */
  fail: () => void;
};

const holdsByPage = new WeakMap<Page, Hold[]>();

const serverId = (request: Request) => request.headers()["x-server-id"];

const installInterceptor = async (page: Page) => {
  const holds: Hold[] = [];
  holdsByPage.set(page, holds);
  await page.route("**/_server*", async (route: Route) => {
    const request = route.request();
    const postData = request.postData() ?? "";
    const index = holds.findIndex(
      (hold) =>
        request.method() === "POST" &&
        isServerFn(serverId(request), hold.action) &&
        hold.match(postData),
    );
    if (index === -1) return route.continue();
    const [hold] = holds.splice(index, 1);
    hold.captured(request);
    const outcome = await hold.outcome;
    if (outcome === "abort") return route.abort("failed");
    return route.continue();
  });
  return holds;
};

/** Holds the next `action` request whose body contains every `includes` string. */
export const holdNextServerAction = async (
  page: Page,
  action: string,
  includes: string[] = [],
): Promise<HeldServerAction> => {
  const holds = holdsByPage.get(page) ?? (await installInterceptor(page));
  let captured!: (request: Request) => void;
  let decide!: (outcome: "continue" | "abort") => void;
  const request = new Promise<Request>((resolve) => {
    captured = resolve;
  });
  const outcome = new Promise<"continue" | "abort">((resolve) => {
    decide = resolve;
  });
  holds.push({
    action,
    match: (postData) => includes.every((part) => postData.includes(part)),
    captured,
    outcome,
  });
  return {
    request,
    release: () => decide("continue"),
    fail: () => decide("abort"),
  };
};

/** Counts POSTs to server actions; used to show a cancel path wrote nothing. */
export const countServerActionPosts = (page: Page) => {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/_server")) {
      seen.push(serverId(request) ?? "unknown");
    }
  });
  return seen;
};

/** Waits for the response of a held request after it was released or failed. */
export const settled = async (held: HeldServerAction) => {
  const request = await held.request;
  const response = await request.response().catch(() => null);
  await response?.finished();
  await request
    .frame()
    .page()
    .evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
};
