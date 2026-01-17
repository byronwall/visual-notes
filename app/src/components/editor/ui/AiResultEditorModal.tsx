import { Show, createMemo, createSignal } from "solid-js";
import TiptapEditor from "../../TiptapEditor";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";
import type { Editor } from "@tiptap/core";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";
import * as Collapsible from "~/components/ui/collapsible";
import * as Dialog from "~/components/ui/dialog";
import { css } from "styled-system/css";
import { XIcon } from "lucide-solid";

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
		<Dialog.Root
			open={open()}
			onOpenChange={(details: { open?: boolean }) => {
				if (details?.open === false) onClose();
			}}
		>
			<Dialog.Backdrop />
			<Dialog.Positioner>
				<Dialog.Content
					class={css({
						maxW: "980px",
						"--dialog-base-margin": "24px",
					})}
				>
					<Dialog.Header>
						<Dialog.Title>AI Output (Editable)</Dialog.Title>
					</Dialog.Header>

					<Dialog.CloseTrigger aria-label="Close dialog" onClick={onClose}>
						<XIcon />
					</Dialog.CloseTrigger>

					<Dialog.Body>
						<Stack gap="3">
							<Collapsible.Root>
								<Collapsible.Trigger>
									<HStack w="full" justifyContent="space-between" gap="2">
										<Text fontSize="xs" fontWeight="medium">
											Prompt
										</Text>
										<Collapsible.Indicator />
									</HStack>
								</Collapsible.Trigger>
								<Collapsible.Content>
									<Stack gap="2">
										<Stack gap="1">
											<Text fontSize="xs" color="fg.muted">
												User prompt (compiled)
											</Text>
											<Box
												as="pre"
												borderWidth="1px"
												borderColor="gray.outline.border"
												borderRadius="l2"
												p="2"
												fontSize="xs"
												maxH="10rem"
												overflow="auto"
												whiteSpace="pre-wrap"
											>
												{compiledPrompt()}
											</Box>
										</Stack>
										<Show when={systemPrompt()}>
											{(sp) => (
												<Stack gap="1">
													<Text fontSize="xs" color="fg.muted">
														System prompt
													</Text>
													<Box
														as="pre"
														borderWidth="1px"
														borderColor="gray.outline.border"
														borderRadius="l2"
														p="2"
														fontSize="xs"
														maxH="7rem"
														overflow="auto"
														whiteSpace="pre-wrap"
													>
														{sp()}
													</Box>
												</Stack>
											)}
										</Show>
									</Stack>
								</Collapsible.Content>
							</Collapsible.Root>

							<Collapsible.Root>
								<Collapsible.Trigger>
									<HStack w="full" justifyContent="space-between" gap="2">
										<Text fontSize="xs" fontWeight="medium">
											Selection (used as input)
										</Text>
										<Collapsible.Indicator />
									</HStack>
								</Collapsible.Trigger>
								<Collapsible.Content>
									<Box
										as="pre"
										borderWidth="1px"
										borderColor="gray.outline.border"
										borderRadius="l2"
										p="2"
										fontSize="xs"
										maxH="9rem"
										overflow="auto"
										whiteSpace="pre-wrap"
									>
										{selectionText()}
									</Box>
								</Collapsible.Content>
							</Collapsible.Root>

							<Stack gap="2">
								<HStack alignItems="center">
									<Text fontSize="xs" color="fg.muted">
										Response
									</Text>
									<HStack gap="2" ml="auto">
										<Button
											size="xs"
											variant="outline"
											colorPalette="gray"
											onClick={onCopyMarkdown}
										>
											Copy markdown
										</Button>
										<Button
											size="xs"
											variant="outline"
											colorPalette="gray"
											onClick={onCopyHtml}
										>
											Copy HTML
										</Button>
										<Button
											size="xs"
											variant="outline"
											colorPalette="gray"
											onClick={onCopyText}
										>
											Copy raw text
										</Button>
									</HStack>
								</HStack>
								<TiptapEditor
									initialHTML={initialHTML()}
									onEditor={(ed) => setEditor(ed)}
								/>
							</Stack>
						</Stack>
					</Dialog.Body>

					<Dialog.Footer>
						<HStack justifyContent="flex-end" w="full">
							<Button
								size="sm"
								variant="outline"
								colorPalette="gray"
								onClick={onClose}
							>
								Close
							</Button>
						</HStack>
					</Dialog.Footer>
				</Dialog.Content>
			</Dialog.Positioner>
		</Dialog.Root>
	);

	return { open: openModal, view };
}

