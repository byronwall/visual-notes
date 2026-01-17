import { For, Suspense, createMemo, createResource } from "solid-js";
import { Portal } from "solid-js/web";
import { apiFetch } from "~/utils/base-url";
import * as Select from "~/components/ui/select";
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
	type SelectItem = { label: string; value: string };
	const collection = createMemo(() => {
		const items: SelectItem[] = [];
		if (props.placeholderLabel !== undefined) {
			items.push({
				label: props.placeholderLabel,
				value: props.placeholderValue ?? "",
			});
		}
		for (const m of models() || []) items.push({ label: m, value: m });
		return Select.createListCollection<SelectItem>({ items });
	});
	return (
		<Suspense
			fallback={
				<Text fontSize="xs" color="fg.muted">
					Loading models…
				</Text>
			}
		>
			<Select.Root
				collection={collection()}
				value={[props.value ?? ""]}
				onValueChange={(details) => props.onChange(details.value[0] || "")}
				size="sm"
			>
				<Select.Control>
					<Select.Trigger>
						<Select.ValueText placeholder="Select model" />
						<Select.Indicator />
					</Select.Trigger>
				</Select.Control>
				<Portal>
					<Select.Positioner>
						<Select.Content>
							<Select.List>
								<For each={collection().items}>
									{(opt) => (
										<Select.Item item={opt}>
											<Select.ItemText>{opt.label}</Select.ItemText>
											<Select.ItemIndicator />
										</Select.Item>
									)}
								</For>
							</Select.List>
						</Select.Content>
					</Select.Positioner>
				</Portal>
				<Select.HiddenSelect />
			</Select.Root>
		</Suspense>
	);
}
