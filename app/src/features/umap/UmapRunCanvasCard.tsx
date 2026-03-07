import { RotateCcwIcon } from "lucide-solid";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { IconButton } from "~/components/ui/icon-button";
import { Link } from "~/components/ui/link";
import { Tooltip } from "~/components/ui/tooltip";
import { Box, Flex, HStack } from "styled-system/jsx";

type UmapRunCanvasCardProps = {
  dims: number;
  pointsCount: number;
  busy: boolean;
  onRefresh: () => void;
  onDelete: () => void;
  setCanvasContainerEl: (el: HTMLDivElement) => void;
  setCanvasEl: (el: HTMLCanvasElement) => void;
};

export function UmapRunCanvasCard(props: UmapRunCanvasCardProps) {
  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="l3" overflow="hidden">
      <Flex
        align="center"
        justify="space-between"
        gap="3"
        flexWrap="wrap"
        px="4"
        py="3"
        borderBottomWidth="1px"
        borderColor="border"
      >
        <HStack gap="2" flexWrap="wrap">
          <Heading as="h1" fontSize="xl">
            UMAP Run
          </Heading>
          <Badge colorPalette="blue">{props.dims}D</Badge>
          <Badge colorPalette="gray">{props.pointsCount.toLocaleString()} points</Badge>
        </HStack>

        <HStack gap="2" flexWrap="wrap">
          <Tooltip content="Refresh points" showArrow>
            <IconButton
              size="xs"
              variant="outline"
              aria-label="Refresh points"
              onClick={props.onRefresh}
            >
              <RotateCcwIcon size={12} />
            </IconButton>
          </Tooltip>
          <Link href="/umap">Back to UMAP</Link>
          <Button
            size="sm"
            variant="solid"
            colorPalette="red"
            loading={props.busy}
            onClick={props.onDelete}
          >
            Delete Run
          </Button>
        </HStack>
      </Flex>

      <Box
        ref={props.setCanvasContainerEl}
        w="full"
        style={{ height: "clamp(360px, calc(100vh - 200px), 860px)" }}
      >
        <canvas ref={props.setCanvasEl} />
      </Box>
    </Box>
  );
}
