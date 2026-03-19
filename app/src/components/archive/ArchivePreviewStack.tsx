import { For, Show } from "solid-js";
import { Box } from "styled-system/jsx";
import { Image } from "~/components/ui/image";
import { Text } from "~/components/ui/text";

export const ArchivePreviewStack = (props: {
  images: string[];
  title: string;
  width?: string;
  height?: string;
}) => {
  const width = () => props.width ?? "104px";
  const height = () => props.height ?? "72px";
  const layers = () => props.images.slice(0, 3);

  return (
    <Box
      position="relative"
      flexShrink="0"
      style={{
        width: width(),
        height: height(),
      }}
    >
      <Show
        when={layers().length > 0}
        fallback={
          <Box
            w="full"
            h="full"
            borderRadius="l3"
            borderWidth="1px"
            borderColor="border"
            bg="bg.subtle"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize="xs" color="fg.muted">
              No image
            </Text>
          </Box>
        }
      >
        <For each={layers()}>
          {(src, index) => (
            <Box
              position="absolute"
              inset="0"
              borderRadius="l3"
              overflow="hidden"
              borderWidth="1px"
              borderColor="border"
              bg="bg.default"
              boxShadow="sm"
              style={{
                left: `${index() * 8}px`,
                top: `${index() * 4.4}px`,
                right: `${index() * 8}px`,
                bottom: `${index() * 2.8}px`,
              }}
            >
              <Image
                src={src}
                alt={`${props.title} preview ${index() + 1}`}
                w="full"
                h="full"
                fit="cover"
              />
            </Box>
          )}
        </For>
      </Show>
    </Box>
  );
};
