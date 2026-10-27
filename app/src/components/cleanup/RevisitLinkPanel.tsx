import { useAction } from "@solidjs/router";
import { ExternalLinkIcon } from "lucide-solid";
import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
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
import { CleanupActionBar } from "./CleanupActionBar";
import { DraftPreview } from "./DraftPreview";
import { PanelSection } from "./PanelSection";

type Primary = "summary" | "remind" | "archive";

const statusLine = (x: LinkExpansion) => {
  const code = x.httpStatus ? ` (${x.httpStatus})` : "";
  if (x.status === "dead") return `The link no longer loads${code}.`;
  if (x.status === "blocked") {
    return `The site refused the check${code}. Open it yourself to see it.`;
  }
  if (!x.draft) return "The page loads, but has little readable text.";
  return null;
};

/**
 * A saved link: load the page again, summarize it, and choose. Add the
 * summary to the note, get an Inbox reminder to go look, or archive it
 * when the link is dead or nothing is there.
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
  // Fetching the page and asking an LLM runs only in the browser once the
  // card is open: never during SSR, and never for a card nobody opened.
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));
  const [page, { refetch }] = createResource(
    () => (mounted() ? props.item.docId : false),
    (id) => expandLinkForNote(id),
  );
  const latest = () => (page.error ? undefined : page.latest);
  const [busy, setBusy] = createSignal<Primary | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const primary = (): Primary => {
    const x = latest();
    if (!x) return "remind";
    if (x.status === "dead") return "archive";
    if (x.draft && x.worth !== null && x.worth < 0.3) return "archive";
    return x.draft ? "summary" : "remind";
  };

  const run = async (kind: Primary) => {
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
            Check again
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
        when={mounted() && (!page.loading || latest())}
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
