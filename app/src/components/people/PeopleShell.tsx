import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { Show, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { Box, Container, HStack, styled } from "styled-system/jsx";
import { PeopleTabs } from "./PeopleTabs";

const crumb = css({
  fontSize: "sm",
  color: "fg.muted",
  textDecoration: "none",
  _hover: { color: "fg.default", textDecoration: "underline" },
});

/** Page frame for /people routes: title row with actions, then content. */
export function PeopleShell(props: {
  title: string;
  /** Shown as the page heading; the directory uses "People". */
  heading?: JSX.Element;
  /** A back link above the heading, e.g. from a profile to the directory. */
  backLink?: boolean;
  backHref?: string;
  backLabel?: string;
  /** Show the People / Organizations tabs under the heading. */
  tabs?: boolean;
  actions?: JSX.Element;
  children: JSX.Element;
}) {
  const back = () => props.backHref ?? (props.backLink ? "/people" : null);
  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Title>{`${props.title} • Visual Notes`}</Title>
      <Container
        maxW="6xl"
        pt={{ base: "4", md: "6" }}
        pb="24"
        px={{ base: "4", md: "8" }}
      >
        <Show when={back()}>
          {(href) => (
            <A href={href()} class={crumb}>
              ← {props.backLabel ?? "People"}
            </A>
          )}
        </Show>
        <HStack gap="3" mb="4" mt={back() ? "1" : "0"} flexWrap="wrap">
          <styled.h1
            fontSize="2xl"
            fontWeight="semibold"
            lineHeight="tight"
            minW="0"
            flex="1 1 auto"
          >
            {props.heading ?? props.title}
          </styled.h1>
          <HStack gap="2" flexWrap="wrap">
            {props.actions}
          </HStack>
        </HStack>
        <Show when={props.tabs}>
          <PeopleTabs />
        </Show>
        {props.children}
      </Container>
    </Box>
  );
}
