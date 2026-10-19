import { Show, createSignal } from "solid-js";
import { Box } from "styled-system/jsx";
import { ArchiveFavicon } from "./ArchiveFavicon";

/**
 * Fixed-size preview tile. Shows the page's social/user image when present,
 * otherwise a quiet favicon tile so rows keep the same rhythm either way.
 */
export const ArchiveThumb = (props: {
  imageUrl?: string | null;
  faviconUrl?: string | null;
  title: string;
  width?: string;
  height?: string;
}) => {
  const [failed, setFailed] = createSignal(false);
  const width = () => props.width ?? "100%";
  const height = () => props.height ?? "auto";

  return (
    <Box
      position="relative"
      aspectRatio="16 / 10"
      borderRadius="l2"
      overflow="hidden"
      bg="bg.subtle"
      display="flex"
      alignItems="center"
      justifyContent="center"
      boxShadow="inset 0 0 0 1px var(--colors-gray-a3)"
      style={{ width: width(), height: height() }}
    >
      <Show
        when={props.imageUrl && !failed()}
        fallback={<ArchiveFavicon src={props.faviconUrl} title={props.title} size="20px" />}
      >
        <img
          src={props.imageUrl!}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            "object-fit": "cover",
            display: "block",
          }}
        />
      </Show>
    </Box>
  );
};
