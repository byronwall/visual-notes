import { SearchIcon } from "lucide-solid";
import { For, Show, createSignal, onCleanup } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { todayLocal } from "~/lib/people/dates";
import { fetchPeople } from "~/services/people/people.queries";
import { createKeptAsync } from "~/utils/kept-async";
import { PeopleFilters, usePeopleFilters } from "./PeopleFilters";
import { PersonPreview } from "./PersonPreview";
import { PersonRow, personGrid } from "./PersonRow";

const PAGE_SIZE = 50;

const layout = css({
  display: "grid",
  gap: "6",
  gridTemplateColumns: { base: "minmax(0, 1fr)", xl: "minmax(0, 1fr) 22rem" },
  alignItems: "start",
});
const previewColumn = css({
  display: { base: "none", xl: "block" },
  position: "sticky",
  top: "4",
});
const searchWrap = css({
  position: "relative",
  flex: "1 1 14rem",
  minW: "0",
  maxW: { md: "22rem" },
  "& svg": {
    position: "absolute",
    left: "2",
    top: "50%",
    transform: "translateY(-50%)",
    color: "fg.subtle",
    pointerEvents: "none",
  },
});
const head = css({
  display: { base: "none", md: "grid" },
  px: "2",
  pb: "1",
  mb: "1",
  fontSize: "xs",
  color: "fg.subtle",
  borderBottomWidth: "1px",
  borderColor: "border",
});
const empty = css({
  p: "4",
  borderRadius: "l3",
  bg: "bg.subtle",
  fontSize: "sm",
  color: "fg.muted",
  display: "flex",
  alignItems: "center",
  gap: "3",
  flexWrap: "wrap",
});
const count = css({ fontSize: "sm", color: "fg.muted", whiteSpace: "nowrap" });
const archivedToggle = css({
  fontSize: "sm",
  color: "fg.muted",
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  cursor: "pointer",
});

/** Search, filter, and browse people. All state lives in the URL. */
export function PeopleDirectory(props: { onCreate: (name: string) => void }) {
  const f = usePeopleFilters();
  const today = todayLocal();
  const result = createKeptAsync(() =>
    fetchPeople({
      search: f.q() || undefined,
      context: f.context(),
      organizationId: f.organizationId(),
      contact: f.contact(),
      archived: f.archived() || undefined,
      limit: PAGE_SIZE,
      offset: f.page() * PAGE_SIZE,
    }),
  );

  const [draft, setDraft] = createSignal(f.q());
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const onSearch = (value: string) => {
    setDraft(value);
    clearTimeout(timer);
    timer = setTimeout(() => f.set({ q: value.trim() || undefined }), 250);
  };

  return (
    <>
      <HStack gap="2" flexWrap="wrap" mb="4">
        <div class={searchWrap}>
          <SearchIcon size={14} />
          <Input
            size="sm"
            ps="7"
            type="search"
            placeholder="Search names, details, roles, encounters"
            aria-label="Search people"
            value={draft()}
            onInput={(e) => onSearch(e.currentTarget.value)}
          />
        </div>
        <PeopleFilters filters={f} />
        <label class={archivedToggle}>
          <input
            type="checkbox"
            checked={f.archived()}
            onChange={(e) =>
              f.set({ archived: e.currentTarget.checked ? "1" : undefined })
            }
          />
          Archived
        </label>
        <Show when={result.latest}>
          {(r) => (
            <span class={count}>
              {r().total} {r().total === 1 ? "person" : "people"}
            </span>
          )}
        </Show>
      </HStack>

      <div class={layout}>
        <div>
          <Show when={result.latest}>
            {(r) => (
              <Show
                when={r().people.length}
                fallback={
                  <div class={empty} data-people-empty>
                    <Show
                      when={f.any()}
                      fallback="No people yet. Add someone to start remembering details."
                    >
                      <Show
                        when={f.q()}
                        fallback="No one matches these filters."
                      >
                        No one matches “{f.q()}”.
                      </Show>
                      <Show when={f.q()}>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => props.onCreate(f.q())}
                        >
                          Create “{f.q()}”
                        </Button>
                      </Show>
                      <Button
                        size="xs"
                        variant="plain"
                        onClick={() => {
                          setDraft("");
                          f.reset();
                        }}
                      >
                        Clear filters
                      </Button>
                    </Show>
                  </div>
                }
              >
                <div class={`${personGrid} ${head}`}>
                  <span>Name</span>
                  <span>Role</span>
                  <span>Contexts</span>
                  <span style={{ "text-align": "right" }}>Last contact</span>
                </div>
                <For each={r().people}>
                  {(person) => (
                    <PersonRow
                      person={person}
                      today={today}
                      detail={person.currentRole}
                      selected={f.selected() === person.id}
                      onSelect={() => f.select(person.id)}
                    />
                  )}
                </For>
                <Show when={f.page() > 0 || r().hasMore}>
                  <HStack justify="flex-end" gap="2" mt="3">
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={f.page() === 0}
                      onClick={() =>
                        f.set({
                          page: f.page() > 1 ? String(f.page() - 1) : undefined,
                        })
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={!r().hasMore}
                      onClick={() => f.set({ page: String(f.page() + 1) })}
                    >
                      Next
                    </Button>
                  </HStack>
                </Show>
              </Show>
            )}
          </Show>
        </div>
        <aside class={previewColumn} aria-label="Selected person">
          <Show
            when={f.selected()}
            keyed
            fallback={
              <div class={empty}>
                Select a row to preview a person. Names open the full profile.
              </div>
            }
          >
            {(id) => <PersonPreview id={id} />}
          </Show>
        </aside>
      </div>
    </>
  );
}
