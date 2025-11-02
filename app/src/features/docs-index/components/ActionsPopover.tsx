import { For, Show, type Accessor } from "solid-js";
import { usePopover } from "../hooks/usePopover";
import type { SourcesResponse } from "../data/docs.service";

export const ActionsPopover = (props: {
  sources: Accessor<SourcesResponse | undefined>;
  onBulkSetSource: () => Promise<void>;
  onCleanupTitles: () => Promise<void>;
  onProcessPathRound: () => Promise<void>;
  onDeleteBySource: (source: string, count: number) => Promise<void>;
  onDeleteAll: () => Promise<void>;
}) => {
  const pop = usePopover();

  return (
    <div class="relative">
      <button
        ref={(el) => pop.setAnchor(el as unknown as HTMLElement)}
        class="px-3 py-1.5 rounded border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
        onClick={pop.togglePopover}
      >
        <span>⚙️</span>
        <span>Actions</span>
      </button>
      <Show when={pop.open()}>
        <div
          ref={(el) => pop.setPopover(el as unknown as HTMLElement)}
          class="absolute right-0 mt-2 w-80 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-3"
        >
          <div class="space-y-3">
            <div>
              <div class="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
                Bulk Actions
              </div>
              <div class="space-y-2">
                <button
                  class="w-full px-3 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50 text-left whitespace-nowrap"
                  onClick={async () => {
                    await props.onProcessPathRound();
                    pop.closePopover();
                  }}
                >
                  Process one path round
                </button>
                <button
                  class="w-full px-3 py-2 rounded bg-gray-700 text-white text-sm hover:bg-gray-800 disabled:opacity-50 text-left"
                  onClick={async () => {
                    await props.onBulkSetSource();
                    pop.closePopover();
                  }}
                >
                  Set Source (All)
                </button>
                <button
                  class="w-full px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 text-left whitespace-nowrap"
                  onClick={async () => {
                    await props.onCleanupTitles();
                    pop.closePopover();
                  }}
                >
                  Clean Bad Titles
                </button>
              </div>
            </div>
            <div class="border-t border-gray-200 pt-3">
              <div class="text-xs font-medium text-red-700 mb-2 uppercase tracking-wide">
                ⚠️ Dangerous Actions
              </div>
              <div class="space-y-2">
                <Show when={props.sources()}>
                  {(data) => (
                    <For each={data().sources}>
                      {(s) => (
                        <button
                          class="w-full px-3 py-2 rounded bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50 text-left whitespace-nowrap"
                          onClick={async () => {
                            await props.onDeleteBySource(
                              s.originalSource,
                              s.count
                            );
                            pop.closePopover();
                          }}
                        >
                          Delete {s.originalSource} ({s.count})
                        </button>
                      )}
                    </For>
                  )}
                </Show>
                <button
                  class="w-full px-3 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50 text-left"
                  onClick={async () => {
                    await props.onDeleteAll();
                    pop.closePopover();
                  }}
                >
                  Delete All
                  <Show when={props.sources()}>
                    {(d) => <span> ({d().total})</span>}
                  </Show>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
