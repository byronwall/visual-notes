import { Suspense, createMemo } from "solid-js";
import { createAsync } from "@solidjs/router";
import type { SimpleSelectItem } from "~/components/ui/simple-select";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Text } from "~/components/ui/text";
import { fetchAiModels } from "~/services/ai/ai-models.queries";

export function ModelSelect(props: {
  value?: string;
  onChange: (value: string) => void;
  placeholderLabel?: string;
  placeholderValue?: string;
}) {
  const models = createAsync(() => fetchAiModels());
  const items = createMemo<SimpleSelectItem[]>(() => {
    const list: SimpleSelectItem[] = [];
    if (props.placeholderLabel !== undefined) {
      list.push({
        label: props.placeholderLabel,
        value: props.placeholderValue ?? "",
      });
    }
    for (const m of models()?.items || []) list.push({ label: m, value: m });
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
