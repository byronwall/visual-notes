import { CheckIcon, LinkIcon } from "lucide-solid";
import { Show, createSignal, onCleanup } from "solid-js";
import { Button } from "~/components/ui/button";

type ShareCopyLinkButtonProps = {
  url: string;
};

export const ShareCopyLinkButton = (props: ShareCopyLinkButtonProps) => {
  const [copied, setCopied] = createSignal(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(resetTimer));

  const handleCopy = async () => {
    const value = props.url || window.location.href;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.warn("[share-page] copy link failed", error);
      window.prompt("Copy this link", value);
    }
  };

  return (
    <Button
      variant="plain"
      size="sm"
      color="fg.muted"
      _hover={{ color: "fg.default", bg: "bg.muted" }}
      onClick={() => void handleCopy()}
      aria-live="polite"
      data-copied={copied() ? "true" : undefined}
    >
      <Show when={copied()} fallback={<LinkIcon size={15} />}>
        <CheckIcon size={15} />
      </Show>
      Copy link
    </Button>
  );
};
