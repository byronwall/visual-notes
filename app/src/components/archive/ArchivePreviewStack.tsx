import { For, Show, createMemo, createSignal } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import {
  openImagePreview,
  openImagePreviewCarousel,
} from "~/components/editor/ui/imagePreviewService";
import { Image } from "~/components/ui/image";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

type Props = {
  socialPreviewImageUrl: string | null;
  userImages: string[];
  title: string;
  width?: string;
  height?: string;
};

function getExpandedOffset(index: number, count: number) {
  if (count <= 1) return { x: 0, y: 0, rotate: -4, scale: 1 };
  if (count === 2) {
    return [
      { x: -34, y: 0, rotate: -10, scale: 0.98 },
      { x: 34, y: 0, rotate: 10, scale: 0.98 },
    ][index]!;
  }
  if (count === 3) {
    return [
      { x: -34, y: 16, rotate: -12, scale: 0.96 },
      { x: 0, y: -24, rotate: -2, scale: 1 },
      { x: 34, y: 16, rotate: 11, scale: 0.96 },
    ][index]!;
  }

  const offsets = [
    { x: -42, y: -16, rotate: -13, scale: 0.95 },
    { x: 0, y: -30, rotate: -3, scale: 1 },
    { x: 42, y: -14, rotate: 12, scale: 0.95 },
    { x: -40, y: 24, rotate: -8, scale: 0.93 },
    { x: 40, y: 24, rotate: 8, scale: 0.93 },
    { x: 0, y: 36, rotate: -1, scale: 0.91 },
  ];
  return offsets[index] ?? offsets[0];
}

export const ArchivePreviewStack = (props: Props) => {
  const [hovered, setHovered] = createSignal(false);
  const [hoveredIndex, setHoveredIndex] = createSignal<number | null>(null);
  const width = () => props.width ?? "112px";
  const height = () => props.height ?? "76px";
  const userImages = createMemo(() => props.userImages.slice(0, 12));
  const displayImages = createMemo(() => userImages().slice(0, 6));
  const hasUserImages = createMemo(() => userImages().length > 0);
  const hiddenCount = createMemo(() => Math.max(0, userImages().length - displayImages().length));

  const stopRowOpen = (event: MouseEvent | PointerEvent) => {
    event.stopPropagation();
  };

  const openPreviewAtIndex = (index: number, event?: MouseEvent | PointerEvent) => {
    event?.stopPropagation();
    if (hasUserImages()) {
      openImagePreviewCarousel({
        images: userImages(),
        index,
        alt: `${props.title} image ${index + 1}`,
        title: props.title,
      });
      return;
    }

    if (props.socialPreviewImageUrl) {
      openImagePreview({
        src: props.socialPreviewImageUrl,
        alt: `${props.title} preview`,
        title: props.title,
      });
    }
  };

  return (
    <Box
      position="relative"
      flexShrink="0"
      overflow="visible"
      zIndex={hovered() ? "20" : "1"}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setHoveredIndex(null);
      }}
      transition="z-index 0s linear 120ms"
      style={{
        width: width(),
        height: height(),
      }}
    >
      <Show
        when={hasUserImages() || props.socialPreviewImageUrl}
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
        <Show
          when={hasUserImages()}
          fallback={
            <Button
              type="button"
              variant="plain"
              p="0"
              h="full"
              w="full"
              borderRadius="l3"
              overflow="hidden"
              borderWidth="1px"
              borderColor="border"
              boxShadow="sm"
              onPointerDown={stopRowOpen}
              onClick={(event) => openPreviewAtIndex(0, event)}
            >
              <Image
                src={props.socialPreviewImageUrl!}
                alt={`${props.title} preview`}
                w="full"
                h="full"
                fit="cover"
              />
            </Button>
          }
        >
          <For each={displayImages()}>
            {(src, index) => {
              const offset = () => getExpandedOffset(index(), displayImages().length);

              return (
                <Button
                  type="button"
                  variant="plain"
                  p="0"
                  position="absolute"
                  top="50%"
                  left="50%"
                  w="84px"
                  h="60px"
                  borderRadius="l3"
                  overflow="hidden"
                  borderWidth="1px"
                  borderColor={hoveredIndex() === index() ? "border.accent" : "border"}
                  bg="bg.default"
                  boxShadow={hoveredIndex() === index() ? "lg" : hovered() ? "md" : "sm"}
                  zIndex={
                    hoveredIndex() === index()
                      ? displayImages().length + 2
                      : displayImages().length - index()
                  }
                  onPointerDown={stopRowOpen}
                  onPointerEnter={() => setHoveredIndex(index())}
                  onFocus={() => setHoveredIndex(index())}
                  onClick={(event) => openPreviewAtIndex(index(), event)}
                  style={{
                    transform: hovered()
                      ? `translate(calc(-50% + ${offset().x}px), calc(-50% + ${offset().y}px)) rotate(${offset().rotate}deg) scale(${
                          hoveredIndex() === index() ? offset().scale + 0.05 : offset().scale
                        })`
                      : `translate(calc(-50% + ${index() * 7}px), calc(-50% + ${index() * 4}px)) rotate(${(index() - 1) * 4}deg) scale(1)`,
                    transition:
                      "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
                  }}
                >
                  <Image
                    src={src}
                    alt={`${props.title} image ${index() + 1}`}
                    w="full"
                    h="full"
                    fit="cover"
                  />
                </Button>
              );
            }}
          </For>
        </Show>

        <Show when={hasUserImages()}>
          <HStack
            position="absolute"
            right="-4px"
            bottom="-4px"
            px="1.5"
            py="0.5"
            borderRadius="full"
            bg="bg.default"
            borderWidth="1px"
            borderColor="border"
            boxShadow="sm"
            gap="1"
            pointerEvents="none"
          >
            <Text fontSize="2xs" fontWeight="medium">
              {userImages().length}
            </Text>
            <Show when={hiddenCount() > 0}>
              <Text fontSize="2xs" color="fg.muted">
                +{hiddenCount()}
              </Text>
            </Show>
          </HStack>
        </Show>
      </Show>
    </Box>
  );
};
