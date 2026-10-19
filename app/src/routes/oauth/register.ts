import { handleClientRegistration } from "~/server/oauth/clients";
import { connectorRoute, corsPreflight } from "~/server/oauth/route-helpers";

export const POST = connectorRoute(handleClientRegistration);
export const OPTIONS = corsPreflight();
