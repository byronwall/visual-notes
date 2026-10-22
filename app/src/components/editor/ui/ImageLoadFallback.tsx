import { ImageOffIcon, RefreshCwIcon, UploadIcon } from "lucide-solid";
import { Show } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import {
  currentOrigin,
  imageSourceHost,
  importableImageSrc,
} from "../images/transferImages";

type Props = {
  src: string;
  alt: string;
  onReplace: (file: File) => void;
  onRetry: (src: string) => void;
};

const cardClass = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  columnGap: "3",
  rowGap: "2",
  px: "4",
  py: "3",
  borderRadius: "l2",
  borderWidth: "1px",
  borderStyle: "dashed",
  borderColor: "gray.outline.border",
  bg: "gray.surface.bg",
  color: "fg.muted",
  fontSize: "sm",
  minWidth: "0",
});

/** Shown in place of an image whose src would not load. */
export function ImageLoadFallback(props: Props) {
  const host = () => imageSourceHost(props.src);
  const canRetry = () =>
    importableImageSrc(props.src, currentOrigin()) === "remote";

  const pickFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) props.onReplace(file);
    });
    input.click();
  };

  return (
    <div class={cardClass} data-image-action="true" contentEditable={false}>
      <ImageOffIcon size={20} aria-hidden="true" />
      <div class={css({ flex: "1 1 12rem", minWidth: "0" })}>
        <div class={css({ color: "fg.default", fontWeight: "medium" })}>
          {props.alt || "Image"} didn't load
        </div>
        <div class={css({ truncate: true })} title={props.src}>
          {host()
            ? `${host()} wouldn't share it. Paste the image itself here to replace it.`
            : "Paste or choose the image again to replace it."}
        </div>
      </div>
      <div class={css({ display: "flex", gap: "1", marginLeft: "auto" })}>
        <Show when={canRetry()}>
          <Button
            size="xs"
            variant="plain"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => props.onRetry(props.src)}
          >
            <RefreshCwIcon size={12} /> Retry
          </Button>
        </Show>
        <Button
          size="xs"
          variant="outline"
          onMouseDown={(event) => event.preventDefault()}
          onClick={pickFile}
        >
          <UploadIcon size={12} /> Replace…
        </Button>
      </div>
    </div>
  );
}
