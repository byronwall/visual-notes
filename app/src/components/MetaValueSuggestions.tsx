import { For, Show, createMemo, createResource } from "solid-js";
import type { VoidComponent } from "solid-js";
import { fetchMetaValues } from "~/services/docs.service";

export const MetaValueSuggestions: VoidComponent<{
  keyName: string;
  onSelect: (value: string) => void;
  limit?: number;
}> = (props) => {
  const [valueSuggestions] = createResource(
    () => props.keyName,
    fetchMetaValues
  );
  const topValues = createMemo(() =>
    (Array.isArray(valueSuggestions())
      ? (valueSuggestions() as { value: string; count: number }[])
      : []
    ).slice(0, props.limit ?? 10)
  );

  return (
    <Show when={props.keyName.trim().length > 0 && topValues().length > 0}>
      <div class="mt-2">
        <div class="flex flex-wrap gap-2 justify-start md:justify-end">
          <For each={topValues()}>
            {(s) => (
              <button
                class="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
                onClick={() => props.onSelect(s.value)}
                title={`${s.value} (${s.count})`}
              >
                <span class="font-medium text-gray-800 truncate max-w-[12rem]">
                  {s.value}
                </span>
                <span class="text-gray-500">{s.count}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
};
