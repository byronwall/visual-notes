import { Show } from "solid-js";
import { Box } from "styled-system/jsx";
import { fetchInboxCount } from "~/services/annotations/annotations.queries";
import { createKeptAsync, onDemand } from "~/utils/kept-async";

/** How many inbox items wait on you; it refreshes live on agent writes. */
export const InboxBadge = () => {
  const count = createKeptAsync(() => fetchInboxCount(), onDemand);
  return (
    <Show when={(count.latest ?? 0) > 0}>
      <Box
        as="span"
        data-testid="inbox-badge"
        minW="5"
        h="4.5"
        px="1.5"
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        borderRadius="full"
        bg="blue.9"
        color="white"
        fontSize="2xs"
        fontWeight="semibold"
      >
        {count.latest}
      </Box>
    </Show>
  );
};
