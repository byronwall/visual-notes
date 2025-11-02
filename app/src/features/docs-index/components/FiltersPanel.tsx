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
              class="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              onClick={() => {
                q.setMetaKey("");
                q.setMetaValue("");
              }}
              title="Clear meta filters"
              aria-label="Clear meta filters"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="h-4 w-4"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm2.53-10.53a.75.75 0 0 0-1.06-1.06L10 7.94 8.53 6.41a.75.75 0 1 0-1.06 1.06L8.94 9l-1.47 1.47a.75.75 0 1 0 1.06 1.06L10 10.06l1.47 1.47a.75.75 0 1 0 1.06-1.06L11.06 9l1.47-1.47Z"
                  clip-rule="evenodd"
                />
              </svg>
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
