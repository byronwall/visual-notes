import { A, useAction, useSearchParams } from "@solidjs/router";
import { For, Show, createMemo, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { setSelfAction } from "~/services/people/people.actions";
import {
  fetchIntroductionPaths,
  fetchNetwork,
  fetchPersonCandidates,
  fetchSelf,
} from "~/services/people/people.queries";
import { createKeptAsync, onDemand } from "~/utils/kept-async";
import { NetworkGraph } from "./NetworkGraph";
import { SearchPicker, type PickItem } from "./SearchPicker";

const layout = css({
  display: "grid",
  gap: "6",
  gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 20rem" },
  alignItems: "start",
});
const side = css({
  display: "flex",
  flexDirection: "column",
  gap: "4",
  fontSize: "sm",
});
const label = css({ fontSize: "xs", color: "fg.subtle", mb: "1" });
const listItem = css({
  display: "flex",
  gap: "2",
  alignItems: "baseline",
  px: "1",
  py: "0.5",
  borderRadius: "l1",
  "&[data-selected]": { bg: "bg.muted" },
});
const muted = css({ color: "fg.muted", fontSize: "xs" });
const step = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "1",
  alignItems: "baseline",
});
const empty = css({
  p: "4",
  borderRadius: "l3",
  bg: "bg.subtle",
  color: "fg.muted",
  fontSize: "sm",
});

const searchPeople = async (q: string): Promise<PickItem[]> =>
  (await fetchPersonCandidates(q)).map((p) => ({
    id: p.id,
    label: p.displayName,
    meta: p.currentRole,
  }));

/** One person's known connections, a list alternative, and introduction paths. */
export function NetworkView() {
  const [params, setParams] = useSearchParams();
  const self = createKeptAsync(() => fetchSelf());
  const focus = () =>
    (typeof params.focus === "string" ? params.focus : self.latest?.id) || "";
  const target = () => (typeof params.to === "string" ? params.to : "");
  const hops = () => (params.hops === "1" ? 1 : 2) as 1 | 2;
  const net = createKeptAsync(
    () =>
      focus()
        ? fetchNetwork({ personId: focus(), hops: hops() })
        : Promise.resolve(null),
    onDemand,
  );
  const paths = createKeptAsync(
    () =>
      focus() && target()
        ? fetchIntroductionPaths({ fromId: focus(), toId: target() })
        : Promise.resolve(null),
    onDemand,
  );
  const [selected, setSelected] = createSignal<string | null>(null);
  const [expanded, setExpanded] = createSignal(false);
  const setMe = useAction(setSelfAction);

  const pathEdgeIds = createMemo(
    () =>
      new Set((paths.latest?.paths ?? []).flat().map((s) => s.relationship.id)),
  );
  const nameOf = (id: string) =>
    net.latest?.people.find((p) => p.id === id)?.displayName ?? "";
  const byHop = (h: number) =>
    (net.latest?.people ?? [])
      .filter((p) => p.hops === h)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const edgeTo = (id: string) =>
    net.latest?.edges.find(
      (e) =>
        (e.from === focus() && e.to === id) ||
        (e.to === focus() && e.from === id),
    );

  return (
    <div class={layout}>
      <div>
        <HStack gap="3" mb="3" flexWrap="wrap" alignItems="flex-end">
          <div style={{ "min-width": "14rem" }}>
            <div class={label}>Center on</div>
            <SearchPicker
              placeholder={
                focus() ? nameOf(focus()) || "Find a person" : "Find a person"
              }
              search={searchPeople}
              onPick={(p) => {
                setSelected(null);
                setParams({ focus: p.id, to: undefined });
              }}
            />
          </div>
          <HStack gap="1">
            <Button
              size="xs"
              variant={hops() === 1 ? "solid" : "outline"}
              onClick={() => setParams({ hops: "1" })}
            >
              1 step
            </Button>
            <Button
              size="xs"
              variant={hops() === 2 ? "solid" : "outline"}
              onClick={() => setParams({ hops: undefined })}
            >
              2 steps
            </Button>
          </HStack>
          <Show when={focus() && self.latest?.id !== focus()}>
            <Button
              size="xs"
              variant="plain"
              onClick={() => void setMe(focus())}
            >
              This is me
            </Button>
          </Show>
        </HStack>
        <Show
          when={net.latest}
          fallback={
            <div class={empty}>
              Pick a person to see their recorded relationships. Mark your own
              profile with "This is me" to start here by default.
            </div>
          }
        >
          {(n) => (
            <Show
              when={n().people.length > 1}
              fallback={
                <div class={empty}>
                  No relationships recorded for {nameOf(focus())}. Add them from
                  the profile's Relationships section.
                </div>
              }
            >
              <NetworkGraph
                centerId={n().center}
                people={n().people}
                edges={n().edges}
                selectedId={selected()}
                pathEdgeIds={pathEdgeIds()}
                expanded={expanded()}
                onSelect={setSelected}
                onToggleExpanded={() => setExpanded(!expanded())}
              />
            </Show>
          )}
        </Show>
      </div>

      <aside class={side} aria-label="Network details">
        <Show when={selected()}>
          {(id) => (
            <div>
              <div class={label}>Selected</div>
              <strong>{nameOf(id())}</strong>
              <HStack gap="2" mt="1">
                <A href={`/people/${id()}`}>Open profile</A>
                <Show when={id() !== focus()}>
                  <Button
                    size="xs"
                    variant="plain"
                    onClick={() => setParams({ focus: id(), to: undefined })}
                  >
                    Center here
                  </Button>
                  <Button
                    size="xs"
                    variant="plain"
                    onClick={() => setParams({ to: id() })}
                  >
                    Path to here
                  </Button>
                </Show>
              </HStack>
            </div>
          )}
        </Show>

        <Show when={focus()}>
          <div>
            <div class={label}>Find an introduction path to</div>
            <SearchPicker
              placeholder="Person"
              search={searchPeople}
              onPick={(p) => setParams({ to: p.id })}
            />
          </div>
        </Show>
        <Show when={paths.latest}>
          {(r) => (
            <div data-paths>
              <div class={label}>
                {r().from.displayName} → {r().to.displayName}
              </div>
              <Show
                when={r().paths.length}
                fallback={
                  <p class={muted}>
                    No recorded path. That does not mean an introduction is
                    impossible.
                  </p>
                }
              >
                <For each={r().paths}>
                  {(path, i) => (
                    <div data-path={i()} style={{ "margin-bottom": "0.5rem" }}>
                      <For each={path}>
                        {(s) => (
                          <div class={step}>
                            <span>{s.from.displayName}</span>
                            <span class={muted}>
                              — {s.relationship.label} —
                            </span>
                            <A href={`/people/${s.to.id}`}>
                              {s.to.displayName}
                            </A>
                            <Show when={s.relationship.source}>
                              <span class={muted}>
                                ({s.relationship.source})
                              </span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  )}
                </For>
              </Show>
              <Show when={r().leads.length}>
                <div class={label} style={{ "margin-top": "0.5rem" }}>
                  Possible leads (shared organizations, not known connections)
                </div>
                <For each={r().leads}>
                  {(l) => <p class={muted}>{l.note}</p>}
                </For>
              </Show>
            </div>
          )}
        </Show>

        <Show when={net.latest && net.latest.people.length > 1}>
          <nav aria-label="Connections list">
            <For each={[1, 2]}>
              {(h) => (
                <Show when={byHop(h).length}>
                  <div class={label}>
                    {h === 1 ? "Direct relationships" : "Two steps away"}
                  </div>
                  <For each={byHop(h)}>
                    {(p) => (
                      <div
                        class={listItem}
                        data-selected={selected() === p.id ? "" : undefined}
                      >
                        <A
                          href={`/people/network?focus=${p.id}`}
                          onFocus={() => setSelected(p.id)}
                        >
                          {p.displayName}
                        </A>
                        <Show when={h === 1 && edgeTo(p.id)}>
                          {(e) => <span class={muted}>{e().label}</span>}
                        </Show>
                      </div>
                    )}
                  </For>
                </Show>
              )}
            </For>
          </nav>
        </Show>
      </aside>
    </div>
  );
}
