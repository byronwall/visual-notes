import { Title } from "@solidjs/meta";
import type { JSX } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";

/** Page frame for the cross-note views (tags, open tasks). */
export function ViewPageShell(props: {
  title: string;
  subtitle?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Title>{`${props.title} • Visual Notes`}</Title>
      <Stack gap="4" maxW="760px" mx="auto" px="4" py="6">
        <Stack gap="1">
          <Heading as="h1" fontSize="2xl">
            {props.title}
          </Heading>
          {props.subtitle ? (
            <Text color="fg.muted" textStyle="sm">
              {props.subtitle}
            </Text>
          ) : null}
        </Stack>
        {props.children}
      </Stack>
    </Box>
  );
}
