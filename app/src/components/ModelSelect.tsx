import { Suspense, createResource } from "solid-js";
import { apiFetch } from "~/utils/base-url";

type ModelsResponse = { items: string[] };

async function fetchModels(): Promise<string[]> {
	const res = await apiFetch("/api/ai/models");
	const data = (await res.json()) as ModelsResponse;
	return data.items || [];
}

export function ModelSelect(props: {
	value?: string;
	onChange: (value: string) => void;
	class?: string;
	placeholderLabel?: string;
	placeholderValue?: string;
}) {
	const [models] = createResource(fetchModels);
	return (
		<Suspense fallback={<div class="text-xs text-gray-500">Loading models…</div>}>
			<select
				class={props.class || "border rounded px-2 py-1 text-sm w-full"}
				value={props.value ?? ""}
				onChange={(e) => props.onChange((e.target as HTMLSelectElement).value)}
			>
				{props.placeholderLabel !== undefined ? (
					<option value={props.placeholderValue ?? ""}>{props.placeholderLabel}</option>
				) : null}
				{(models() || []).map((m) => (
					<option value={m}>{m}</option>
				))}
			</select>
		</Suspense>
	);
}


