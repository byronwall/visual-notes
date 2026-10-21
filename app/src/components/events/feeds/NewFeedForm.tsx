import { useAction } from "@solidjs/router";
import { PlusIcon } from "lucide-solid";
import { createSignal } from "solid-js";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { createCalendarFeed } from "~/services/events/feeds.actions";
import { useFeedsRefresh } from "./feedsRefresh";

/** Name-only create; the rule is set on the new feed's card. */
export function NewFeedForm() {
  const refresh = useFeedsRefresh();
  const runCreate = useAction(createCalendarFeed);
  const [name, setName] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const value = name().trim();
    if (!value || busy()) return;
    setBusy(true);
    try {
      await runCreate({ name: value });
      setName("");
      refresh.bump();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <HStack gap="2">
        <Input
          size="sm"
          w={{ base: "full", sm: "56" }}
          placeholder="New feed name"
          aria-label="New feed name"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <Button
          type="submit"
          size="sm"
          loading={busy()}
          disabled={!name().trim()}
        >
          <PlusIcon />
          Add feed
        </Button>
      </HStack>
    </form>
  );
}
