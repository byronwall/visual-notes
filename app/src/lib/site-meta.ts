export const SITE_NAME = "Decisory";

export const SITE_DESCRIPTION = "Guided questions. Better decisions.";

export const SITE_URL =
  import.meta.env.VITE_SITE_URL || "http://localhost:3000";

export const SITE_IMAGE = `${SITE_URL}/og-image.png`;

export type PageMetadata = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
};

export function formatPageTitle(pageTitle?: string) {
  const t = (pageTitle ?? "").trim();
  if (!t) return SITE_NAME;
  return `${t} · ${SITE_NAME}`;
}

export function getDefaultMetadata(
  overrides?: PageMetadata
): Required<PageMetadata> {
  return {
    title: overrides?.title ? formatPageTitle(overrides.title) : SITE_NAME,
    description: overrides?.description ?? SITE_DESCRIPTION,
    image: overrides?.image ?? SITE_IMAGE,
    url: overrides?.url ?? SITE_URL,
    type: overrides?.type ?? "website",
  };
}



