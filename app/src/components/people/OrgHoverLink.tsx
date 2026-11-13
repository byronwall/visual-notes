import { A } from "@solidjs/router";
import {
  Show,
  createSignal,
  createUniqueId,
  onCleanup,
  type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import * as HoverCard from "~/components/ui/hover-card";
import type { OrgRef } from "~/lib/people/types";
import { OrgMark } from "./OrgMark";

const head = css({ display: "flex", gap: "2.5", alignItems: "center" });
const name = css({ fontWeight: "semibold", fontSize: "sm" });
const meta = css({ fontSize: "xs", color: "fg.muted" });
const body = css({ mt: "2", fontSize: "sm", lineHeight: "1.5" });

/** "acme.com" from "https://www.acme.com/about". */
export const siteLabel = (url: string) => {
  try {
    return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname
      .replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * An organization link with a hover card: its mark, kind, website, and what
 * it does. Organizations with nothing beyond a name get a plain link, since
 * a card that only repeats the name is noise. The card mounts on first hover.
 */
export function OrgHoverLink(props: {
  org: OrgRef;
  /** Extra line for the card, e.g. "3 people you know worked here". */
  note?: string | null;
  href?: string;
  class?: string;
  children: JSX.Element;
}) {
  const href = () => props.href ?? `/people/organizations/${props.org.id}`;
  const rich = () => !!(props.org.summary || props.org.url || props.note);
  const triggerId = `org-card-${createUniqueId()}`;
  const [armed, setArmed] = createSignal(false);
  const [open, setOpen] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (next: boolean) => {
    clearTimeout(timer);
    timer = setTimeout(() => setOpen(next), next ? 120 : 140);
  };
  const show = () => {
    if (!rich()) return;
    setArmed(true);
    schedule(true);
  };
  const hide = () => schedule(false);
  onCleanup(() => clearTimeout(timer));

  return (
    <>
      <A
        id={triggerId}
        href={href()}
        class={props.class}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => setOpen(false)}
      >
        {props.children}
      </A>
      <Show when={armed()}>
        <HoverCard.Root
          ids={{ trigger: triggerId }}
          open={open()}
          onOpenChange={(d) => setOpen(d.open)}
          positioning={{ placement: "bottom-start", offset: { mainAxis: 6 } }}
        >
          <Portal>
            <HoverCard.Positioner>
              <HoverCard.Content
                maxW="340px"
                onPointerEnter={() => clearTimeout(timer)}
                onPointerLeave={hide}
                data-org-card
              >
                <div class={head}>
                  <OrgMark org={props.org} size={32} />
                  <div>
                    <div class={name}>{props.org.name}</div>
                    <div class={meta}>
                      {props.org.kind}
                      <Show when={props.org.kind && props.org.url}> · </Show>
                      <Show when={props.org.url}>
                        {(url) => (
                          <a href={url()} target="_blank" rel="noreferrer">
                            {siteLabel(url())}
                          </a>
                        )}
                      </Show>
                    </div>
                  </div>
                </div>
                <Show when={props.org.summary}>
                  <p class={body}>{props.org.summary}</p>
                </Show>
                <Show when={props.note}>
                  <p class={`${meta} ${css({ mt: "2" })}`}>{props.note}</p>
                </Show>
              </HoverCard.Content>
            </HoverCard.Positioner>
          </Portal>
        </HoverCard.Root>
      </Show>
    </>
  );
}
