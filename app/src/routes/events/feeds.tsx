import { Title } from "@solidjs/meta";
import { Box, Container } from "styled-system/jsx";
import { EventsTabs } from "~/components/events/EventsTabs";
import { FeedsManager } from "~/components/events/feeds/FeedsManager";
import { FeedsRefreshProvider } from "~/components/events/feeds/feedsRefresh";

export default function EventsFeedsRoute() {
  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Title>Feeds • Events • Visual Notes</Title>
      <Container
        maxW="6xl"
        pt={{ base: "4", md: "6" }}
        pb="24"
        px={{ base: "4", md: "8" }}
      >
        <EventsTabs />
        <FeedsRefreshProvider>
          <FeedsManager />
        </FeedsRefreshProvider>
      </Container>
    </Box>
  );
}
