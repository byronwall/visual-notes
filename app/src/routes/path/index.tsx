import { Meta, Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { For, Show, Suspense, createMemo, createSignal } from "solid-js";
import { Box, Container, HStack, Stack } from "styled-system/jsx";
import { Input } from "~/components/ui/input";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { fetchPathDiscovery, fetchPathSuggestions } from "~/services/docs.service";
import { pathToRoute } from "~/utils/path-links";

type PathCount = { path: string; count: number };

const comparePath = (a: string, b: string) => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

const PathsIndexPage = () => {
  const paths = createAsync(() => fetchPathSuggestions());
  const discovery = createAsync(() => fetchPathDiscovery());
  const [query, setQuery] = createSignal("");

  const filteredPaths = createMemo(() => {
    const q = query().trim().toLowerCase();
    const all = (paths() || []) as PathCount[];
    if (!q) return all;
    return all.filter((item) => item.path.toLowerCase().includes(q));
  });

  const grouped = createMemo(() => {
    const groups = new Map<string, PathCount[]>();
    for (const item of filteredPaths()) {
      const top = item.path.split(".")[0] || "(unknown)";
      const list = groups.get(top);
      if (list) list.push(item);
      else groups.set(top, [item]);
    }
    return Array.from(groups.entries())
      .map(([top, items]) => ({
        top,
        total: items.reduce((acc, item) => acc + item.count, 0),
        itemsForGrid: items
          .filter((item) => item.path !== top)
          .sort((a, b) => b.count - a.count || comparePath(a.path, b.path)),
      }))
      .sort((a, b) => b.total - a.total || comparePath(a.top, b.top));
  });

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Title>Paths • Visual Notes</Title>
      <Meta property="og:title" content="Paths • Visual Notes" />
      <Meta name="description" content="Explore all note paths and navigate quickly." />
      <Container py="6" px="4" maxW="1100px">
        <Stack gap="5">
          <Stack gap="2">
            <Text fontSize="3xl" fontWeight="bold">
              Paths
            </Text>
            <Text fontSize="sm" color="fg.muted">
              Browse by hierarchy and jump to path detail pages.
            </Text>
          </Stack>

          <Input
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="Filter paths (e.g. prog.react)"
          />

          <Suspense fallback={<Text fontSize="sm" color="fg.muted">Loading recent paths...</Text>}>
            <Show when={(discovery()?.recentlyViewed.length || 0) > 0}>
              <Stack gap="1">
                <Text fontSize="xs" color="fg.muted" textTransform="uppercase">
                  Recently viewed
                </Text>
                <HStack gap="1.5" flexWrap="wrap">
                  <For each={(discovery()?.recentlyViewed || []).slice(0, 8)}>
                    {(item) => (
                      <Link
                        href={pathToRoute(item.path)}
                        fontFamily="mono"
                        fontSize="xs"
                        textDecoration="none"
                        px="2"
                        py="1"
                        borderWidth="1px"
                        borderColor="border"
                        borderRadius="l2"
                        _hover={{ textDecoration: "none", bg: "bg.subtle" }}
                      >
                        {item.path} ({item.count})
                      </Link>
                    )}
                  </For>
                </HStack>
              </Stack>
            </Show>
          </Suspense>

          <Suspense fallback={<Text fontSize="sm" color="fg.muted">Loading paths...</Text>}>
            <Show
              when={grouped().length > 0}
              fallback={
                <Text fontSize="sm" color="fg.subtle">
                  No paths matched this filter.
                </Text>
              }
            >
              <Stack gap="6">
                <For each={grouped()}>
                  {(group) => (
                    <Stack gap="2">
                      <HStack gap="2" alignItems="baseline">
                        <Link
                          href={pathToRoute(group.top)}
                          fontSize={{ base: "2xl", md: "3xl" }}
                          fontWeight="bold"
                          fontFamily="mono"
                          textDecoration="none"
                          _hover={{ textDecoration: "underline" }}
                        >
                          {group.top}
                        </Link>
                        <Text fontSize="sm" color="fg.muted">
                          {group.total} notes
                        </Text>
                      </HStack>
                      <Show when={group.itemsForGrid.length > 0}>
                        <Box
                          display="grid"
                          gridTemplateColumns={{
                            base: "1fr",
                            md: "repeat(2, 1fr)",
                            lg: "repeat(3, 1fr)",
                          }}
                          gap="2"
                        >
                          <For each={group.itemsForGrid}>
                            {(item) => (
                              <Link
                                href={pathToRoute(item.path)}
                                display="flex"
                                alignItems="center"
                                justifyContent="space-between"
                                gap="2"
                                w="full"
                                fontFamily="mono"
                                fontSize="sm"
                                textDecoration="none"
                                px="2.5"
                                py="1.5"
                                borderWidth="1px"
                                borderColor="border"
                                borderRadius="l2"
                                _hover={{ textDecoration: "none", bg: "bg.subtle" }}
                              >
                                <Text as="span" fontFamily="mono">
                                  {item.path}
                                </Text>
                                <Text as="span" color="fg.muted">
                                  {item.count}
                                </Text>
                              </Link>
                            )}
                          </For>
                        </Box>
                      </Show>
                    </Stack>
                  )}
                </For>
              </Stack>
            </Show>
          </Suspense>
        </Stack>
      </Container>
    </Box>
  );
};

export default PathsIndexPage;
