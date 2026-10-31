import { onMount } from "solid-js";
import { useLLMSidebar } from "./LLMSidebar";

export type LLMSidebarApi = ReturnType<typeof useLLMSidebar>;

type LLMSidebarHostProps = {
  threadId?: string;
  onReady: (api: LLMSidebarApi) => void;
};

/**
 * Loaded on the first chat open, so the shell does not carry the editor stack.
 * The sidebar fetches no threads until that first open, so nothing is lost.
 */
export default function LLMSidebarHost(props: LLMSidebarHostProps) {
  const api = useLLMSidebar();
  onMount(() => {
    api.open(props.threadId);
    props.onReady(api);
  });
  return api.view;
}
