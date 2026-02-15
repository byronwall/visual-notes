import { For, Show, createMemo } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Link } from "~/components/ui/link";
import { PathPillLink } from "~/components/path/PathPillLink";
import { Text } from "~/components/ui/text";
import { pathToRoute } from "~/utils/path-links";

type PathDiscoveryData = {
  recentlyViewed: { path: string; count: number; lastViewedAt?: string }[];
  highCount: { path: string; count: number }[];
};

export const PathDiscoveryLinks = (props: { data?: PathDiscoveryData }) => {
  const merged = createMemo(() => {
    const ordered = [
      ...(props.data?.recentlyViewed || []),
      ...(props.data?.highCount || []),
    ];
    const seen = new Set<string>();
    const out: { path: string; count: number }[] = [];
    for (const item of ordered) {
      if (!item.path || seen.has(item.path)) continue;
      seen.add(item.path);
      out.push({ path: item.path, count: item.count });
      if (out.length >= 10) break;
    }
    return out;
  });

  return (
    <Show when={merged().length > 0}>
      <Stack gap="1">
        <HStack gap="1.5" flexWrap="wrap" alignItems="center">
          <Link
            href="/path"
            fontSize="xs"
            color="fg.muted"
            textTransform="uppercase"
            textDecoration="none"
            _hover={{ textDecoration: "underline" }}
          >
            Paths
          </Link>
          <For each={merged()}>
            {(item) => (
              <PathPillLink
                href={pathToRoute(item.path)}
                variant="subtle"
              >
                {item.path} ({item.count})
              </PathPillLink>
            )}
          </For>
        </HStack>
      </Stack>
    </Show>
  );
};
