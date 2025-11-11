import { Show, createMemo, createSignal } from "solid-js";
import Modal from "../../Modal";
import TiptapEditor from "../../TiptapEditor";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";
import type { Editor } from "@tiptap/core";

export type AiResultEditorOpenArgs = {
	selectionText: string;
	outputMarkdown: string;
	compiledPrompt?: string;
	systemPrompt?: string;
	[key: string]: unknown;
};

export function useAiResultEditorModal() {
	const [open, setOpen] = createSignal(false);
	const [selectionText, setSelectionText] = createSignal<string>("");
	const [outputMarkdown, setOutputMarkdown] = createSignal<string>("");
	const [editor, setEditor] = createSignal<Editor | undefined>(undefined);
	const [compiledPrompt, setCompiledPrompt] = createSignal<string>("");
	const [systemPrompt, setSystemPrompt] = createSignal<string>("");

	let resolver: (() => void) | undefined;

	const openModal = (args: AiResultEditorOpenArgs) =>
		new Promise<void>((resolve) => {
			console.log("[ai-result-editor-modal] open");
			setSelectionText(args.selectionText || "");
			setOutputMarkdown(args.outputMarkdown || "");
			setCompiledPrompt(args.compiledPrompt || "");
			setSystemPrompt(args.systemPrompt || "");
			setOpen(true);
			resolver = () => {
				setOpen(false);
				resolve();
			};
		});

	const onClose = () => resolver?.();

	const initialHTML = createMemo(() =>
		normalizeMarkdownToHtml(outputMarkdown() || "")
	);

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			console.log("[ai-result-editor-modal] copied");
		} catch (e) {
			console.log("[ai-result-editor-modal] copy failed", (e as Error)?.message);
		}
	};

	const onCopyMarkdown = () => copyToClipboard(outputMarkdown() || "");
	const onCopyHtml = () => {
		const ed = editor();
		const html = ed ? ed.getHTML() : initialHTML();
		copyToClipboard(html);
	};
	const onCopyText = () => {
		const ed = editor();
		const html = ed ? ed.getHTML() : initialHTML();
		const div = document.createElement("div");
		div.innerHTML = html;
		copyToClipboard(div.innerText);
	};

	const view = (
		<Modal open={open()} onClose={onClose}>
			<div class="p-4 space-y-3">
				<div class="text-sm font-medium">AI Output (Editable)</div>
				<details class="border rounded" /* collapsed by default */>
					<summary class="text-xs cursor-pointer px-2 py-1">Prompt</summary>
					<div class="p-2 space-y-2">
						<div>
							<div class="text-[11px] text-gray-600 mb-1">User prompt (compiled)</div>
							<pre class="border rounded p-2 text-[11px] max-h-40 overflow-auto whitespace-pre-wrap">
								{compiledPrompt()}
							</pre>
						</div>
						<Show when={systemPrompt()}>
							{(sp) => (
								<div>
									<div class="text-[11px] text-gray-600 mb-1">System prompt</div>
									<pre class="border rounded p-2 text-[11px] max-h-28 overflow-auto whitespace-pre-wrap">
										{sp()}
									</pre>
								</div>
							)}
						</Show>
					</div>
				</details>
				<details class="border rounded" /* collapsed by default */>
					<summary class="text-xs cursor-pointer px-2 py-1">Selection (used as input)</summary>
					<div class="p-2">
						<pre class="border rounded p-2 text-xs max-h-36 overflow-auto whitespace-pre-wrap">
							{selectionText()}
						</pre>
					</div>
				</details>
				<div class="space-y-2">
					<div class="flex items-center">
						<div class="text-xs text-gray-600">Response</div>
						<div class="ml-auto flex gap-2">
							<button class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50" onClick={onCopyMarkdown}>
								Copy markdown
							</button>
							<button class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50" onClick={onCopyHtml}>
								Copy HTML
							</button>
							<button class="rounded px-2 py-1 border text-[11px] hover:bg-gray-50" onClick={onCopyText}>
								Copy raw text
							</button>
						</div>
					</div>
					<TiptapEditor initialHTML={initialHTML()} onEditor={(ed) => setEditor(ed)} />
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


