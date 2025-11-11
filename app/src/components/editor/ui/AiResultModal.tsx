import { createSignal, Show } from "solid-js";
import Modal from "../../Modal";

export type AiResultOpenArgs = {
	selectionText: string;
	outputHtml: string;
};

export function useAiResultModal() {
	const [open, setOpen] = createSignal(false);
	const [selectionText, setSelectionText] = createSignal<string>("");
	const [outputHtml, setOutputHtml] = createSignal<string>("");

	let resolver: (() => void) | undefined;

	const openModal = (args: AiResultOpenArgs) =>
		new Promise<void>((resolve) => {
			console.log("[ai-result-modal] open");
			setSelectionText(args.selectionText || "");
			setOutputHtml(args.outputHtml || "");
			setOpen(true);
			resolver = () => {
				setOpen(false);
				resolve();
			};
		});

	const onClose = () => resolver?.();

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			console.log("[ai-result-modal] copied");
		} catch (e) {
			console.log("[ai-result-modal] copy failed", (e as Error)?.message);
		}
	};

	const onCopySelection = () => copyToClipboard(selectionText());

	const onCopyOutputText = () => {
		// Convert HTML to plain text for copying
		const div = document.createElement("div");
		div.innerHTML = outputHtml();
		copyToClipboard(div.innerText);
	};

	const onCopyOutputHtml = () => copyToClipboard(outputHtml());

	const view = (
		<Modal open={open()} onClose={onClose}>
			<div class="p-4 space-y-3">
				<div class="text-sm font-medium">AI Output</div>
				<div class="space-y-2">
					<div class="text-xs text-gray-600">Selection (used as input)</div>
					<pre class="border rounded p-2 text-xs max-h-40 overflow-auto whitespace-pre-wrap">
						{selectionText()}
					</pre>
					<div class="flex justify-end">
						<button class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50" onClick={onCopySelection}>
							Copy selection
						</button>
					</div>
				</div>
				<div class="space-y-2">
					<div class="text-xs text-gray-600">Output</div>
					<div class="border rounded p-2 max-h-80 overflow-auto prose" innerHTML={outputHtml()} />
					<div class="flex gap-2 justify-end">
						<button class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50" onClick={onCopyOutputText}>
							Copy output (text)
						</button>
						<button class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50" onClick={onCopyOutputHtml}>
							Copy output (HTML)
						</button>
					</div>
				</div>
				<div class="flex justify-end">
					<button class="rounded px-3 py-1.5 border text-xs hover:bg-gray-50" onClick={onClose}>
						Close
					</button>
				</div>
			</div>
		</Modal>
	);

	return { open: openModal, view };
}


