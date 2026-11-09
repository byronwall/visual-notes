import { createSignal, onMount, Show } from "solid-js";
import { Box } from "styled-system/jsx";
import { useAppChanges } from "~/features/live-sync/NoteLiveSyncProvider";
import { fetchInboxCount } from "~/services/annotations/annotations.queries";

/**
 * How many inbox items wait on you; it refreshes live on agent writes.
 * Client-only on purpose: as a server-rendered read in the app shell it ran
 * on every page render and could hold a page's load open (the doc-audio
 * reload spec hung on it). The count sits at the end of its row, so showing
 * it after mount moves nothing else.
 */
export const InboxBadge = () => {
  const [count, setCount] = createSignal(0);
  const load = async () => {
    try {
      setCount(await fetchInboxCount());
    } catch (error) {
      console.debug("[inbox] count failed", error);
    }
  };
  onMount(() => void load());
  useAppChanges("inbox", () => void load());

  return (
    <Show when={count() > 0}>
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
        {count()}
      </Box>
    </Show>
  );
};
