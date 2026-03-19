import { Meta, Title } from "@solidjs/meta";
import { A, createAsync, useParams } from "@solidjs/router";
import { Match, Show, Suspense, Switch } from "solid-js";
import { Box, Container, HStack, Stack, styled } from "styled-system/jsx";
import { button, link } from "styled-system/recipes";
import { ArchiveGroupCanvas } from "~/components/archive/ArchiveGroupCanvas";
import { Text } from "~/components/ui/text";
import { fetchArchiveGroupCanvasItems } from "~/services/archive/archive.service";

const RouterLink = styled(A, link);
const RouterButtonLink = styled(A, button);

const ArchiveGroupCanvasRoute = () => {
  const params = useParams();
  const groupName = () => decodeURIComponent(params.group || "");
  const items = createAsync(() => fetchArchiveGroupCanvasItems(groupName()));

  return (
    <Box as="main" h="100vh" bg="bg.default" overflow="hidden">
      <Title>{`${groupName() || "Archive"} Canvas • Visual Notes`}</Title>
      <Meta
        property="og:title"
        content={`${groupName() || "Archive"} Canvas • Visual Notes`}
      />

      <Container py="3" px={{ base: "3", md: "4" }} maxW="100%" h="full">
        <Stack gap="3" h="full" minH="0">
          <Suspense fallback={<Text color="fg.muted">Loading canvas…</Text>}>
            <Switch>
              <Match when={(items() || []).length > 0}>
                <ArchiveGroupCanvas
                  groupName={groupName()}
                  items={items() || []}
                  toolbarPrefix={
                    <HStack gap="3" flexShrink="0">
                      <RouterLink href="/archive">Back to Archive</RouterLink>
                      <Show when={groupName()}>
                        <RouterButtonLink
                          href={`/archive?group=${encodeURIComponent(groupName())}`}
                          variant="outline"
                          size="sm"
                        >
                          View list
                        </RouterButtonLink>
                      </Show>
                    </HStack>
                  }
                />
              </Match>
              <Match when={items() && (items() || []).length === 0}>
                <Box
                  p="5"
                  borderRadius="l3"
                  bg="bg.subtle"
                  borderWidth="1px"
                  borderColor="border"
                >
                  <Stack gap="2">
                    <Text fontSize="lg" fontWeight="semibold">
                      No archive items in this group
                    </Text>
                    <Text color="fg.muted">
                      Choose another group from Archive or add items to {groupName()} first.
                    </Text>
                  </Stack>
                </Box>
              </Match>
            </Switch>
          </Suspense>
        </Stack>
      </Container>
    </Box>
  );
};

export default ArchiveGroupCanvasRoute;
