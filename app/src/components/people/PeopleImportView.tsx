import { A, useAction, useSearchParams } from "@solidjs/router";
import { UploadIcon } from "lucide-solid";
import { For, Show, createEffect, createSignal, on } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  type ImportMapping,
} from "~/lib/people/import-mapping";
import {
  applyImportAction,
  previewImportAction,
  setImportMappingAction,
} from "~/services/people/people.actions";
import {
  fetchImportPlan,
  fetchImports,
} from "~/services/people/people.queries";
import { createKeptAsync } from "~/utils/kept-async";
import { saveErrorText } from "./capture-state";
import { ImportRows } from "./ImportRows";

type Plan = Awaited<ReturnType<typeof fetchImportPlan>>;

const panel = css({ display: "flex", flexDirection: "column", gap: "4" });
const mappingGrid = css({
  display: "grid",
  gap: "2",
  gridTemplateColumns: { base: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" },
});
const fieldLabel = css({ fontSize: "xs", color: "fg.subtle", mb: "1" });
const muted = css({ fontSize: "sm", color: "fg.muted" });
const error = css({ fontSize: "sm", color: "red.11" });
const result = css({
  p: "3",
  borderRadius: "l2",
  bg: "bg.subtle",
  fontSize: "sm",
});
const recent = css({
  fontSize: "sm",
  display: "flex",
  flexDirection: "column",
  gap: "1",
});

/** Upload a CSV, map its columns, review every row, then apply. */
export function PeopleImportView() {
  const [params, setParams] = useSearchParams();
  const importId = () => (typeof params.id === "string" ? params.id : "");
  const [plan, setPlan] = createSignal<Plan | null>(null);
  const [choices, setChoices] = createSignal<Record<number, string>>({});
  const [source, setSource] = createSignal("csv");
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [done, setDone] = createSignal<{
    applied: number;
    failed: number;
    skipped: number;
  } | null>(null);
  const preview = useAction(previewImportAction);
  const remap = useAction(setImportMappingAction);
  const apply = useAction(applyImportAction);
  const imports = createKeptAsync(() => fetchImports());
  let fileInput: HTMLInputElement | undefined;

  // A refresh or a recent-import link reloads the plan from the URL.
  createEffect(
    on(importId, (id) => {
      if (!id || plan()?.id === id) return;
      void fetchImportPlan({ id })
        .then(setPlan)
        .catch(() => setMessage("That import was not found."));
    }),
  );

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (err) {
      console.warn("[people] import step failed", err);
      setMessage(saveErrorText(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const src = source();
    void run(async () => {
      const content = await file.text();
      const next = await preview({ source: src, fileName: file.name, content });
      setPlan(next);
      setChoices({});
      setDone(null);
      setParams({ id: next.id });
    }, "Could not read that file. Check that it is a CSV with a header row.");
  };

  const setField = (field: (typeof IMPORT_FIELDS)[number], header: string) => {
    const p = plan();
    if (!p) return;
    const mapping: ImportMapping = {
      ...p.mapping,
      [field]: header || undefined,
    };
    void run(async () => {
      setPlan(await remap({ id: p.id, mapping }));
    }, "Could not change the mapping.");
  };

  const applyAll = () => {
    const p = plan();
    if (!p) return;
    const picked = choices();
    void run(async () => {
      const r = await apply({ id: p.id, choices: picked });
      setDone({ applied: r.applied, failed: r.failed, skipped: r.skipped });
      setPlan(r.plan);
    }, "Could not apply the import. Applied rows are kept; try again.");
  };

  const open = () => (plan()?.rows ?? []).filter((r) => r.status !== "applied");
  const pending = () => open().filter((r) => r.outcome !== "invalid").length;
  const tally = (outcomes: string[]) =>
    open().filter((r) => outcomes.includes(r.outcome)).length;
  const applyLabel = () => {
    const parts = [
      `${tally(["create"])} new`,
      `${tally(["update", "conflict"])} to update`,
    ];
    const chosen = open().filter(
      (r) => r.outcome === "candidates" && choices()[r.rowIndex],
    ).length;
    if (chosen) parts.push(`${chosen} chosen`);
    return `Apply: ${parts.join(", ")}`;
  };

  return (
    <div class={panel}>
      <HStack gap="3" alignItems="flex-end" flexWrap="wrap">
        <Field.Root w="12rem">
          <Field.Label for="import-source">Source name</Field.Label>
          <Input
            id="import-source"
            size="sm"
            value={source()}
            onInput={(e) => setSource(e.currentTarget.value)}
          />
        </Field.Root>
        {/* The native input stays hidden; the button opens it. */}
        <input
          id="import-file"
          type="file"
          accept=".csv,text/csv"
          hidden
          ref={fileInput}
          onChange={(e) => {
            onFile(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          loading={busy()}
          onClick={() => fileInput?.click()}
        >
          <UploadIcon size={14} /> Choose CSV file
        </Button>
      </HStack>
      <p class={muted}>
        Use the same source name each time you import from one place, so repeat
        imports find the same people. Nothing is saved to profiles until you
        apply.
      </p>
      <Show when={message()}>
        <p class={error} role="alert">
          {message()}
        </p>
      </Show>

      <Show
        when={plan()}
        fallback={
          <Show when={imports.latest?.length}>
            <div class={recent}>
              <strong>Recent imports</strong>
              <For each={imports.latest}>
                {(i) => (
                  <A href={`/people/import?id=${i.id}`}>
                    {i.fileName} · {i.source} ·{" "}
                    {i.appliedAt ? "applied" : "not applied"}
                  </A>
                )}
              </For>
            </div>
          </Show>
        }
      >
        {(p) => (
          <>
            <div>
              <div class={fieldLabel}>
                {p().fileName} · {p().rows.length} rows · source “{p().source}”
              </div>
              <div class={mappingGrid}>
                <For each={IMPORT_FIELDS}>
                  {(f) => (
                    <div>
                      <div class={fieldLabel}>{IMPORT_FIELD_LABELS[f]}</div>
                      <SimpleSelect
                        size="sm"
                        skipPortal={false}
                        items={[
                          { label: "Not mapped", value: "" },
                          ...p().headers.map((h) => ({ label: h, value: h })),
                        ]}
                        value={p().mapping[f] ?? ""}
                        onChange={(v) => setField(f, v)}
                      />
                    </div>
                  )}
                </For>
              </div>
            </div>
            <Show when={done()}>
              {(d) => (
                <div class={result} role="status">
                  Applied {d().applied}, skipped {d().skipped}, failed{" "}
                  {d().failed}. Run apply again to retry failed rows; applied
                  rows are never written twice.
                </div>
              )}
            </Show>
            <HStack gap="3">
              <Button loading={busy()} disabled={!pending()} onClick={applyAll}>
                {applyLabel()}
              </Button>
              <span class={muted}>
                Rows that need a choice are skipped until you choose. Existing
                values are kept.
              </span>
            </HStack>
            <ImportRows
              rows={p().rows}
              choices={choices()}
              onChoose={(row, value) => {
                const next = { ...choices() };
                if (value) next[row] = value;
                else delete next[row];
                setChoices(next);
              }}
            />
          </>
        )}
      </Show>
    </div>
  );
}
