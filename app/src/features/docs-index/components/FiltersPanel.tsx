import { Show, Suspense } from "solid-js";
import { PathEditor } from "~/components/PathEditor";
import { MetaKeySuggestions } from "~/components/MetaKeySuggestions";
import { MetaValueSuggestions } from "~/components/MetaValueSuggestions";
import { createDocsQueryStore } from "../state/docsQuery";

export const FiltersPanel = (props: {
  q: ReturnType<typeof createDocsQueryStore>;
}) => {
  const q = props.q;
  return (
    <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-600 w-24 shrink-0">Path</span>
          <div class="flex-1">
            <PathEditor
              initialPath={q.pathPrefix()}
              onChange={(p) => q.setPathPrefix(p)}
            />
          </div>
        </div>
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-600 w-24 shrink-0">Meta key</span>
          <input
            class="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="tag"
            value={q.metaKey()}
            onInput={(e) =>
              q.setMetaKey((e.currentTarget as HTMLInputElement).value)
            }
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
          />
        </div>
        <Suspense fallback={null}>
          <MetaKeySuggestions onSelect={(key) => q.setMetaKey(key)} />
        </Suspense>
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-600 w-24 shrink-0">Meta value</span>
          <input
            class="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="design"
            value={q.metaValue()}
            onInput={(e) =>
              q.setMetaValue((e.currentTarget as HTMLInputElement).value)
            }
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
          />
          <Show when={q.metaKey().trim() || q.metaValue().trim()}>
            <button
              class="text-xs text-blue-600 hover:underline"
              onClick={() => {
                q.setMetaKey("");
                q.setMetaValue("");
              }}
              title="Clear meta filters"
              type="button"
            >
              Clear
            </button>
          </Show>
        </div>
        <Suspense fallback={null}>
          <MetaValueSuggestions
            keyName={q.metaKey()}
            onSelect={(v) => q.setMetaValue(v)}
          />
        </Suspense>
      </div>
    </div>
  );
};
