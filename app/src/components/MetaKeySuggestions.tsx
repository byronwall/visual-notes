import { For, Show, createMemo, createResource } from "solid-js";
import type { VoidComponent } from "solid-js";
import { fetchMetaKeys } from "~/services/docs.service";

export const MetaKeySuggestions: VoidComponent<{
  onSelect: (key: string) => void;
  limit?: number;
}> = (props) => {
  const [keySuggestions] = createResource(fetchMetaKeys);
  const topKeys = createMemo(() =>
    (Array.isArray(keySuggestions())
      ? (keySuggestions() as { key: string; count: number }[])
      : []
    ).slice(0, props.limit ?? 10)
  );

  return (
    <div class="mt-2">
      <Show when={topKeys().length > 0}>
        <div class="flex flex-wrap gap-2">
          <For each={topKeys()}>
            {(s) => (
              <button
                class="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
                onClick={() => props.onSelect(s.key)}
                title={`${s.key} (${s.count})`}
                tabindex="-1"
              >
                <span class="font-medium text-gray-800 truncate max-w-[10rem]">
                  {s.key}
                </span>
                <span class="text-gray-500">{s.count}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
