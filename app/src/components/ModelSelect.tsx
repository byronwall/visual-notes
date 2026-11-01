import { Suspense } from "solid-js";
import { createKeptAsync } from "~/utils/kept-async";
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
  const models = createKeptAsync(() => fetchAiModels());
  // Called in the JSX, so a first read waits under the Suspense below.
  const items = (): SimpleSelectItem[] => {
    const list: SimpleSelectItem[] = [];
    if (props.placeholderLabel !== undefined) {
      list.push({
        label: props.placeholderLabel,
        value: props.placeholderValue ?? "",
      });
    }
    for (const m of models.latest?.items || []) list.push({ label: m, value: m });
    return list;
  };
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
