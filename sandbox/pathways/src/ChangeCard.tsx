import { For, Show } from "solid-js";
import { change, map, setChange, setSelected, setView } from "./state";

/** "What changed" after an agent run, at the top of the side panel. */
export function ChangeCard() {
  const title = (id: string) => map()?.nodes.find((n) => n.id === id)?.title ?? id;
  const NodeList = (props: { ids: string[] }) => (
    <ul class="edge-list">
      <For each={props.ids}>
        {(id) => (
          <li>
            <button class="link" onClick={() => setSelected(id)}>
              {title(id)}
            </button>
          </li>
        )}
      </For>
    </ul>
  );

  return (
    <Show when={change()}>
      {(c) => (
        <div class="change-card">
          <div class="panel-row">
            <strong>✦ {c().label}</strong>
            <Show when={c().ms}>
              <span class="muted">{(c().ms! / 1000).toFixed(1)}s</span>
            </Show>
            <button class="x" title="Clear the highlights" onClick={() => setChange(null)}>
              ×
            </button>
          </div>
          <Show when={c().summary}>
            <p class="change-summary">{c().summary}</p>
          </Show>
          <Show when={c().steer}>
            <p class="muted">Steered by: “{c().steer}”</p>
          </Show>
          <Show
            when={c().added.length || c().joined.length || c().removed.length || c().dropped?.length || c().questions || c().planned}
            fallback={<p class="help">Nothing on the map changed.</p>}
          >
            <Show when={c().added.length}>
              <h3>Added {c().added.length}</h3>
              <NodeList ids={c().added} />
            </Show>
            <Show when={c().joined.length}>
              <h3>Joined existing paths</h3>
              <NodeList ids={c().joined} />
            </Show>
            <Show when={c().dropped?.length}>
              <h3>Marked dropped</h3>
              <NodeList ids={c().dropped!} />
            </Show>
            <Show when={c().removed.length}>
              <h3>Merged away</h3>
              <ul class="edge-list">
                <For each={c().removed}>{(t) => <li class="muted">{t}</li>}</For>
              </ul>
            </Show>
            <Show when={c().planned}>
              <p class="help">
                {c().planned} next steps are ready.{" "}
                <button class="link" onClick={() => setView("next")}>
                  Open Next steps
                </button>
              </p>
            </Show>
            <Show when={c().questions}>
              <p class="help">{c().questions} new questions under Goals &amp; vibes. Answer them, then ask again.</p>
            </Show>
          </Show>
        </div>
      )}
    </Show>
  );
}
