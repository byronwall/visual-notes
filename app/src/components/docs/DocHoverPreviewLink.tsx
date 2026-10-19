import {
  Show,
  createSignal,
  createUniqueId,
  onCleanup,
  type JSX,
} from "solid-js";
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
  ariaCurrent?: "page";
  onNavigate?: () => void;
  children: JSX.Element;
};

const contentLinkClass = css({
  display: "block",
  color: "inherit",
  textDecorationLine: "none",
});

const OPEN_DELAY_MS = 100;
const CLOSE_DELAY_MS = 120;

/**
 * Title link with a hover preview. The link is plain SSR-stable markup; the
 * hover card machinery mounts only on first hover/focus, so long lists do not
 * pay for one Ark HoverCard per row during hydration.
 */
export const DocHoverPreviewLink = (props: DocHoverPreviewLinkProps) => {
  const triggerId = `doc-preview-${createUniqueId()}`;
  const [armed, setArmed] = createSignal(false);
  const [open, setOpen] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (next: boolean) => {
    clearTimeout(timer);
    timer = setTimeout(
      () => setOpen(next),
      next ? OPEN_DELAY_MS : CLOSE_DELAY_MS,
    );
  };
  const show = () => {
    setArmed(true);
    schedule(true);
  };
  const hide = () => schedule(false);
  onCleanup(() => clearTimeout(timer));

  const previewText = () => {
    const doc = props.previewDoc;
    if (doc?.previewText && doc.previewText.length > 0) return doc.previewText;
    const snippet = normalizePreviewText(props.snippet || "");
    if (snippet.length > 0) return snippet.slice(0, 240);
    return "No preview available.";
  };

  return (
    <>
      <a
        id={triggerId}
        href={props.href}
        class={props.triggerClass}
        aria-current={props.ariaCurrent}
        onClick={() => {
          clearTimeout(timer);
          setOpen(false);
          props.onNavigate?.();
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") show();
        }}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {props.children}
      </a>
      <Show when={armed()}>
        <HoverCard.Root
          ids={{ trigger: triggerId }}
          open={open()}
          onOpenChange={(details) => setOpen(details.open)}
          positioning={{
            placement: "right-start",
            offset: { mainAxis: 8 },
            strategy: "fixed",
          }}
        >
          <Portal>
            <HoverCard.Positioner>
              <HoverCard.Content
                maxW="320px"
                onPointerEnter={() => clearTimeout(timer)}
                onPointerLeave={hide}
              >
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
    </>
  );
};
