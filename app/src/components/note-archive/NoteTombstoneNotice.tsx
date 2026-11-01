import { A, useNavigate } from "@solidjs/router";
import { createKeptAsync } from "~/utils/kept-async";
import { Show, createEffect, type VoidComponent } from "solid-js";
import { Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import { fetchNoteTombstone } from "~/services/note-archive/note-archive.queries";
import { shortDate } from "./archive-format";

/**
 * For a note id that no longer exists: when the archive deleted it, follow it
 * to where its content went, or say when it was deleted. Renders nothing for
 * an id that never existed, so the caller's not-found message stands.
 */
export const NoteTombstoneNotice: VoidComponent<{ id: string }> = (props) => {
  const navigate = useNavigate();
  const tombstone = createKeptAsync(() => fetchNoteTombstone(props.id));
  createEffect(() => {
    const target = tombstone.latest?.redirect;
    if (target) navigate(`/docs/${target.id}`, { replace: true });
  });

  return (
    <Show when={tombstone.latest}>
      {(t) => (
        <Stack gap="1" data-testid="note-tombstone">
          <Text fontSize="sm" color="fg.muted">
            “{t().title}” was archived and then deleted on{" "}
            {shortDate(t().deletedAt)}.
          </Text>
          <Show when={t().redirect}>
            {(target) => (
              <Text fontSize="sm">
                Its content is in{" "}
                <A href={`/docs/${target().id}`}>{target().title}</A>.
              </Text>
            )}
          </Show>
        </Stack>
      )}
    </Show>
  );
};
