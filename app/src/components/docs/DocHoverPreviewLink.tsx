import { Show, createSignal, onMount, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { Box } from "styled-system/jsx";
import { css } from "styled-system/css";
import * as HoverCard from "~/components/ui/hover-card";
import { DocPreviewSummary } from "~/components/docs/DocPreviewSummary";
import { normalizePreviewText } from "~/features/docs-index/utils/doc-preview";

type DocHoverPreviewLinkProps = {
  href: string;
  title: string;
  updatedAt: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  snippet?: string | null;
  previewDoc?: {
    previewText?: string;
    path?: string | null;
    meta?: Record<string, unknown> | null;
  } | null;
  triggerClass: string;
  onNavigate?: () => void;
  children: JSX.Element;
};

const contentLinkClass = css({
  display: "block",
  color: "inherit",
  textDecorationLine: "none",
});

export const DocHoverPreviewLink = (props: DocHoverPreviewLinkProps) => {
  const [mounted, setMounted] = createSignal(false);

  onMount(() => {
    setMounted(true);
  });

  const previewText = () => {
    const doc = props.previewDoc;
    if (doc?.previewText && doc.previewText.length > 0) return doc.previewText;
    const snippet = normalizePreviewText(props.snippet || "");
    if (snippet.length > 0) return snippet.slice(0, 240);
    return "No preview available.";
  };

  return (
    <Show
      when={mounted()}
      fallback={
        <a
          href={props.href}
          class={props.triggerClass}
          onClick={props.onNavigate}
        >
          {props.children}
        </a>
      }
    >
      <HoverCard.Root
        openDelay={100}
        closeDelay={100}
        positioning={{
          placement: "right-start",
          offset: { mainAxis: 8 },
          strategy: "fixed",
        }}
      >
        <HoverCard.Trigger
          asChild={(triggerProps) => (
            <a
              {...triggerProps}
              href={props.href}
              class={props.triggerClass}
              onClick={props.onNavigate}
            >
              {props.children}
            </a>
          )}
        />
        <Portal>
          <HoverCard.Positioner>
            <HoverCard.Content maxW="320px">
              <a
                href={props.href}
                class={contentLinkClass}
                onClick={props.onNavigate}
              >
                <Box>
                  <DocPreviewSummary
                    title={props.title}
                    updatedAt={props.updatedAt}
                    path={props.previewDoc?.path ?? props.path}
                    meta={props.previewDoc?.meta ?? props.meta}
                    previewText={previewText()}
                  />
                </Box>
              </a>
            </HoverCard.Content>
          </HoverCard.Positioner>
        </Portal>
      </HoverCard.Root>
    </Show>
  );
};
