import {
  For,
  Show,
  createMemo,
  createSignal,
  type VoidComponent,
} from "solid-js";
import Modal from "~/components/Modal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { SimpleSelectItem } from "~/components/ui/simple-select";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Text } from "~/components/ui/text";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";

export type BulkMetaAction =
  | { type: "add"; key: string; value: string | number | boolean | null }
  | { type: "update"; key: string; value: string | number | boolean | null }
  | { type: "remove"; key: string };

const actionItems: SimpleSelectItem[] = [
  { label: "Add key if missing", value: "add" },
  { label: "Update key value", value: "update" },
  { label: "Remove key", value: "remove" },
];

const valueTypeItems: SimpleSelectItem[] = [
  { label: "string", value: "string" },
  { label: "number", value: "number" },
  { label: "boolean (true/false)", value: "boolean" },
  { label: "null", value: "null" },
];

export const BulkMetaModal: VoidComponent<{
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onApply: (actions: BulkMetaAction[]) => Promise<void>;
}> = (props) => {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [actions, setActions] = createSignal<BulkMetaAction[]>([]);

  const [draftType, setDraftType] = createSignal<"add" | "update" | "remove">(
    "add"
  );
  const [draftKey, setDraftKey] = createSignal("");
  const [draftValueType, setDraftValueType] = createSignal<
    "string" | "number" | "boolean" | "null"
  >("string");
  const [draftValueRaw, setDraftValueRaw] = createSignal("");

  const canAdd = createMemo(() => {
    const t = draftType();
    const k = draftKey().trim();
    if (!k) return false;
    if (t === "remove") return true;
    // add/update require a value
    if (draftValueType() === "null") return true;
    return draftValueRaw().trim().length > 0;
  });

  const parseDraftValue = (): string | number | boolean | null => {
    const vt = draftValueType();
    if (vt === "null") return null;
    if (vt === "boolean") return /^true$/i.test(draftValueRaw().trim());
    if (vt === "number") {
      const n = Number(draftValueRaw());
      return Number.isFinite(n) ? n : 0;
    }
    return draftValueRaw();
  };

  const handleAddAction = () => {
    if (!canAdd()) return;
    const k = draftKey().trim();
    const t = draftType();
    if (t === "remove") {
      setActions((prev) => [...prev, { type: "remove", key: k }]);
    } else {
      const v = parseDraftValue();
      setActions((prev) => [
        ...prev,
        { type: t, key: k, value: v } as BulkMetaAction,
      ]);
    }
    setDraftKey("");
    setDraftValueRaw("");
  };

  const makeRemoveAt = (i: number) => () => {
    setActions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleDraftTypeChange = (value: string) => {
    if (value === "add" || value === "update" || value === "remove") {
      setDraftType(value);
      return;
    }
    setDraftType("add");
  };

  const handleDraftValueTypeChange = (value: string) => {
    if (
      value === "string" ||
      value === "number" ||
      value === "boolean" ||
      value === "null"
    ) {
      setDraftValueType(value);
      return;
    }
    setDraftValueType("string");
  };

  const handleApply = async () => {
    if (busy() || actions().length === 0) return;
    setBusy(true);
    setError(undefined);
    try {
      await props.onApply(actions());
      setActions([]);
      props.onClose();
    } catch (e) {
      setError((e as Error).message || "Failed to apply metadata");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy()) return;
    setActions([]);
    props.onClose();
  };

  return (
    <Modal open={props.open} onClose={handleClose}>
      <Stack p="1rem" gap="0.75rem">
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontSize="sm" fontWeight="semibold">
            Bulk edit metadata
          </Text>
          <Text fontSize="xs" color="black.a7">
            Selected: {props.selectedCount}
          </Text>
        </HStack>

        <Show when={!!error()}>
          <Text fontSize="xs" color="red.11">
            {error()}
          </Text>
        </Show>

        <Grid
          gridTemplateColumns={{
            base: "1fr",
            md: "repeat(5, minmax(0, 1fr))",
          }}
          gap="0.5rem"
          alignItems="end"
        >
          <Box>
            <SimpleSelect
              items={actionItems}
              value={draftType()}
              onChange={handleDraftTypeChange}
              label="Action"
              labelProps={{
                fontSize: "xs",
                color: "black.a7",
                fontWeight: "normal",
              }}
              size="sm"
              sameWidth
            />
          </Box>
          <Box gridColumn={{ base: "span 1", md: "span 2" }}>
            <Text fontSize="xs" color="black.a7" mb="0.25rem">
              Key
            </Text>
            <Input
              size="sm"
              placeholder="e.g. tag or has_relative_image"
              value={draftKey()}
              onInput={(e) => setDraftKey(e.currentTarget.value)}
            />
          </Box>
          <Show when={draftType() !== "remove"}>
            <Box>
              <SimpleSelect
                items={valueTypeItems}
                value={draftValueType()}
                onChange={handleDraftValueTypeChange}
                label="Value type"
                labelProps={{
                  fontSize: "xs",
                  color: "black.a7",
                  fontWeight: "normal",
                }}
                size="sm"
                sameWidth
              />
            </Box>
            <Show when={draftValueType() !== "null"}>
              <Box>
                <Text fontSize="xs" color="black.a7" mb="0.25rem">
                  Value
                </Text>
                <Input
                  size="sm"
                  placeholder="value"
                  value={draftValueRaw()}
                  onInput={(e) => setDraftValueRaw(e.currentTarget.value)}
                />
              </Box>
            </Show>
          </Show>
          <Box>
            <Button
              width="100%"
              size="sm"
              colorPalette="grass"
              disabled={!canAdd() || busy()}
              onClick={handleAddAction}
            >
              Add to list
            </Button>
          </Box>
        </Grid>

        <Box
          borderTopWidth="1px"
          borderColor="gray.outline.border"
          pt="0.75rem"
        >
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="black.a7"
            mb="0.5rem"
          >
            Pending actions
          </Text>
          <Show
            when={actions().length > 0}
            fallback={
              <Text fontSize="xs" color="black.a7">
                No actions added.
              </Text>
            }
          >
            <Stack gap="0.5rem">
              <For each={actions()}>
                {(a, i) => (
                  <HStack
                    justifyContent="space-between"
                    borderWidth="1px"
                    borderColor="gray.outline.border"
                    borderRadius="l2"
                    px="0.5rem"
                    py="0.25rem"
                    fontSize="sm"
                  >
                    <Box
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      <Show when={a.type === "remove"}>
                        <Text as="span" fontWeight="semibold">
                          remove
                        </Text>{" "}
                        <Text as="code" fontSize="xs">
                          {a.key}
                        </Text>
                      </Show>
                      <Show when={a.type !== "remove"}>
                        <Text as="span" fontWeight="semibold">
                          {(a as any).type}
                        </Text>{" "}
                        <Text as="code" fontSize="xs">
                          {a.key}
                        </Text>{" "}
                        →{" "}
                        <Text as="code" fontSize="xs">
                          {String((a as any).value)}
                        </Text>
                      </Show>
                    </Box>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={makeRemoveAt(i())}
                    >
                      Remove
                    </Button>
                  </HStack>
                )}
              </For>
            </Stack>
          </Show>
        </Box>

        <HStack justifyContent="flex-end" gap="0.5rem">
          <Button size="sm" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            colorPalette="green"
            disabled={busy() || actions().length === 0}
            onClick={handleApply}
          >
            Apply to {props.selectedCount} items
          </Button>
        </HStack>
      </Stack>
    </Modal>
  );
};
