import { action, query } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { isMcpConnectorEnabled } from "~/server/mcp/config";
import {
  approveAuthorizeRequest,
  checkAuthorizeRequest,
  denyAuthorizeRequest,
  type AuthorizeParams,
} from "~/server/oauth/authorize";
import { isLoopbackRedirectUri } from "~/server/oauth/clients";

export type OAuthConsent =
  | {
      kind: "ask";
      clientName: string | null;
      redirectHost: string;
      /** The code goes to a program on this computer, such as Claude Code. */
      redirectIsLocal: boolean;
      scopes: string[];
    }
  | { kind: "redirect"; url: string }
  | { kind: "error"; message: string };

function requireRequest(): Request {
  const request = getRequestEvent()?.request;
  if (!request) throw new Error("No request context");
  return request;
}

export const fetchOAuthConsent = query(
  async (params: AuthorizeParams): Promise<OAuthConsent> => {
    "use server";
    if (!isMcpConnectorEnabled()) {
      return { kind: "error", message: "The ChatGPT connector is turned off." };
    }
    const check = await checkAuthorizeRequest(requireRequest(), params);
    if (check.kind === "fatal")
      return { kind: "error", message: check.message };
    if (check.kind === "redirect") return check;
    return {
      kind: "ask",
      clientName: check.request.clientName,
      redirectHost: new URL(check.request.redirectUri).host,
      redirectIsLocal: isLoopbackRedirectUri(check.request.redirectUri),
      scopes: check.request.scope.split(" "),
    };
  },
  "oauth-consent",
);

/** Re-validates the request, then returns where the browser should go. */
export const decideOAuthConsent = action(
  async (input: { params: AuthorizeParams; approve: boolean }) => {
    "use server";
    if (!isMcpConnectorEnabled()) throw new Error("Connector disabled");
    const request = requireRequest();
    const check = await checkAuthorizeRequest(request, input.params);
    if (check.kind === "fatal") throw new Error(check.message);
    if (check.kind === "redirect") return { url: check.url };
    const url = input.approve
      ? await approveAuthorizeRequest(request, check.request)
      : denyAuthorizeRequest(request, check.request);
    return { url };
  },
  "oauth-consent-decide",
);
