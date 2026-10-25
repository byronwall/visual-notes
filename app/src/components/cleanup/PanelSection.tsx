import type { JSX, ParentComponent } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";

/** A titled, bordered block inside the cleanup detail panel. */
export const PanelSection: ParentComponent<{
  title: string;
  aside?: JSX.Element;
}> = (props) => (
  <Stack
    gap="2.5"
    borderWidth="1px"
    borderColor="border"
    borderRadius="l2"
    px="4"
    py="3"
    bg="bg.default"
  >
    <HStack justify="space-between" gap="2" rowGap="1" minH="6" flexWrap="wrap">
      <Text fontSize="sm" fontWeight="semibold">
        {props.title}
      </Text>
      {props.aside}
    </HStack>
    {props.children}
  </Stack>
);
