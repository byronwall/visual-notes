import { useNavigate } from "@solidjs/router";
import { For, Show } from "solid-js";
import { Box, styled } from "styled-system/jsx";
import * as Table from "~/components/ui/table";
import { Text } from "~/components/ui/text";
import { formatRelativeTimestamp } from "~/features/umap/format";
import { type DashboardRun, previewText } from "./ai-dashboard-model";
import { RunStatusIcon } from "./RunStatusIcon";

type RunsTableProps = {
  runs: DashboardRun[];
};

export const RunsTable = (props: RunsTableProps) => {
  const navigate = useNavigate();

  return (
    <Table.Root tableLayout="fixed">
      <Table.Head>
        <Table.Row>
          <Table.Header w="10" pr="0">
            <styled.span srOnly>Status</styled.span>
          </Table.Header>
          <Table.Header>Run</Table.Header>
          <Table.Header w="44" display={{ base: "none", md: "table-cell" }}>
            Model
          </Table.Header>
          <Table.Header w="24" textAlign="right">
            When
          </Table.Header>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <For each={props.runs}>
          {(run) => {
            const href = `/ai/runs/${run.id}`;
            const summary = () =>
              run.status === "ERROR"
                ? run.error || "Failed without an error message"
                : previewText(run.outputHtml) || "No output";
            return (
              <Table.Row
                cursor="pointer"
                transitionProperty="background-color"
                transitionDuration="140ms"
                _hover={{ bg: "bg.subtle" }}
                onClick={() => navigate(href)}
              >
                <Table.Cell pr="0" verticalAlign="top">
                  <Box pt="0.5">
                    <RunStatusIcon status={run.status} />
                  </Box>
                </Table.Cell>
                <Table.Cell minW="0">
                  <styled.a
                    href={href}
                    onClick={(event: MouseEvent) => event.stopPropagation()}
                    fontFamily="mono"
                    fontSize="sm"
                    fontWeight="medium"
                    color="fg.default"
                    _hover={{ color: "fg.link" }}
                  >
                    {run.promptTask || "Untitled prompt"}
                  </styled.a>
                  <Text
                    fontSize="xs"
                    color={run.status === "ERROR" ? "red.11" : "fg.muted"}
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {summary()}
                  </Text>
                </Table.Cell>
                <Table.Cell display={{ base: "none", md: "table-cell" }} verticalAlign="top">
                  <Text fontSize="sm" fontFamily="mono" color="fg.muted" truncate>
                    {run.model}
                  </Text>
                </Table.Cell>
                <Table.Cell textAlign="right" verticalAlign="top">
                  <Show when={run.createdAt}>
                    <styled.time
                      datetime={run.createdAt}
                      fontSize="sm"
                      color="fg.muted"
                      whiteSpace="nowrap"
                    >
                      {formatRelativeTimestamp(run.createdAt)}
                    </styled.time>
                  </Show>
                </Table.Cell>
              </Table.Row>
            );
          }}
        </For>
      </Table.Body>
    </Table.Root>
  );
};
