import { useAction } from "@solidjs/router";
import { ExternalLinkIcon } from "lucide-solid";
import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createSignal,
  on,
  onMount,
  type VoidComponent,
} from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Link } from "~/components/ui/link";
import { Skeleton } from "~/components/ui/skeleton";
import { Text } from "~/components/ui/text";
import type { CleanupItemDetail } from "~/server/cleanup/queue";
import type { LinkExpansion } from "~/server/cleanup/link-expand";
import {
  addLinkSummaryAction,
  archiveOnlyAction,
  expandLinkForNote,
  remindLinkAction,
} from "~/services/cleanup/cleanup.actions";
import { CleanupActionBar, paidLabel } from "./CleanupActionBar";
import { DraftPreview } from "./DraftPreview";
import { PanelSection } from "./PanelSection";

type Primary = "summarize" | "summary" | "remind" | "archive";

const statusLine = (x: LinkExpansion) => {
  const code = x.httpStatus ? ` (${x.httpStatus})` : "";
  if (x.status === "dead") return `The link no longer loads${code}.`;
  if (x.status === "blocked") {
    return `The site refused the check${code}. Open it yourself to see it.`;
  }
  if (!x.readable) return "The page loads, but has little readable text.";
  return null;
};

/**
 * A saved link: load the page again (free), summarize it (on request when
 * that costs money), and choose. Add the summary to the note, get an Inbox
 * reminder to go look, or archive it when the link is dead or nothing is
 * there.
 */
export const RevisitLinkPanel: VoidComponent<{
  item: CleanupItemDetail;
  onDone: () => void;
  onKeep: () => void;
  onSkip: () => void;
}> = (props) => {
  const addSummary = useAction(addLinkSummaryAction);
  const remind = useAction(remindLinkAction);
  const archive = useAction(archiveOnlyAction);
  const paid = () => props.item.paid.link;
  // Fetching the page runs only in the browser once the card is open: never
  // during SSR, and never for a card nobody opened. The summary waits for a
  // click when it costs money, so moving through cards spends nothing.
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));
  const [summarizeId, setSummarizeId] = createSignal<string | null>(null);
  const summarize = () => !paid() || summarizeId() === props.item.docId;
  const [page, { refetch }] = createResource(
    () =>
      mounted() ? { id: props.item.docId, summarize: summarize() } : false,
    (key) => expandLinkForNote(key.id, key.summarize),
  );
  // `latest` would show the previous card's page while the next one loads,
  // but a summary of this card's page keeps the page on screen.
  const summarizing = () => summarizeId() === props.item.docId;
  const latest = () => {
    if (page.error || (page.loading && !summarizing())) return undefined;
    return page.latest;
  };
  const [busy, setBusy] = createSignal<Primary | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  createEffect(
    on(
      () => props.item.docId,
      () => {
        setError(null);
        // A click pays for this visit; coming back must not summarize again.
        setSummarizeId(null);
      },
      { defer: true },
    ),
  );

  const primary = (): Primary => {
    const x = latest();
    if (!x) return "remind";
    if (x.status === "dead") return "archive";
    if (x.draft && x.worth !== null && x.worth < 0.3) return "archive";
    if (x.draft) return "summary";
    return x.readable ? "summarize" : "remind";
  };

  const run = async (kind: Primary) => {
    if (kind === "summarize") {
      setSummarizeId(props.item.docId);
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      const id = props.item.docId;
      if (kind === "summary") {
        await addSummary({ docId: id, markdown: latest()!.draft!.markdown });
      } else if (kind === "remind") {
        await remind(id);
      } else {
        await archive({ docId: id, reason: "delete" });
      }
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const labels: Record<Primary, string> = {
    summarize: paidLabel("Summarize page"),
    summary: "Add summary to note",
    remind: "Remind me to check it",
    archive: "Archive",
  };
  const others = () =>
    (["summary", "remind", "archive"] as Primary[]).filter(
      (k) => k !== primary() && (k !== "summary" || latest()?.draft),
    );

  return (
    <Stack gap="4" flex="1" minH="0">
      <PanelSection
        title="Saved link"
        aside={
          <Button
            size="xs"
            variant="plain"
            onClick={() => refetch()}
            disabled={page.loading}
          >
            {paid() && summarize() ? paidLabel("Check again") : "Check again"}
          </Button>
        }
      >
        <Stack gap="1">
          <Show when={latest()?.title}>
            {(title) => (
              <Text fontSize="sm" fontWeight="medium">
                {title()}
              </Text>
            )}
          </Show>
          <Show when={latest()?.url}>
            {(url) => (
              <Link
                href={url()}
                target="_blank"
                rel="noreferrer"
                fontSize="sm"
                display="inline-flex"
                alignItems="center"
                gap="1"
                minW="0"
                data-testid="revisit-link-url"
              >
                <Text as="span" truncate>
                  {url()}
                </Text>
                <ExternalLinkIcon size={12} />
              </Link>
            )}
          </Show>
          <Show when={latest() && statusLine(latest()!)}>
            {(line) => (
              <Text fontSize="sm" color="fg.muted">
                {line()}
              </Text>
            )}
          </Show>
        </Stack>
      </PanelSection>
      <Show
        when={mounted() && !page.loading}
        fallback={
          <Stack gap="2" aria-busy="true" aria-label="Loading the page">
            <Skeleton h="4" w="60%" />
            <Skeleton h="4" w="90%" />
            <Skeleton h="4" w="78%" />
          </Stack>
        }
      >
        <Switch>
          <Match when={page.error}>
            <Text fontSize="sm" color="fg.error">
              Couldn't load the page. Try Check again.
            </Text>
          </Match>
          <Match when={paid() && latest()?.readable && !latest()?.draft}>
            <Text fontSize="xs" color="fg.muted">
              The page loads. A summary calls {props.item.paid.model}.
            </Text>
          </Match>
          <Match when={latest()?.draft}>
            {(draft) => (
              <PanelSection
                title="What the page holds"
                aside={
                  <Text fontSize="xs" color="fg.subtle">
                    <Show when={latest()?.worth != null}>
                      {(latest()!.worth! >= 0.5
                        ? "Looks worth keeping"
                        : "Looks like nothing to keep") + " · "}
                    </Show>
                    {draft().model === "local-extract"
                      ? "Local extract (no LLM key)"
                      : draft().model}
                  </Text>
                }
              >
                <DraftPreview markdown={draft().markdown} />
              </PanelSection>
            )}
          </Match>
        </Switch>
      </Show>
      <Show when={mounted() && !page.loading}>
        <HStack gap="2" flexWrap="wrap">
          <For each={others()}>
            {(kind) => (
              <Button
                size="xs"
                variant="outline"
                loading={busy() === kind}
                onClick={() => void run(kind)}
              >
                {labels[kind]}
              </Button>
            )}
          </For>
        </HStack>
      </Show>
      <Show when={error()}>
        {(message) => (
          <Text fontSize="sm" color="fg.error">
            {message()}
          </Text>
        )}
      </Show>
      <CleanupActionBar
        primaryLabel={labels[primary()]}
        onPrimary={() => void run(primary())}
        busy={busy() === primary()}
        disabled={!mounted() || page.loading}
        onKeep={props.onKeep}
        onSkip={props.onSkip}
      />
    </Stack>
  );
};
