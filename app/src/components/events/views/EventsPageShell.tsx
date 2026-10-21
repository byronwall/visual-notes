import { Title } from "@solidjs/meta";
import type { JSX } from "solid-js";
import { Box, Container } from "styled-system/jsx";
import { EventsTabs } from "../EventsTabs";

/** Page frame for the /events views: title, section tabs, then content. */
export function EventsPageShell(props: {
  title: string;
  actions?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Title>{`${props.title} • Events • Visual Notes`}</Title>
      <Container
        maxW="6xl"
        pt={{ base: "4", md: "6" }}
        pb="24"
        px={{ base: "4", md: "8" }}
      >
        <EventsTabs actions={props.actions} />
        {props.children}
      </Container>
    </Box>
  );
}
