import { For } from "solid-js";
import { Title } from "@solidjs/meta";
import { useLocation } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { css } from "styled-system/css";
import { Box, Stack } from "styled-system/jsx";
import {
  NOTES_DESTINATION,
  PRIMARY_DESTINATIONS,
} from "~/components/sidebar/nav-items";

const destinationLinkClass = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "2",
  h: "8",
  px: "2.5",
  borderRadius: "l2",
  fontSize: "sm",
  color: "fg.default",
  textDecorationLine: "none",
  bg: "gray.a2",
  transitionProperty: "background-color",
  transitionDuration: "140ms",
  _hover: { bg: "gray.a4", textDecorationLine: "none" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "border.focus",
    outlineOffset: "2px",
  },
  "& svg": { color: "fg.muted" },
});

export const NotFoundPage = () => {
  const location = useLocation();

  return (
    <Box px={{ base: "4", md: "8" }} py={{ base: "8", md: "16" }} maxW="2xl">
      <Title>Not found • Visual Notes</Title>
      <HttpStatusCode code={404} />
      <Stack gap="4">
        <Stack gap="1.5">
          <Box fontSize="xs" fontWeight="medium" color="fg.subtle">
            404
          </Box>
          <Box as="h1" fontSize="2xl" fontWeight="semibold" lineHeight="tight">
            Nothing lives at this address
          </Box>
          <Box
            fontFamily="mono"
            fontSize="sm"
            color="fg.muted"
            wordBreak="break-all"
          >
            {location.pathname}
          </Box>
        </Stack>
        <Box display="flex" flexWrap="wrap" gap="1.5">
          <For each={[NOTES_DESTINATION, ...PRIMARY_DESTINATIONS]}>
            {(item) => (
              <a href={item.href} class={destinationLinkClass}>
                <item.icon size={14} strokeWidth={1.8} />
                {item.label}
              </a>
            )}
          </For>
        </Box>
      </Stack>
    </Box>
  );
};
