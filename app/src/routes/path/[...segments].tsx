import { Meta, Title } from "@solidjs/meta";
import { createAsync, useNavigate, useParams } from "@solidjs/router";
import { For, Show, Suspense, createMemo } from "solid-js";
import { css } from "styled-system/css";
import { Box, Container, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Breadcrumb from "~/components/ui/breadcrumb";
import { Text } from "~/components/ui/text";
import { fetchDocPreviews, fetchPathPageData } from "~/services/docs.service";
import { PathChildPathLinks } from "~/features/path-view/components/PathChildPathLinks";
import { PathGroupSection } from "~/features/path-view/components/PathGroupSection";
import { usePathGroups } from "~/features/path-view/hooks/usePathGroups";
import { buildPathAncestors, pathToRoute, routeParamToPath } from "~/utils/path-links";

const titleTriggerClass = css({
  display: "inline-flex",
  color: "inherit",
  textDecoration: "none",
  fontWeight: "semibold",
  fontSize: "xl",
  lineHeight: "1.3",
  _hover: { textDecoration: "underline" },
});

const pathSubtitleClass = css({
  fontSize: "sm",
  color: "fg.muted",
  fontFamily: "mono",
});

const DocsPathPage = () => {
  const params = useParams();
  const navigate = useNavigate();
  const path = createMemo(() => routeParamToPath(params.segments));
  const data = createAsync(() => fetchPathPageData({ path: path() }));
  const breadcrumbs = createMemo(() => buildPathAncestors(path()));

  const groups = usePathGroups({
    path,
    notes: () => data()?.notes || [],
  });

  const previewDocs = createAsync(() => {
    const ids = groups.visibleNoteIds();
    if (ids.length === 0) return Promise.resolve([]);
    return fetchDocPreviews(ids);
  });

  const previewById = createMemo(
    () => new Map((previewDocs() || []).map((item) => [item.id, item])),
  );

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="6" px="4" maxW="1200px">
        <Suspense fallback={<Text color="fg.muted">Loading path notes…</Text>}>
          <Show
            when={path().length > 0}
            fallback={
              <Stack gap="3" alignItems="flex-start">
                <Title>Path not found • Visual Notes</Title>
                <Meta property="og:title" content="Path not found • Visual Notes" />
                <Text color="fg.muted">This path does not exist.</Text>
                <Button variant="outline" onClick={() => navigate("/")}>
                  Go home
                </Button>
              </Stack>
            }
          >
            <Title>{`Path: ${path()} • Visual Notes`}</Title>
            <Meta property="og:title" content={`Path: ${path()} • Visual Notes`} />
            <Meta
              name="description"
              content={`Browse notes for path ${path()} and nested children.`}
            />

            <Stack gap="5">
              <Breadcrumb.Root>
                <Breadcrumb.List>
                  <Breadcrumb.Item>
                    <Breadcrumb.Link href="/path">&lt;root&gt;</Breadcrumb.Link>
                  </Breadcrumb.Item>
                  <Breadcrumb.Separator />
                  <For each={breadcrumbs()}>
                    {(ancestor, i) => (
                      <>
                        <Breadcrumb.Item>
                          <Breadcrumb.Link href={pathToRoute(ancestor)}>
                            {ancestor.split(".").pop() || ancestor}
                          </Breadcrumb.Link>
                        </Breadcrumb.Item>
                        <Show when={i() < breadcrumbs().length - 1}>
                          <Breadcrumb.Separator />
                        </Show>
                      </>
                    )}
                  </For>
                </Breadcrumb.List>
              </Breadcrumb.Root>

              <Show when={(data()?.childPaths.length || 0) > 0}>
                <PathChildPathLinks childPaths={data()?.childPaths || []} />
              </Show>

              <Show
                when={(data()?.notes.length || 0) > 0}
                fallback={
                  <Text fontSize="sm" color="fg.subtle">
                    No notes found for this path yet.
                  </Text>
                }
              >
                <Stack gap="6">
                  <For each={groups.grouped()}>
                    {(group) => (
                      <PathGroupSection
                        group={group}
                        notes={groups.visibleNotesForGroup(group)}
                        previewById={previewById()}
                        titleTriggerClass={titleTriggerClass}
                        pathSubtitleClass={pathSubtitleClass}
                        canExpand={groups.canExpandGroup(group)}
                        expanded={groups.isGroupExpanded(group.groupPath)}
                        onToggleExpanded={() =>
                          groups.toggleGroupExpanded(group.groupPath)
                        }
                      />
                    )}
                  </For>
                </Stack>
              </Show>
            </Stack>
          </Show>
        </Suspense>
      </Container>
    </Box>
  );
};

export default DocsPathPage;
