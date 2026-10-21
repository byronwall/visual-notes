import { Show, createEffect, createSignal, type VoidComponent } from "solid-js";
import { createStore } from "solid-js/store";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import type { OccurrenceInput } from "~/lib/events/schemas";
import {
  draftError,
  draftToInput,
  emptyShowDraft,
  type ShowDraft,
} from "./show-draft";
import { ShowFields } from "./ShowFields";

/** Add or edit one show. `initial` seeds the form each time it opens. */
export const ShowEditorDialog: VoidComponent<{
  open: boolean;
  title: string;
  submitLabel: string;
  initial: ShowDraft | null;
  onClose: () => void;
  onSubmit: (input: OccurrenceInput) => Promise<boolean>;
}> = (props) => {
  const [draft, setDraft] = createStore<ShowDraft>(emptyShowDraft());
  const [busy, setBusy] = createSignal(false);
  const [touched, setTouched] = createSignal(false);

  createEffect(() => {
    if (props.open && props.initial) {
      setDraft({ ...props.initial });
      setTouched(false);
    }
  });

  const error = () => draftError(draft);

  const submit = async (e?: Event) => {
    e?.preventDefault();
    setTouched(true);
    if (error() || busy()) return;
    setBusy(true);
    const ok = await props.onSubmit(draftToInput(draft));
    setBusy(false);
    if (ok) props.onClose();
  };

  return (
    <SimpleDialog
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      maxW="480px"
      phoneSheet
      closeOnInteractOutside={false}
      footer={
        <HStack justify="space-between" gap="2" w="full">
          <Text textStyle="xs" color="red.fg">
            <Show when={touched()}>{error()}</Show>
          </Text>
          <HStack gap="2">
            <Button size="sm" variant="outline" onClick={props.onClose}>
              Cancel
            </Button>
            <Button size="sm" loading={busy()} onClick={() => void submit()}>
              {props.submitLabel}
            </Button>
          </HStack>
        </HStack>
      }
    >
      <form onSubmit={(e) => void submit(e)}>
        <ShowFields draft={draft} setDraft={setDraft} />
        {/* Enter in any field submits. */}
        <button type="submit" hidden />
      </form>
    </SimpleDialog>
  );
};
