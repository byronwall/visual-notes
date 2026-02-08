import { For, Show, Suspense, createEffect, createSignal } from "solid-js";
import type { VoidComponent } from "solid-js";
import { useAction } from "@solidjs/router";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { updateDoc, type MetaRecord } from "~/services/docs.service";
import { MetaKeySuggestions } from "./MetaKeySuggestions";
import { MetaValueSuggestions } from "./MetaValueSuggestions";

type Entry = { key: string; value: string };

const entriesFromMeta = (meta?: MetaRecord | null): Entry[] =>
  Object.entries(meta || {}).map(([key, value]) => ({ key, value: String(value) }));

const recordFromEntries = (entries: Entry[]): MetaRecord => {
  const record: MetaRecord = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) continue;
    record[key] = entry.value;
  }
  return record;
};

export const MetaKeyValueEditor: VoidComponent<{
  docId?: string;
  initialMeta?: MetaRecord | null;
  onChange?: (meta: MetaRecord) => void;
}> = (props) => {
  const [entries, setEntries] = createSignal<Entry[]>(entriesFromMeta(props.initialMeta));
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [editingIndex, setEditingIndex] = createSignal<number | null>(null);
  const [isEditing, setIsEditing] = createSignal(false);
  const [editKey, setEditKey] = createSignal("");
  const [editValue, setEditValue] = createSignal("");
  const runUpdateDoc = useAction(updateDoc);

  let prevIncomingMeta = JSON.stringify(props.initialMeta || {});

  createEffect(() => {
    const incomingSerialized = JSON.stringify(props.initialMeta || {});
    if (incomingSerialized === prevIncomingMeta) return;
    prevIncomingMeta = incomingSerialized;
    setEntries(entriesFromMeta(props.initialMeta));
  });

  const persistIfNeeded = async (nextEntries: Entry[]) => {
    const record = recordFromEntries(nextEntries);

    if (props.docId) {
      setBusy(true);
      setError(undefined);
      try {
        await runUpdateDoc({ id: props.docId, meta: record });
        if (props.onChange) props.onChange(record);
      } catch (e) {
        setError((e as Error).message || "Failed to save metadata");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (props.onChange) props.onChange(record);
  };

  const resetEditorFields = () => {
    setEditingIndex(null);
    setEditKey("");
    setEditValue("");
    setIsEditing(false);
  };

  const openForNew = () => {
    setEditingIndex(null);
    setEditKey("");
    setEditValue("");
    setIsEditing(true);
  };

  const openForEdit = (index: number) => () => {
    const entry = entries()[index];
    setEditingIndex(index);
    setEditKey(entry?.key || "");
    setEditValue(entry?.value || "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    const key = editKey().trim();
    if (!key || busy()) return;

    const next = entries().slice();
    const nextEntry: Entry = { key, value: editValue() };
    const index = editingIndex();

    if (index === null) {
      next.push(nextEntry);
    } else {
      next[index] = nextEntry;
    }

    setEntries(next);
    await persistIfNeeded(next);
    resetEditorFields();
  };

  const removeAt = (index: number) => async () => {
    const next = entries().slice();
    next.splice(index, 1);
    setEntries(next);
    await persistIfNeeded(next);
  };

  const makeRemoveHandler = (index: number) => () => {
    void removeAt(index)();
  };

  const handleFieldKeyDown = async (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      resetEditorFields();
      return;
    }
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    await handleSave();
  };

  return (
    <Stack gap="2">
      <HStack gap="2" flexWrap="wrap">
        <For each={entries()}>
          {(entry, index) => (
            <HStack
              borderWidth="1px"
              borderColor="gray.outline.border"
              borderRadius="full"
              px="2"
              py="1"
              gap="1"
              bg="bg.default"
            >
              <Button
                size="xs"
                variant="plain"
                colorPalette="gray"
                px="0"
                onClick={openForEdit(index())}
                type="button"
                title={`${entry.key}: ${entry.value}`}
              >
                <Text as="span" fontSize="xs" fontWeight="medium" maxW="14rem" truncate>
                  {entry.key}
                </Text>
                <Text as="span" fontSize="xs" color="fg.muted">
                  :
                </Text>
                <Text as="span" fontSize="xs" maxW="14rem" truncate>
                  {entry.value}
                </Text>
              </Button>
              <Button
                size="xs"
                variant="plain"
                colorPalette="gray"
                px="0.5"
                onClick={makeRemoveHandler(index())}
                type="button"
                aria-label={`Remove ${entry.key}`}
                title="Remove"
              >
                ×
              </Button>
            </HStack>
          )}
        </For>

        <Button
          size="xs"
          variant="outline"
          colorPalette="gray"
          borderRadius="full"
          onClick={openForNew}
          type="button"
        >
          + Add
        </Button>
      </HStack>

      <Show when={isEditing()}>
        <Box borderWidth="1px" borderColor="gray.outline.border" borderRadius="l2" p="2.5">
          <Stack gap="2">
            <HStack gap="2" alignItems="flex-start">
              <Stack gap="1" flex="1">
                <Input
                  size="sm"
                  placeholder="key"
                  value={editKey()}
                  onInput={(e) => setEditKey(e.currentTarget.value)}
                  onKeyDown={handleFieldKeyDown}
                  autocomplete="off"
                  autocapitalize="none"
                  autocorrect="off"
                  spellcheck={false}
                />
                <Suspense fallback={null}>
                  <MetaKeySuggestions onSelect={(key) => setEditKey(key)} />
                </Suspense>
              </Stack>

              <Text fontSize="sm" color="fg.muted" mt="2">
                :
              </Text>

              <Stack gap="1" flex="1">
                <Input
                  size="sm"
                  placeholder="value"
                  value={editValue()}
                  onInput={(e) => setEditValue(e.currentTarget.value)}
                  onKeyDown={handleFieldKeyDown}
                  autocomplete="off"
                  autocapitalize="none"
                  autocorrect="off"
                  spellcheck={false}
                />
                <Suspense fallback={null}>
                  <MetaValueSuggestions
                    keyName={editKey()}
                    onSelect={(value) => setEditValue(value)}
                  />
                </Suspense>
              </Stack>
            </HStack>

            <HStack justifyContent="flex-end" gap="2">
              <Button
                size="sm"
                variant="outline"
                colorPalette="gray"
                onClick={resetEditorFields}
                type="button"
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleSave()} type="button" disabled={busy()}>
                {busy() ? "Saving…" : "Save"}
              </Button>
            </HStack>
          </Stack>
        </Box>
      </Show>

      <Show when={error()}>
        {(e) => (
          <Text fontSize="xs" color="red.11">
            {e()}
          </Text>
        )}
      </Show>
    </Stack>
  );
};
