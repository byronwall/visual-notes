import { For, type VoidComponent } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Skeleton } from "~/components/ui/skeleton";

/** Rows the height of real queue rows, so the list doesn't jump. */
export const QueueSkeleton: VoidComponent = () => (
  <Stack gap="0" aria-busy="true" aria-label="Loading notes">
    <For each={Array.from({ length: 8 })}>
      {() => (
        <Box px="3" py="2.5" borderBottomWidth="1px" borderColor="border">
          <Stack gap="1">
            <Skeleton h="5" w="80%" />
            <Skeleton h="4" w="55%" />
            <Skeleton h="4" w="full" />
          </Stack>
        </Box>
      )}
    </For>
  </Stack>
);

export const DetailSkeleton: VoidComponent = () => (
  <Stack gap="4" aria-busy="true" aria-label="Loading note">
    <Skeleton h="7" w="60%" />
    <Skeleton h="4" w="30%" />
    <Skeleton h="24" w="full" />
    <Skeleton h="24" w="full" />
  </Stack>
);
