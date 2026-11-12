import { A } from "@solidjs/router";
import { For, Show, createResource } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { contactHref } from "~/lib/people/contacts";
import { daysAgoLabel, formatDay, todayLocal } from "~/lib/people/dates";
import { INTERACTION_KIND_LABELS } from "~/lib/people/types";
import { fetchPerson } from "~/services/people/people.queries";
import { onDemand } from "~/utils/kept-async";
import { openCapture } from "./capture-state";

const panel = css({
  display: "flex",
  flexDirection: "column",
  gap: "3",
  p: "4",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l3",
  bg: "bg.default",
  fontSize: "sm",
});
const name = css({
  fontSize: "lg",
  fontWeight: "semibold",
  textDecoration: "none",
  _hover: { textDecoration: "underline" },
});
const muted = css({ color: "fg.muted" });
const label = css({ fontSize: "xs", color: "fg.subtle", mb: "0.5" });
const item = css({ lineHeight: "relaxed" });
const actions = css({ display: "flex", gap: "2", flexWrap: "wrap" });

/** The selected directory row, summarized beside the list. */
export function PersonPreview(props: { id: string }) {
  const [person] = createResource(
    () => props.id,
    (id) => fetchPerson(id),
    onDemand,
  );
  const today = todayLocal();
  return (
    <Show when={person.latest} fallback={<div class={panel}>Loading…</div>}>
      {(p) => (
        <div class={panel} data-person-preview={p().displayName}>
          <div>
            <A href={`/people/${p().id}`} class={name}>
              {p().displayName}
            </A>
            <div class={muted}>
              {[
                p().currentRole,
                p().lastContactOn
                  ? `Last contact ${daysAgoLabel(p().lastContactOn!, today)}`
                  : "No recorded contact",
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <Show when={p().summary}>
            <div>{p().summary}</div>
          </Show>
          <div>
            <div class={label}>What to remember</div>
            <Show
              when={p().facts.some((f) => !f.retiredAt)}
              fallback={<span class={muted}>Nothing remembered yet.</span>}
            >
              <For
                each={p()
                  .facts.filter((f) => !f.retiredAt)
                  .slice(0, 5)}
              >
                {(f) => <div class={item}>• {f.text}</div>}
              </For>
            </Show>
          </div>
          <Show when={p().interactions[0]}>
            {(i) => (
              <div>
                <div class={label}>Latest encounter</div>
                <div class={item}>
                  {formatDay(i().occurredOn)} ·{" "}
                  {INTERACTION_KIND_LABELS[i().kind]}: {i().summary}
                </div>
              </div>
            )}
          </Show>
          <Show when={p().contacts.length}>
            <div>
              <div class={label}>Contact</div>
              <For each={p().contacts.slice(0, 4)}>
                {(c) => (
                  <div class={item}>
                    <Show
                      when={contactHref(c.kind, c.value)}
                      fallback={c.value}
                    >
                      {(href) => <a href={href()}>{c.value}</a>}
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
          <div class={actions}>
            <Button
              size="xs"
              variant="outline"
              onClick={() => openCapture("fact", [p()])}
            >
              Remember a detail
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => openCapture("interaction", [p()])}
            >
              Log interaction
            </Button>
          </div>
        </div>
      )}
    </Show>
  );
}
