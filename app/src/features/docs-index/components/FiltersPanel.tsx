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
        <label class="block text-xs text-gray-600 mb-1">Path prefix</label>
        <PathEditor
          initialPath={q.pathPrefix()}
          onChange={(p) => q.setPathPrefix(p)}
        />
      </div>
      <div>
        <label class="block text-xs text-gray-600 mb-1">Meta key</label>
        <input
          class="w-full border rounded px-2 py-1 text-sm"
          placeholder="tag"
          value={q.metaKey()}
          onInput={(e) =>
            q.setMetaKey((e.currentTarget as HTMLInputElement).value)
          }
        />
        <Suspense fallback={null}>
          <MetaKeySuggestions onSelect={(key) => q.setMetaKey(key)} />
        </Suspense>
      </div>
      <div>
        <div class="flex items-center justify-between">
          <label class="block text-xs text-gray-600 mb-1">Meta value</label>
          <Show when={q.metaKey().trim() || q.metaValue().trim()}>
            <button
              class="text-xs text-blue-600 hover:underline"
              onClick={() => {
                q.setMetaKey("");
                q.setMetaValue("");
              }}
              title="Clear meta filters"
            >
              Clear
            </button>
          </Show>
        </div>
        <input
          class="w-full border rounded px-2 py-1 text-sm"
          placeholder="design"
          value={q.metaValue()}
          onInput={(e) =>
            q.setMetaValue((e.currentTarget as HTMLInputElement).value)
          }
        />
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
