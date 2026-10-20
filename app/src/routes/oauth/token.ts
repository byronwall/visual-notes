import { connectorRoute, corsPreflight } from "~/server/oauth/route-helpers";
import { handleTokenRequest } from "~/server/oauth/token";

export const POST = connectorRoute(handleTokenRequest);
export const OPTIONS = corsPreflight();
