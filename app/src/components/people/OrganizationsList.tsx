import { A, useSearchParams } from "@solidjs/router";
import { SearchIcon } from "lucide-solid";
import { For, Show, createSignal, onCleanup } from "solid-js";
import { css } from "styled-system/css";
import { OrgMark } from "./OrgMark";
import { HStack } from "styled-system/jsx";
import { Input } from "~/components/ui/input";
import { fetchOrganizations } from "~/services/people/people.queries";
import { createKeptAsync } from "~/utils/kept-async";

const grid = css({
  display: "grid",
  gridTemplateColumns: {
    base: "minmax(0, 1fr) auto",
    md: "minmax(10rem, 1.2fr) 8rem minmax(0, 1.6fr) 11rem",
  },
  columnGap: "4",
  alignItems: "center",
});
const row = css({
  px: "2",
  py: "2",
  borderRadius: "l2",
  _hover: { bg: "bg.subtle" },
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
const name = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  minW: "0",
  fontWeight: "medium",
  textDecoration: "none",
  truncate: true,
  _hover: { textDecoration: "underline" },
});
const muted = css({ fontSize: "sm", color: "fg.muted", truncate: true });
const hideNarrow = css({ display: { base: "none", md: "block" } });
const right = css({
  fontSize: "sm",
  color: "fg.muted",
  textAlign: "right",
  whiteSpace: "nowrap",
});
/** "4 people · 2 current", or "No one yet". Details are on the page. */
const peopleCount = (o: {
  currentMembers: number;
  pastMembers: number;
  unknownMembers: number;
}) => {
  const total = o.currentMembers + o.pastMembers + o.unknownMembers;
  if (!total) return "No one yet";
  const people = `${total} ${total === 1 ? "person" : "people"}`;
  return o.currentMembers ? `${people} · ${o.currentMembers} current` : people;
};
const empty = css({
  p: "4",
  borderRadius: "l3",
  bg: "bg.subtle",
  fontSize: "sm",
  color: "fg.muted",
});
const searchWrap = css({
  position: "relative",
  flex: "1 1 14rem",
  maxW: { md: "22rem" },
  "& svg": {
    position: "absolute",
    left: "2",
    top: "50%",
    transform: "translateY(-50%)",
    color: "fg.subtle",
  },
});

/** Every organization with current and past member counts. */
export function OrganizationsList() {
  const [params, setParams] = useSearchParams();
  const q = () => (typeof params.q === "string" ? params.q : "");
  const orgs = createKeptAsync(() =>
    fetchOrganizations({ search: q() || undefined }),
  );
  const [draft, setDraft] = createSignal(q());
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  return (
    <>
      <HStack mb="4">
        <div class={searchWrap}>
          <SearchIcon size={14} />
          <Input
            size="sm"
            ps="7"
            type="search"
            aria-label="Search organizations"
            placeholder="Search organizations"
            value={draft()}
            onInput={(e) => {
              const v = e.currentTarget.value;
              setDraft(v);
              clearTimeout(timer);
              timer = setTimeout(
                () =>
                  setParams({ q: v.trim() || undefined }, { replace: true }),
                250,
              );
            }}
          />
        </div>
      </HStack>
      <Show when={orgs.latest}>
        {(list) => (
          <Show
            when={list().length}
            fallback={
              <div class={empty}>
                {q()
                  ? "No organizations match."
                  : "No organizations yet. Add one here or from a profile's Organizations section."}
              </div>
            }
          >
            <div class={`${grid} ${head}`}>
              <span>Name</span>
              <span>Kind</span>
              <span>Summary</span>
              <span style={{ "text-align": "right" }}>People</span>
            </div>
            <For each={list()}>
              {(o) => (
                <div class={`${grid} ${row}`} data-organization-row={o.name}>
                  <A href={`/people/organizations/${o.id}`} class={name}>
                    <OrgMark org={o} size={24} />
                    <span class={css({ truncate: true })}>{o.name}</span>
                  </A>
                  <span class={`${muted} ${hideNarrow}`}>{o.kind}</span>
                  <span class={`${muted} ${hideNarrow}`}>{o.summary}</span>
                  <span class={right}>{peopleCount(o)}</span>
                </div>
              )}
            </For>
          </Show>
        )}
      </Show>
    </>
  );
}
