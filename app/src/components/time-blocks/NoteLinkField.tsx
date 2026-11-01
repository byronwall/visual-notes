import {
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { FileTextIcon, LinkIcon, XIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { fetchDocs, searchDocs } from "~/features/docs-index/data/docs.service";
import { onDemand } from "~/utils/kept-async";

export type LinkedNote = { id: string; title: string };

type Props = {
  value: LinkedNote | null;
  onChange: (note: LinkedNote | null) => void;
};

const option = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "0",
  w: "full",
  px: "2",
  py: "1.5",
  borderRadius: "sm",
  textAlign: "left",
  cursor: "pointer",
  "&[data-active]": { bg: "bg.muted" },
});

const mono = css({
  fontFamily: "mono",
  fontSize: "xs",
  color: "fg.muted",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxW: "full",
});

/** Linked note for a block: shows the link, or searches notes to add one. */
export const NoteLinkField = (props: Props) => {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [debounced, setDebounced] = createSignal("");
  const [active, setActive] = createSignal(0);
  let timer: number | undefined;
  onCleanup(() => window.clearTimeout(timer));

  const [results] = createResource(
    () => (open() ? { q: debounced().trim() } : false),
    async ({ q }) => {
      const docs = q
        ? await searchDocs({ q, take: 8 })
        : await fetchDocs({ take: 8, sortMode: "recent_activity" });
      return (docs ?? []).map((doc) => ({
        id: doc.id,
        title: doc.title || "Untitled",
        path: doc.path ?? null,
      }));
    },
    onDemand,
  );
  const items = createMemo(() => results.latest ?? []);

  const choose = (note: LinkedNote) => {
    props.onChange(note);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const count = items().length;
    if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      setActive((index) => (index + 1) % count);
    } else if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      setActive((index) => (index - 1 + count) % count);
    } else if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const item = items()[active()];
      if (item) choose(item);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <HStack gap="1" minW="0" h="9">
      <Show when={props.value}>
        {(note) => (
          <HStack gap="1.5" minW="0" flex="1">
            <FileTextIcon size={14} />
            <a
              href={`/docs/${note().id}`}
              target="_blank"
              rel="noreferrer"
              class={css({
                fontSize: "sm",
                color: "fg.default",
                truncate: true,
                _hover: { textDecoration: "underline" },
              })}
            >
              {note().title}
            </a>
            <IconButton
              size="2xs"
              variant="plain"
              aria-label="Unlink note"
              title="Unlink note"
              onClick={() => props.onChange(null)}
            >
              <XIcon />
            </IconButton>
          </HStack>
        )}
      </Show>
      <Show
        when={open()}
        fallback={
          <Button
            size="xs"
            variant="plain"
            onClick={() => {
              setQuery("");
              setDebounced("");
              setActive(0);
              setOpen(true);
            }}
          >
            <LinkIcon />
            {props.value ? "Change" : "Link a note"}
          </Button>
        }
      >
        {/* Rendered inside the dialog: a portalled popover would sit
            outside the dialog's focus trap and be hidden from it. */}
        <Box position="relative" flex="1" minW="0" maxW="80" data-note-search>
          <Input
            ref={(el) => requestAnimationFrame(() => el.focus())}
            size="sm"
            placeholder="Search notes"
            aria-label="Search notes"
            role="combobox"
            aria-expanded="true"
            aria-controls="tb-note-options"
            value={query()}
            onInput={(event) => {
              const next = event.currentTarget.value;
              setQuery(next);
              setActive(0);
              window.clearTimeout(timer);
              timer = window.setTimeout(() => setDebounced(next), 180);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setOpen(false)}
          />
          <Box
            id="tb-note-options"
            role="listbox"
            aria-label="Notes"
            position="absolute"
            top="calc(100% + 4px)"
            left="0"
            w="80"
            maxW="calc(100vw - 64px)"
            maxH="64"
            overflowY="auto"
            p="1"
            zIndex="popover"
            bg="bg.default"
            borderRadius="md"
            boxShadow="lg"
            borderWidth="1px"
            borderColor="border"
          >
            <Show
              when={items().length > 0}
              fallback={
                <Text fontSize="sm" color="fg.muted" px="2" py="2">
                  {results.loading ? "Searching…" : "No matching notes"}
                </Text>
              }
            >
              <For each={items()}>
                {(item, index) => (
                  <button
                    type="button"
                    role="option"
                    tabIndex={-1}
                    class={option}
                    aria-selected={index() === active()}
                    data-active={index() === active() ? "" : undefined}
                    onPointerEnter={() => setActive(index())}
                    // Keep focus in the input so blur doesn't close first.
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => choose(item)}
                  >
                    <Text as="span" fontSize="sm" maxW="full" truncate>
                      {item.title}
                    </Text>
                    <Show when={item.path}>
                      <span class={mono}>{item.path}</span>
                    </Show>
                  </button>
                )}
              </For>
            </Show>
          </Box>
        </Box>
      </Show>
    </HStack>
  );
};
