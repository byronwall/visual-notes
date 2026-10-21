import { useAction } from "@solidjs/router";
import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { css } from "styled-system/css";
import { renameResearchTopic, setResearchTopicArchived } from "~/services/research/research.actions";

const iconButtonClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "6",
  h: "6",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "gray.a3", color: "fg.default" },
  "@media (pointer: coarse)": { w: "9", h: "9" },
});

/** The topic's name with rename and archive controls beside it. */
export const TopicTitle = (props: {
  topic: { id: string; title: string; archivedAt: string | null };
  onChanged: () => void;
}) => {
  const runRename = useAction(renameResearchTopic);
  const runArchive = useAction(setResearchTopicArchived);
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const start = () => {
    setDraft(props.topic.title);
    setEditing(true);
  };

  const save = async () => {
    // Enter submits, then the input's blur fires as it unmounts.
    if (busy()) return;
    const title = draft().trim();
    if (!title || title === props.topic.title) return setEditing(false);
    setBusy(true);
    try {
      await runRename({ id: props.topic.id, title });
      setEditing(false);
      props.onChanged();
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async () => {
    setBusy(true);
    try {
      await runArchive({ id: props.topic.id, archived: !props.topic.archivedAt });
      props.onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <span class={css({ display: "inline-flex", alignItems: "center", gap: "1", minW: 0 })}>
      <Show
        when={editing()}
        fallback={
          <>
            <h1 class={css({ fontWeight: "semibold", truncate: true })}>{props.topic.title}</h1>
            <Show when={props.topic.archivedAt}>
              <span class={css({ fontSize: "xs", color: "fg.muted", borderWidth: "1px", borderColor: "border", borderRadius: "l1", px: "1" })}>
                Archived
              </span>
            </Show>
            <button type="button" aria-label="Rename topic" title="Rename topic" class={iconButtonClass} onClick={start}>
              <PencilIcon size={13} />
            </button>
            <button
              type="button"
              aria-label={props.topic.archivedAt ? "Unarchive topic" : "Archive topic"}
              title={props.topic.archivedAt ? "Unarchive topic" : "Archive topic"}
              class={iconButtonClass}
              disabled={busy()}
              onClick={toggleArchive}
            >
              <Show when={props.topic.archivedAt} fallback={<ArchiveIcon size={13} />}>
                <ArchiveRestoreIcon size={13} />
              </Show>
            </button>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <input
            aria-label="Topic title"
            value={draft()}
            disabled={busy()}
            ref={(element) => queueMicrotask(() => element.select())}
            onInput={(event) => setDraft(event.currentTarget.value)}
            onBlur={() => void save()}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditing(false);
            }}
            class={css({
              h: "7",
              w: "64",
              maxW: "full",
              px: "1.5",
              fontSize: "sm",
              fontWeight: "semibold",
              borderWidth: "1px",
              borderColor: "border",
              borderRadius: "l1",
              bg: "bg.default",
              _focusVisible: { outline: "2px solid token(colors.blue.a8)", outlineOffset: "-1px" },
            })}
          />
        </form>
      </Show>
    </span>
  );
};
