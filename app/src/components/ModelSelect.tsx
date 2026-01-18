import { Suspense, createMemo, createResource } from "solid-js";
import { apiFetch } from "~/utils/base-url";
import type { SimpleSelectItem } from "~/components/ui/simple-select";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Text } from "~/components/ui/text";

type ModelsResponse = { items: string[] };

async function fetchModels(): Promise<string[]> {
  const res = await apiFetch("/api/ai/models");
  const data = (await res.json()) as ModelsResponse;
  return data.items || [];
}

export function ModelSelect(props: {
  value?: string;
  onChange: (value: string) => void;
  placeholderLabel?: string;
  placeholderValue?: string;
}) {
  const [models] = createResource(fetchModels);
  const items = createMemo<SimpleSelectItem[]>(() => {
    const list: SimpleSelectItem[] = [];
    if (props.placeholderLabel !== undefined) {
      list.push({
        label: props.placeholderLabel,
        value: props.placeholderValue ?? "",
      });
    }
    for (const m of models() || []) list.push({ label: m, value: m });
    return list;
  });
  return (
    <Suspense
      fallback={
        <Text fontSize="xs" color="fg.muted">
          Loading models…
        </Text>
      }
    >
      <SimpleSelect
        items={items()}
        value={props.value ?? ""}
        onChange={(value) => props.onChange(value)}
        size="sm"
        placeholder="Select model"
      />
    </Suspense>
  );
}
