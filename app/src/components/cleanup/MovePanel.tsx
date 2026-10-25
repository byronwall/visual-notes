import { useAction } from "@solidjs/router";
import { Show, createSignal, type VoidComponent } from "solid-js";
import { Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import type { Placement } from "~/server/cleanup/regroup";
import { applyMoveAction } from "~/services/cleanup/cleanup.actions";
import { CleanupActionBar } from "./CleanupActionBar";
import { PanelSection } from "./PanelSection";

/** File an unfiled note into the path or collection it belongs in. */
export const MovePanel: VoidComponent<{
  docId: string;
  placement: Placement;
  onDone: () => void;
  onKeep: () => void;
  onSkip: () => void;
}> = (props) => {
  const move = useAction(applyMoveAction);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const kindLabel = () =>
    props.placement.kind === "path" ? "path" : "collection";

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      await move({ docId: props.docId, placement: props.placement });
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="4" flex="1" minH="0">
      <PanelSection title="Move to">
        <Stack gap="1" data-testid="move-target">
          <Text fontSize="md" fontWeight="medium">
            {props.placement.label}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            The note stays as it is; it is filed under this {kindLabel()} so it
            shows up with the related notes. Nothing is archived.
          </Text>
        </Stack>
      </PanelSection>
      <Show when={error()}>
        {(message) => (
          <Text fontSize="sm" color="fg.error">
            {message()}
          </Text>
        )}
      </Show>
      <CleanupActionBar
        primaryLabel={`Move to ${props.placement.label}`}
        onPrimary={approve}
        busy={busy()}
        onKeep={props.onKeep}
        onSkip={props.onSkip}
      />
    </Stack>
  );
};
