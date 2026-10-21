import { Title } from "@solidjs/meta";
import { Show, children, type JSX } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";

/** Page frame for the cross-note views (tags, open tasks). */
export function ViewPageShell(props: {
  title: string;
  subtitle?: JSX.Element;
  children: JSX.Element;
}) {
  // Resolve the subtitle once. Reading a JSX prop twice builds it twice, and
  // a subtitle with a component in it (the open-tasks page's <A>) then
  // claimed hydration keys out of order: "template2 is not a function".
  const subtitle = children(() => props.subtitle);
  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Title>{`${props.title} • Visual Notes`}</Title>
      <Stack gap="4" maxW="760px" mx="auto" px="4" py="6">
        <Stack gap="1">
          <Heading as="h1" fontSize="2xl">
            {props.title}
          </Heading>
          <Show when={subtitle()}>
            <Text color="fg.muted" textStyle="sm">
              {subtitle()}
            </Text>
          </Show>
        </Stack>
        {props.children}
      </Stack>
    </Box>
  );
}
