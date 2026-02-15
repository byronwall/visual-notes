export const normalizeDotPath = (rawPath: string) =>
  String(rawPath || "")
    .trim()
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join(".");

export const splitDotPath = (path: string) =>
  normalizeDotPath(path).split(".").filter((segment) => segment.length > 0);

export const buildPathAncestors = (path: string) => {
  const segments = splitDotPath(path);
  const ancestors: string[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    ancestors.push(segments.slice(0, i + 1).join("."));
  }
  return ancestors;
};

export const pathToRoute = (path: string) => {
  const segments = splitDotPath(path);
  if (segments.length === 0) return "/path";
  return `/path/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
};

export const routeParamToPath = (segmentsParam?: string) => {
  const raw = String(segmentsParam || "").trim();
  if (!raw) return "";
  return raw
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join(".");
};
