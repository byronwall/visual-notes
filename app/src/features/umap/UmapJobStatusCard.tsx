import { Show, Suspense } from "solid-js";
import type { Accessor } from "solid-js";
import type { JobStatus } from "~/services/jobs/jobs.queries";
import { Box, Flex, Stack } from "styled-system/jsx";

type UmapJobStatusCardProps = {
  activeJobId: string;
  activeJob: Accessor<JobStatus | null | undefined>;
};

export function UmapJobStatusCard(props: UmapJobStatusCardProps) {
  return (
    <Show when={props.activeJobId}>
      <Suspense fallback={null}>
        <Show when={props.activeJob()}>
          {(job) => (
            <Box
              borderWidth="1px"
              borderColor="border"
              borderRadius="l2"
              bg="bg.default"
              p="3"
            >
              <Stack gap="2">
                <Flex align="center" justify="space-between" gap="3">
                  <Box fontSize="sm" fontWeight="medium">
                    {job().typeLabel}
                  </Box>
                  <Box fontSize="xs" color="fg.muted">
                    {job().stageLabel} • {job().progress}%
                  </Box>
                </Flex>
                <Box h="2" w="full" bg="bg.muted" borderRadius="full" overflow="hidden">
                  <Box
                    h="full"
                    bg={job().stage === "failed" ? "red.500" : "green.500"}
                    style={{
                      width: `${Math.max(0, Math.min(100, job().progress))}%`,
                      transition: "width 180ms ease",
                    }}
                  />
                </Box>
                <Show when={job().error}>
                  <Box fontSize="xs" color="red.600">
                    {job().error}
                  </Box>
                </Show>
              </Stack>
            </Box>
          )}
        </Show>
      </Suspense>
    </Show>
  );
}
