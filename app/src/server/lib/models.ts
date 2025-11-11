export const SUPPORTED_MODELS = [
  // Keep the default first to use when not specified
  "gpt-4o-mini",
  "gpt-5",
  "gpt-5-mini",
];

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];
