type ParsedTaskTitle = {
  description: string;
  tags: string[];
};

const TITLE_TAG_PATTERN = /(^|\s)#([A-Za-z0-9][A-Za-z0-9/_-]*)/g;

export const formatTaskTitle = (description: string, tags: string[]) => {
  const trimmedDescription = description.trim();
  const normalizedTags = tags.map((tag) => tag.trim()).filter(Boolean);

  if (normalizedTags.length === 0) return trimmedDescription;
  if (!trimmedDescription) {
    return normalizedTags.map((tag) => `#${tag}`).join(" ");
  }

  return `${trimmedDescription} ${normalizedTags.map((tag) => `#${tag}`).join(" ")}`;
};

export const parseTaskTitle = (value: string): ParsedTaskTitle => {
  const tags: string[] = [];
  const seen = new Set<string>();

  const description = value
    .replace(TITLE_TAG_PATTERN, (match, prefix: string, rawTag: string) => {
      const normalizedTag = rawTag.trim();
      const dedupeKey = normalizedTag.toLowerCase();
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        tags.push(normalizedTag);
      }
      return prefix;
    })
    .replace(/\s+/g, " ")
    .trim();

  return {
    description,
    tags,
  };
};
