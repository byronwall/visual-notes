import { useNavigate } from "@solidjs/router";
import { PencilIcon, Trash2Icon } from "lucide-solid";
import { For, Show } from "solid-js";
import { HStack, Stack, styled } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import * as Table from "~/components/ui/table";
import { Text } from "~/components/ui/text";
import { formatRelativeTimestamp } from "~/features/umap/format";
import type { DashboardPrompt, PromptRunStats } from "./ai-dashboard-model";

type PromptsTableProps = {
  prompts: DashboardPrompt[];
  stats: Map<string, PromptRunStats>;
  onEdit: (prompt: DashboardPrompt) => void;
  onDelete: (prompt: DashboardPrompt) => void;
};

const stop = (event: MouseEvent) => event.stopPropagation();

export const PromptsTable = (props: PromptsTableProps) => {
  const navigate = useNavigate();

  return (
    <Table.Root>
      <Table.Head>
        <Table.Row>
          <Table.Header>Prompt</Table.Header>
          <Table.Header display={{ base: "none", md: "table-cell" }}>Default model</Table.Header>
          <Table.Header textAlign="right">Runs</Table.Header>
          <Table.Header display={{ base: "none", sm: "table-cell" }}>Last run</Table.Header>
          <Table.Header w="20">
            <styled.span srOnly>Actions</styled.span>
          </Table.Header>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <For each={props.prompts}>
          {(prompt) => {
            const stats = () => props.stats.get(prompt.id);
            const href = `/ai/prompts/${prompt.id}`;
            return (
              <Table.Row
                cursor="pointer"
                transitionProperty="background-color"
                transitionDuration="140ms"
                _hover={{ bg: "bg.subtle" }}
                onClick={() => navigate(href)}
              >
                <Table.Cell>
                  <Stack gap="0.5" minW="0">
                    <styled.a
                      href={href}
                      onClick={stop}
                      fontFamily="mono"
                      fontSize="sm"
                      fontWeight="medium"
                      color="fg.default"
                      w="fit-content"
                      _hover={{ color: "grass.11" }}
                    >
                      {prompt.task}
                    </styled.a>
                    <Show when={prompt.description}>
                      {(description) => (
                        <Text fontSize="xs" color="fg.muted" lineClamp="2" maxW="60ch">
                          {description()}
                        </Text>
                      )}
                    </Show>
                  </Stack>
                </Table.Cell>
                <Table.Cell display={{ base: "none", md: "table-cell" }}>
                  <Text fontSize="sm" color="fg.default" fontFamily="mono">
                    {prompt.defaultModel}
                  </Text>
                  <Text fontSize="xs" color="fg.subtle">
                    temp {prompt.defaultTemp}
                    {typeof prompt.defaultTopP === "number" ? ` · top_p ${prompt.defaultTopP}` : ""}
                  </Text>
                </Table.Cell>
                <Table.Cell textAlign="right" fontVariantNumeric="tabular-nums">
                  <Text fontSize="sm">{stats()?.count ?? 0}</Text>
                  <Show when={(stats()?.failed ?? 0) > 0}>
                    <Text fontSize="xs" color="red.11">
                      {stats()?.failed} failed
                    </Text>
                  </Show>
                </Table.Cell>
                <Table.Cell display={{ base: "none", sm: "table-cell" }}>
                  <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">
                    {stats()?.lastRunAt ? formatRelativeTimestamp(stats()!.lastRunAt!) : "Never"}
                  </Text>
                </Table.Cell>
                <Table.Cell textAlign="right">
                  <HStack gap="0.5" justify="flex-end">
                    <IconButton
                      size="xs"
                      variant="plain"
                      color="fg.muted"
                      _hover={{ color: "fg.default", bg: "bg.muted" }}
                      aria-label={`Rename ${prompt.task}`}
                      title="Rename"
                      onClick={(event: MouseEvent) => {
                        stop(event);
                        props.onEdit(prompt);
                      }}
                    >
                      <PencilIcon size={14} />
                    </IconButton>
                    <IconButton
                      size="xs"
                      variant="plain"
                      color="fg.muted"
                      _hover={{ color: "red.11", bg: "red.subtle.bg" }}
                      aria-label={`Delete ${prompt.task}`}
                      title="Delete"
                      onClick={(event: MouseEvent) => {
                        stop(event);
                        props.onDelete(prompt);
                      }}
                    >
                      <Trash2Icon size={14} />
                    </IconButton>
                  </HStack>
                </Table.Cell>
              </Table.Row>
            );
          }}
        </For>
      </Table.Body>
    </Table.Root>
  );
};
