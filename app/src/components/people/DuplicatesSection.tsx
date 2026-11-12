import { A } from "@solidjs/router";
import { For, Show, createResource, createSignal } from "solid-js";
import { Button } from "~/components/ui/button";
import type { PersonProfile } from "~/lib/people/types";
import { fetchDuplicates } from "~/services/people/people.queries";
import { onDemand } from "~/utils/kept-async";
import { MergeDialog } from "./MergeDialog";
import {
  ProfileSection,
  rowActions,
  rowMain,
  rowMeta,
  sectionRow,
} from "./profile-section";

/** Possible duplicates of this person, with evidence and a merge review. */
export function DuplicatesSection(props: { person: PersonProfile }) {
  const [dupes] = createResource(
    () => props.person.id,
    (id) => fetchDuplicates(id),
    onDemand,
  );
  const [merging, setMerging] = createSignal<string | null>(null);
  return (
    <Show when={dupes.latest?.length}>
      <ProfileSection title="Possible duplicates">
        <For each={dupes.latest}>
          {(d) => (
            <div class={sectionRow} data-duplicate={d.displayName}>
              <div class={rowMain}>
                <A href={`/people/${d.id}`}>{d.displayName}</A>
                <div class={rowMeta}>{d.evidence.join(", ")}</div>
              </div>
              <div class={rowActions} data-row-actions>
                <Button
                  size="xs"
                  variant="plain"
                  onClick={() => setMerging(d.id)}
                >
                  Merge…
                </Button>
              </div>
            </div>
          )}
        </For>
      </ProfileSection>
      <Show when={merging()} keyed>
        {(id) => (
          <MergeDialog
            a={props.person}
            otherId={id}
            onClose={() => setMerging(null)}
          />
        )}
      </Show>
    </Show>
  );
}
