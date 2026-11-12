import { useSearchParams } from "@solidjs/router";
import { SearchIcon } from "lucide-solid";
import { For, Show, createSignal, onCleanup } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { todayLocal } from "~/lib/people/dates";
import { fetchPeople } from "~/services/people/people.queries";
import { createKeptAsync } from "~/utils/kept-async";
import { PersonRow, personGrid } from "./PersonRow";

const PAGE_SIZE = 50;

const searchWrap = css({
  position: "relative",
  flex: "1 1 14rem",
  minW: "0",
  maxW: { md: "24rem" },
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
const count = css({ fontSize: "sm", color: "fg.muted" });

/** Search and browse people. Search text and page live in the URL. */
export function PeopleDirectory(props: { onCreate: (name: string) => void }) {
  const [params, setParams] = useSearchParams();
  const q = () => (typeof params.q === "string" ? params.q : "");
  const page = () => Math.max(0, Number(params.page ?? 0) || 0);
  const today = todayLocal();
  const result = createKeptAsync(() =>
    fetchPeople({
      search: q() || undefined,
      limit: PAGE_SIZE,
      offset: page() * PAGE_SIZE,
    }),
  );

  const [draft, setDraft] = createSignal(q());
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const onSearch = (value: string) => {
    setDraft(value);
    clearTimeout(timer);
    timer = setTimeout(
      () =>
        setParams(
          { q: value.trim() || undefined, page: undefined },
          { replace: true },
        ),
      250,
    );
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
            placeholder="Search names, details, and encounters"
            aria-label="Search people"
            value={draft()}
            onInput={(e) => onSearch(e.currentTarget.value)}
          />
        </div>
        <Show when={result.latest}>
          {(r) => (
            <span class={count}>
              {r().total} {r().total === 1 ? "person" : "people"}
            </span>
          )}
        </Show>
      </HStack>

      <Show when={result.latest}>
        {(r) => (
          <Show
            when={r().people.length}
            fallback={
              <div class={empty} data-people-empty>
                <Show
                  when={q()}
                  fallback="No people yet. Add someone to start remembering details."
                >
                  No one matches “{q()}”.
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => props.onCreate(q())}
                  >
                    Create “{q()}”
                  </Button>
                </Show>
              </div>
            }
          >
            <div class={`${personGrid} ${head}`}>
              <span>Name</span>
              <span>Summary</span>
              <span>Contexts</span>
              <span style={{ "text-align": "right" }}>Last contact</span>
            </div>
            <For each={r().people}>
              {(person) => <PersonRow person={person} today={today} />}
            </For>
            <Show when={page() > 0 || r().hasMore}>
              <HStack justify="flex-end" gap="2" mt="3">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={page() === 0}
                  onClick={() => setParams({ page: page() - 1 || undefined })}
                >
                  Previous
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={!r().hasMore}
                  onClick={() => setParams({ page: page() + 1 })}
                >
                  Next
                </Button>
              </HStack>
            </Show>
          </Show>
        )}
      </Show>
    </>
  );
}
