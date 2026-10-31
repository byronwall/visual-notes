import { createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { css } from "styled-system/css";
import { Stack } from "styled-system/jsx";
import { FilePlusIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { fetchDocs, searchDocs } from "~/features/docs-index/data/docs.service";
import { keepOnFailedRead } from "~/utils/kept-async";

const option = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  w: "full",
  px: "2",
  py: "1.5",
  borderRadius: "sm",
  textAlign: "left",
  cursor: "pointer",
  _hover: { bg: "bg.muted" },
  _disabled: { opacity: 0.5, cursor: "default" },
});

const mono = css({
  fontFamily: "mono",
  fontSize: "xs",
  color: "fg.muted",
  maxW: "full",
  truncate: true,
});

/** Picks where a recording goes: a new note, or an existing one. */
export const MoveRecordingDialog = (props: {
  open: boolean;
  docId: string;
  label: string;
  onClose: () => void;
  /** Target note id, or null for a new note. */
  onMove: (toDocId: string | null) => Promise<void>;
}) => {
  const [query, setQuery] = createSignal("");
  const [debounced, setDebounced] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let timer: number | undefined;
  onCleanup(() => window.clearTimeout(timer));

  const [results] = createResource(
    () =>
      props.open ? { q: debounced().trim(), docId: props.docId } : false,
    ({ q, docId }) =>
      keepOnFailedRead(undefined, async () => {
        const docs = q
          ? await searchDocs({ q, take: 9 })
          : await fetchDocs({ take: 9, sortMode: "recent_activity" });
        return (docs ?? []).filter((doc) => doc.id !== docId).slice(0, 8);
      }),
  );

  const move = async (toDocId: string | null) => {
    setBusy(true);
    setError(undefined);
    try {
      await props.onMove(toDocId);
    } catch (err) {
      console.warn("[doc-audio] move failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SimpleDialog
      open={props.open}
      onClose={props.onClose}
      title="Move recording"
      description={`Move “${props.label}” and its transcript to another note.`}
      maxW="md"
    >
      <Stack gap="3">
        <Button
          variant="outline"
          disabled={busy()}
          onClick={() => void move(null)}
        >
          <FilePlusIcon />
          Move to a new note
        </Button>
        <Input
          size="sm"
          w="full"
          placeholder="Search for a note"
          aria-label="Search for a note"
          value={query()}
          onInput={(event) => {
            const next = event.currentTarget.value;
            setQuery(next);
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setDebounced(next), 180);
          }}
        />
        <Stack gap="0" minH="48" maxH="72" overflowY="auto" role="list">
          <Show
            when={(results.latest ?? []).length > 0}
            fallback={
              <Text fontSize="sm" color="fg.muted" px="2" py="2">
                {results.loading ? "Searching…" : "No matching notes"}
              </Text>
            }
          >
            <For each={results.latest}>
              {(doc) => (
                <button
                  type="button"
                  class={option}
                  disabled={busy()}
                  onClick={() => void move(doc.id)}
                >
                  <Text as="span" fontSize="sm" maxW="full" truncate>
                    {doc.title || "Untitled"}
                  </Text>
                  <Show when={doc.path}>
                    <span class={mono}>{doc.path}</span>
                  </Show>
                </button>
              )}
            </For>
          </Show>
        </Stack>
        <Show when={error()}>
          {(message) => (
            <Text fontSize="sm" color="red.11" role="alert">
              {message()}
            </Text>
          )}
        </Show>
      </Stack>
    </SimpleDialog>
  );
};
