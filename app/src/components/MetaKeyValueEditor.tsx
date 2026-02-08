import {
  For,
  Show,
  Suspense,
  createEffect,
  createSignal,
  onCleanup,
} from "solid-js";
import type { VoidComponent } from "solid-js";
import { useAction } from "@solidjs/router";
import { updateDoc, type MetaRecord } from "~/services/docs.service";
import { MetaKeySuggestions } from "./MetaKeySuggestions";
import { MetaValueSuggestions } from "./MetaValueSuggestions";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";
import { SimplePopover } from "~/components/ui/simple-popover";

type Entry = { key: string; value: string };

export const MetaKeyValueEditor: VoidComponent<{
  docId?: string;
  initialMeta?: MetaRecord | null;
  onChange?: (meta: MetaRecord) => void;
}> = (props) => {
  const initialEntries: Entry[] = Object.entries(props.initialMeta || {}).map(
    ([k, v]) => ({ key: k, value: String(v) })
  );
  const [entries, setEntries] = createSignal<Entry[]>(initialEntries);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [isOpen, setIsOpen] = createSignal(false);
  const [editingIndex, setEditingIndex] = createSignal<number | null>(null);
  const [editKey, setEditKey] = createSignal("");
  const [editValue, setEditValue] = createSignal("");
  const runUpdateDoc = useAction(updateDoc);

  // suggestions now handled in child components

  const openForNew = () => {
    console.log("[MetaEditor] open add");
    setEditingIndex(null);
    setEditKey("");
    setEditValue("");
    setIsOpen(true);
  };

  const makeOpenForEdit = (i: number) => () => {
    const e = entries()[i];
    console.log("[MetaEditor] open edit", i, e);
    setEditingIndex(i);
    setEditKey(e?.key || "");
    setEditValue(e?.value || "");
    setIsOpen(true);
  };

  const closePopup = () => setIsOpen(false);

  const persistIfNeeded = async (next: Entry[]) => {
    const record: MetaRecord = {};
    for (const { key, value } of next) {
      const k = key.trim();
      if (!k) continue;
      record[k] = value;
    }

    if (props.docId) {
      setBusy(true);
      setError(undefined);
      try {
        console.log("[MetaEditor] persist", record);
        await runUpdateDoc({ id: props.docId, meta: record });
        if (props.onChange) props.onChange(record);
      } catch (e) {
        setError((e as Error).message || "Failed to save metadata");
      } finally {
        setBusy(false);
      }
    } else if (props.onChange) {
      props.onChange(record);
    }
  };

  const handleSave = async () => {
    const idx = editingIndex();
    const next = entries().slice();
    const newEntry: Entry = { key: editKey(), value: editValue() };
    if (idx === null) {
      next.push(newEntry);
    } else {
      next[idx] = newEntry;
    }
    setEntries(next);
    await persistIfNeeded(next);
    setIsOpen(false);
  };

  const makeRemoveHandler = (i: number) => async (e: MouseEvent) => {
    e.stopPropagation();
    const next = entries().slice();
    next.splice(i, 1);
    setEntries(next);
    await persistIfNeeded(next);
  };

  const onKeydown = (ev: KeyboardEvent) => {
    if (!isOpen()) return;
    if (ev.key === "Escape") setIsOpen(false);
  };
  createEffect(() => {
    window.addEventListener("keydown", onKeydown);
    onCleanup(() => window.removeEventListener("keydown", onKeydown));
  });

  const handleFieldKeyDown = async (ev: KeyboardEvent) => {
    if (ev.key !== "Enter") return;
    const k = editKey().trim();
    const v = editValue().trim();
    if (!k || !v || busy()) return;
    console.log("[MetaEditor] enter-to-save", { k, v });
    await handleSave();
  };

  return (
    <Box>
      <SimplePopover
        open={isOpen()}
        onClose={closePopup}
        placement="bottom-start"
        offset={8}
        style={{ width: "90%", "max-width": "28rem" }}
        anchor={
          <HStack gap="2" flexWrap="wrap">
            <For each={entries()}>
              {(e, i) => (
                <Button
                  size="xs"
                  variant="outline"
                  colorPalette="gray"
                  borderRadius="full"
                  px="2"
                  py="1"
                  fontSize="xs"
                  bg="bg.default"
                  _hover={{ bg: "gray.surface.bg.hover" }}
                  title={`${e.key}: ${e.value}`}
                  onClick={makeOpenForEdit(i())}
                >
                  <Text as="span" fontSize="xs" fontWeight="medium" truncate>
                    {e.key}
                  </Text>
                  <Text as="span" fontSize="xs" color="fg.muted">
                    :
                  </Text>
                  <Text as="span" fontSize="xs" truncate>
                    {e.value}
                  </Text>
                  <Box
                    as="span"
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    borderWidth="1px"
                    borderColor="gray.outline.border"
                    borderRadius="full"
                    px="1"
                    ml="1"
                    fontSize="xs"
                    color="fg.muted"
                    _hover={{ bg: "gray.surface.bg.hover" }}
                    onClick={makeRemoveHandler(i())}
                    aria-label="Remove"
                  >
                    ×
                  </Box>
                </Button>
              )}
            </For>
            <Button
              size="xs"
              variant="outline"
              colorPalette="gray"
              borderRadius="full"
              onClick={openForNew}
              aria-label="Add metadata"
              title="Add metadata"
            >
              + Add
            </Button>
          </HStack>
        }
      >
        <Stack gap="2.5" p="4">
          <Text fontSize="sm" fontWeight="medium">
            Edit metadata
          </Text>
          <HStack gap="2" alignItems="flex-start">
            <Stack gap="1">
              <Input
                size="sm"
                w="10rem"
                placeholder="key"
                value={editKey()}
                onInput={(evt) => setEditKey(evt.currentTarget.value)}
                onKeyDown={handleFieldKeyDown}
                autocomplete="off"
                autocapitalize="none"
                autocorrect="off"
                spellcheck={false}
              />
              <Suspense fallback={null}>
                <MetaKeySuggestions onSelect={(k) => setEditKey(k)} />
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
                onInput={(evt) => setEditValue(evt.currentTarget.value)}
                onKeyDown={handleFieldKeyDown}
                autocomplete="off"
                autocapitalize="none"
                autocorrect="off"
                spellcheck={false}
              />
              <Suspense fallback={null}>
                <MetaValueSuggestions
                  keyName={editKey()}
                  onSelect={(v) => setEditValue(v)}
                />
              </Suspense>
            </Stack>
          </HStack>

          <HStack gap="2" justifyContent="flex-end">
            <Button
              size="sm"
              variant="outline"
              colorPalette="gray"
              onClick={closePopup}
              type="button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              type="button"
              disabled={busy()}
            >
              {busy() ? "Saving…" : "Save"}
            </Button>
          </HStack>
        </Stack>
      </SimplePopover>

      <Show when={error()}>
        {(e) => (
          <Text fontSize="xs" color="red.11" mt="1">
            {e()}
          </Text>
        )}
      </Show>
    </Box>
  );
};
