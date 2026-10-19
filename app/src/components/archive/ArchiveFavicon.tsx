import { Show } from "solid-js";
import { Box } from "styled-system/jsx";
import { Image } from "~/components/ui/image";
import { Text } from "~/components/ui/text";

export const ArchiveFavicon = (props: {
  src?: string | null;
  title: string;
  size?: string;
}) => {
  const size = () => props.size ?? "18px";

  return (
    <Box
      borderRadius="l1"
      overflow="hidden"
      bg="bg.subtle"
      boxShadow={props.src ? undefined : "inset 0 0 0 1px var(--colors-gray-a4)"}
      flexShrink="0"
      display="flex"
      alignItems="center"
      justifyContent="center"
      style={{
        width: size(),
        height: size(),
        "min-width": size(),
        "min-height": size(),
        "max-width": size(),
        "max-height": size(),
      }}
    >
      <Show
        when={props.src}
        fallback={
          <Text
            color="fg.muted"
            fontWeight="semibold"
            textTransform="uppercase"
            lineHeight="1"
            style={{ "font-size": `calc(${size()} * 0.55)` }}
          >
            {props.title.trim().slice(0, 1) || "?"}
          </Text>
        }
      >
        {(src) => (
          <Image
            src={src()}
            alt={`${props.title} favicon`}
            display="block"
            fit="contain"
            style={{
              width: size(),
              height: size(),
              "min-width": size(),
              "min-height": size(),
              "max-width": size(),
              "max-height": size(),
              display: "block",
            }}
          />
        )}
      </Show>
    </Box>
  );
};
