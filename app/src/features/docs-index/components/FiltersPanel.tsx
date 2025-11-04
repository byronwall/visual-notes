import { Show, Suspense } from "solid-js";
import { PathEditor } from "~/components/PathEditor";
import { MetaKeySuggestions } from "~/components/MetaKeySuggestions";
import { MetaValueSuggestions } from "~/components/MetaValueSuggestions";
import { createDocsQueryStore } from "../state/docsQuery";
import { DateInput } from "~/components/DateInput";

export const FiltersPanel = (props: {
  q: ReturnType<typeof createDocsQueryStore>;
  sources?: { originalSource: string; count: number }[];
}) => {
  const q = props.q;
  return (
    <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-600 w-24 shrink-0">Path</span>

          <div class="flex flex-col gap-1">
            <div
              class={`flex-1 ${
                q.blankPathOnly() ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <PathEditor
                initialPath={q.pathPrefix()}
                onChange={(p) => q.setPathPrefix(p)}
              />
            </div>
            <label class="flex items-center gap-1 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={q.blankPathOnly()}
                onChange={(e) => {
                  const checked = (e.currentTarget as HTMLInputElement).checked;
                  q.setBlankPathOnly(checked);
                  if (checked) q.setPathPrefix("");
                }}
              />
              <span>Blank only</span>
            </label>
          </div>
        </div>
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-600 w-24 shrink-0">Original ID</span>
          <input
            class="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="contains…"
            value={q.originalContentId()}
            onInput={(e) =>
              q.setOriginalContentId((e.currentTarget as HTMLInputElement).value)
            }
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
          />
          <Show when={q.originalContentId().trim()}>
            <button
              class="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              onClick={() => q.setOriginalContentId("")}
              title="Clear original content ID filter"
              aria-label="Clear original content ID filter"
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
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-600 w-24 shrink-0">Source</span>
          <select
            class="flex-1 border rounded px-2 py-1 text-sm"
            value={q.source()}
            onChange={(e) =>
              q.setSource((e.currentTarget as HTMLSelectElement).value)
            }
          >
            <option value="">All</option>
            {props.sources?.map((s) => (
              <option value={s.originalSource}>{s.originalSource}</option>
            ))}
          </select>
          <Show when={q.source().trim()}>
            <button
              class="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              onClick={() => q.setSource("")}
              title="Clear source filter"
              aria-label="Clear source filter"
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
      </div>
      <div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-gray-600">Created</span>
          <div class="flex flex-col items-center gap-2">
            <DateInput
              value={q.createdFrom() || undefined}
              onChange={(v) => q.setCreatedFrom(v)}
              aria-label="Created from"
            />

            <DateInput
              value={q.createdTo() || undefined}
              onChange={(v) => q.setCreatedTo(v)}
              aria-label="Created to"
            />
            <Show when={(q.createdFrom() || q.createdTo())?.trim?.()}>
              <button
                class="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                onClick={() => {
                  q.setCreatedFrom(undefined);
                  q.setCreatedTo(undefined);
                }}
                title="Clear created date range"
                aria-label="Clear created date range"
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
        </div>
      </div>
      <div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-gray-600">Updated</span>
          <div class="flex flex-col items-center gap-2">
            <DateInput
              value={q.updatedFrom() || undefined}
              onChange={(v) => q.setUpdatedFrom(v)}
              aria-label="Updated from"
            />
            <DateInput
              value={q.updatedTo() || undefined}
              onChange={(v) => q.setUpdatedTo(v)}
              aria-label="Updated to"
            />
            <Show when={(q.updatedFrom() || q.updatedTo())?.trim?.()}>
              <button
                class="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                onClick={() => {
                  q.setUpdatedFrom(undefined);
                  q.setUpdatedTo(undefined);
                }}
                title="Clear updated date range"
                aria-label="Clear updated date range"
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
        </div>
      </div>
    </div>
  );
};
