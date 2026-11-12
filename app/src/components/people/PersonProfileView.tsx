import { A, useAction } from "@solidjs/router";
import { For, Show, createSignal, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { daysAgoLabel, formatDay, todayLocal } from "~/lib/people/dates";
import type { PersonProfile } from "~/lib/people/types";
import { updatePersonAction } from "~/services/people/people.actions";
import { openCapture } from "./capture-state";
import { AffiliationsSection } from "./AffiliationsSection";
import { ContactsSection } from "./ContactsSection";
import { CustomFieldsSection } from "./CustomFieldsSection";
import { FactItem } from "./FactItem";
import { DuplicatesSection } from "./DuplicatesSection";
import { LinkedNotesSection } from "./LinkedNotesSection";
import { ProfileDialog } from "./ProfileDialog";
import { ProfileHistory } from "./ProfileHistory";

const layout = css({
  display: "grid",
  gap: { base: "6", lg: "8" },
  gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 18rem" },
  alignItems: "start",
});
const section = css({ display: "flex", flexDirection: "column", gap: "1" });
const sectionHead = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  px: "2",
  pb: "1",
  mb: "1",
  borderBottomWidth: "1px",
  borderColor: "border",
});
const sectionTitle = css({ fontSize: "sm", fontWeight: "semibold", flex: "1" });
const aside = css({
  display: "flex",
  flexDirection: "column",
  gap: "4",
  fontSize: "sm",
});
const detail = css({ display: "flex", flexDirection: "column", gap: "0.5" });
const label = css({ fontSize: "xs", color: "fg.subtle" });
const pill = css({
  display: "inline-block",
  fontSize: "xs",
  px: "1.5",
  py: "0.5",
  mr: "1",
  mb: "1",
  borderRadius: "l1",
  bg: "bg.muted",
  color: "fg.muted",
});
const banner = css({
  p: "3",
  mb: "4",
  borderRadius: "l2",
  bg: "amber.3",
  color: "amber.11",
  fontSize: "sm",
  display: "flex",
  alignItems: "center",
  gap: "3",
});
const subtitle = css({
  fontSize: "sm",
  color: "fg.muted",
  mt: "-3",
  mb: "5",
});
const empty = css({ fontSize: "sm", color: "fg.muted", px: "2", py: "2" });

function Detail(props: { label: string; children: JSX.Element }) {
  return (
    <div class={detail}>
      <span class={label}>{props.label}</span>
      <span>{props.children}</span>
    </div>
  );
}

/** A person's page: what to remember first, then history; details beside. */
export function PersonProfileView(props: { person: PersonProfile }) {
  const p = () => props.person;
  const [editing, setEditing] = createSignal(false);
  const archive = useAction(updatePersonAction);
  const current = () => p().facts.filter((f) => !f.retiredAt);
  const retired = () => p().facts.filter((f) => f.retiredAt);
  const ref = () => [{ id: p().id, displayName: p().displayName }];
  const today = todayLocal();

  return (
    <>
      <Show when={p().mergedInto}>
        {(m) => (
          <div class={banner}>
            Merged into <A href={`/people/${m().id}`}>{m().displayName}</A>. Its
            history now lives there.
          </div>
        )}
      </Show>
      <Show when={p().archivedAt && !p().mergedInto}>
        <div class={banner}>
          Archived. History is kept; this person is hidden from the directory.
          <Button
            size="xs"
            variant="outline"
            onClick={() =>
              void archive({ id: p().id, patch: { archived: false } })
            }
          >
            Restore
          </Button>
        </div>
      </Show>
      <p class={subtitle} data-profile-subtitle>
        {[
          p().currentRole,
          p().lastContactOn
            ? `Last contact ${daysAgoLabel(p().lastContactOn!, today)}`
            : "No recorded contact",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div class={layout}>
        <div class={section}>
          <section class={section} aria-labelledby="remember-heading">
            <div class={sectionHead}>
              <h2 id="remember-heading" class={sectionTitle}>
                What to remember
              </h2>
              <Button
                size="xs"
                variant="outline"
                onClick={() => openCapture("fact", ref())}
              >
                Remember a detail
              </Button>
            </div>
            <Show
              when={current().length}
              fallback={<div class={empty}>Nothing remembered yet.</div>}
            >
              <For each={current()}>{(fact) => <FactItem fact={fact} />}</For>
            </Show>
          </section>

          <section
            class={section}
            aria-labelledby="history-heading"
            style={{ "margin-top": "1.5rem" }}
          >
            <div class={sectionHead}>
              <h2 id="history-heading" class={sectionTitle}>
                History
              </h2>
              <Button
                size="xs"
                variant="outline"
                onClick={() => openCapture("interaction", ref())}
              >
                Log interaction
              </Button>
            </div>
            <ProfileHistory
              personId={p().id}
              interactions={p().interactions}
              retiredFacts={retired()}
            />
          </section>
        </div>

        <aside class={aside} aria-label="Profile details">
          <Detail label="Last recorded contact">
            {p().lastContactOn
              ? `${formatDay(p().lastContactOn!)} (${daysAgoLabel(p().lastContactOn!, today)})`
              : "No recorded contact"}
          </Detail>
          <Show when={p().summary}>
            <Detail label="Summary">{p().summary}</Detail>
          </Show>
          <Show when={p().contexts.length}>
            <Detail label="Contexts">
              <For each={p().contexts}>
                {(c) => <span class={pill}>{c}</span>}
              </For>
            </Detail>
          </Show>
          <Show when={p().aliases.length}>
            <Detail label="Also known as">{p().aliases.join(", ")}</Detail>
          </Show>
          <Show when={p().location}>
            <Detail label="Location">{p().location}</Detail>
          </Show>
          <Show when={p().howKnown}>
            <Detail label="How you know them">{p().howKnown}</Detail>
          </Show>
          <ContactsSection personId={p().id} contacts={p().contacts} />
          <AffiliationsSection
            personId={p().id}
            affiliations={p().affiliations}
          />
          <CustomFieldsSection personId={p().id} fields={p().customFields} />
          <LinkedNotesSection personId={p().id} notes={p().notes} />
          <Show when={!p().archivedAt}>
            <DuplicatesSection person={p()} />
          </Show>
          <div style={{ display: "flex", gap: "0.5rem", "flex-wrap": "wrap" }}>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              Edit profile
            </Button>
            <Show when={!p().archivedAt}>
              <Button
                size="xs"
                variant="plain"
                onClick={() =>
                  void archive({ id: p().id, patch: { archived: true } })
                }
              >
                Archive
              </Button>
            </Show>
          </div>
        </aside>
      </div>
      <Show when={editing()}>
        <ProfileDialog
          person={p()}
          onClose={() => setEditing(false)}
          onSaved={() => {}}
        />
      </Show>
    </>
  );
}
