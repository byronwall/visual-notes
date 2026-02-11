import {
  For,
  Show,
  Suspense,
  createMemo,
  createSignal,
} from "solid-js";
import type { VoidComponent } from "solid-js";
import { createAsync } from "@solidjs/router";
import { fetchPathSuggestions } from "~/services/docs.service";
import type { DocsQueryStore } from "../state/docsQuery";
import { Button } from "~/components/ui/button";
import { ClearButton } from "~/components/ui/clear-button";
import { IconButton } from "~/components/ui/icon-button";
import * as ScrollArea from "~/components/ui/scroll-area";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import { Box, Flex, HStack } from "styled-system/jsx";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  ChevronsUpIcon,
  XIcon,
} from "lucide-solid";

type PathCount = { path: string; count: number };

type TreeNode = {
  key: string; // segment label for this level
  prefix: string; // full dot-joined prefix to this node
  count: number; // aggregated count of all descendants + exact
  exactCount: number; // count for an exact path match
  children: Map<string, TreeNode>;
};

function buildTree(items: PathCount[]): TreeNode {
  const root: TreeNode = {
    key: "",
    prefix: "",
    count: 0,
    exactCount: 0,
    children: new Map<string, TreeNode>(),
  };

  for (const { path, count } of items) {
    const tokens = path.split(".").filter((t) => t.length > 0);
    let cursor = root;
    let acc: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const seg = tokens[i];
      acc.push(seg);
      const prefix = acc.join(".");
      if (!cursor.children.has(seg)) {
        cursor.children.set(seg, {
          key: seg,
          prefix,
          count: 0,
          exactCount: 0,
          children: new Map<string, TreeNode>(),
        });
      }
      const next = cursor.children.get(seg)!;
      // Aggregate counts at each prefix level
      next.count += count;
      if (i === tokens.length - 1) {
        next.exactCount += count;
      }
      cursor = next;
    }
    root.count += count;
  }

  return root;
}

function sortChildren(node: TreeNode): void {
  if (node.children.size === 0) return;
  const sorted = [...node.children.values()].sort(
    (a, b) => b.count - a.count || a.key.localeCompare(b.key)
  );
  node.children = new Map(sorted.map((n) => [n.key, n]));
  for (const child of node.children.values()) sortChildren(child);
}

export const PathTreeSidebar: VoidComponent<{ q: DocsQueryStore }> = (
  props
) => {
  const pathCounts = createAsync(() => fetchPathSuggestions());
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({});

  const tree = createMemo(() => {
    const items = (pathCounts() || []) as PathCount[];
    try {
      console.log(`[PathTreeSidebar] loaded ${items.length} paths`);
    } catch {}
    const t = buildTree(items);
    sortChildren(t);
    return t;
  });

  const isExpanded = (prefix: string) => {
    if (!prefix) return true; // root always expanded
    return !!expanded()[prefix];
  };

  const toggleExpanded = (prefix: string) => {
    setExpanded((prev) => ({ ...prev, [prefix]: !prev[prefix] }));
  };

  const expandAll = () => {
    const t = tree();
    const out: Record<string, boolean> = {};
    const visit = (n: TreeNode) => {
      out[n.prefix] = true;
      for (const c of n.children.values()) visit(c);
    };
    visit(t);
    console.log(
      `[PathTreeSidebar] expand all: ${Object.keys(out).length} nodes`
    );
    setExpanded(out);
  };

  const handleSelectPrefix = (prefix: string) => {
    console.log(`[PathTreeSidebar] select prefix="${prefix}"`);
    props.q.setBlankPathOnly(false);
    props.q.setPathPrefix(prefix);
    props.q.resetPaging();
  };

  const NodeRow: VoidComponent<{ node: TreeNode; depth: number }> = (p) => {
    const hasChildren = createMemo(() => p.node.children.size > 0);
    const paddingLeft = createMemo(() => `${p.depth * 12}px`);
    const handleToggle = () => toggleExpanded(p.node.prefix);
    const handleClick = () => handleSelectPrefix(p.node.prefix);

    return (
      <Box px="0.5rem">
        <HStack
          gap="0.25rem"
          py="0.25rem"
          borderRadius="l2"
          _hover={{ bg: "gray.surface.bg.hover" }}
          style={{ "padding-left": paddingLeft() }}
        >
          <IconButton
            size="xs"
            variant="plain"
            onClick={handleToggle}
            aria-label={isExpanded(p.node.prefix) ? "Collapse" : "Expand"}
            disabled={!hasChildren()}
            opacity={hasChildren() ? 1 : 0.4}
          >
            <Show
              when={isExpanded(p.node.prefix)}
              fallback={<ChevronRightIcon size={14} />}
            >
              <ChevronDownIcon size={14} />
            </Show>
          </IconButton>
          <Button
            size="xs"
            variant="plain"
            onClick={handleClick}
            title={p.node.prefix || "(root)"}
            flex="1"
            justifyContent="flex-start"
          >
            {p.node.key || "(root)"}
          </Button>
          <Text
            fontSize="xs"
            color="black.a7"
            fontVariantNumeric="tabular-nums"
          >
            {p.node.count}
          </Text>
        </HStack>
        <Show when={hasChildren() && isExpanded(p.node.prefix)}>
          <Box>
            <For each={[...p.node.children.values()]}>
              {(child) => <NodeRow node={child} depth={p.depth + 1} />}
            </For>
          </Box>
        </Show>
      </Box>
    );
  };

  return (
    <Flex direction="column" h="full" minH="0" bg="white">
      <Box p="0.5rem" borderBottomWidth="1px" borderColor="gray.outline.border">
        <Text
          fontSize="xs"
          fontWeight="semibold"
          textTransform="uppercase"
          color="black.a7"
        >
          Paths
        </Text>
        <HStack gap="0.5rem" mt="0.5rem" alignItems="center">
          <ClearButton
            variant="outline"
            label="Clear path filter"
            onClick={() => {
              console.log("[PathTreeSidebar] clear prefix");
              props.q.setPathPrefix("");
              props.q.setBlankPathOnly(false);
              props.q.resetPaging();
            }}
          >
            <XIcon size={14} />
          </ClearButton>
          <HStack gap="0.5rem" ml="auto">
            <Tooltip content="Expand all">
              <IconButton
                size="xs"
                variant="outline"
                aria-label="Expand all"
                onClick={expandAll}
              >
                <ChevronsRightIcon size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip content="Collapse all">
              <IconButton
                size="xs"
                variant="outline"
                aria-label="Collapse all"
                onClick={() => setExpanded({})}
              >
                <ChevronsUpIcon size={14} />
              </IconButton>
            </Tooltip>
          </HStack>
        </HStack>
      </Box>
      <Box flex="1" minH="0">
        <ScrollArea.Root h="full">
          <ScrollArea.Viewport>
            <ScrollArea.Content>
              <Suspense
                fallback={
                  <Box p="0.5rem">
                    <Text fontSize="sm" color="black.a7">
                      Loading paths…
                    </Text>
                  </Box>
                }
              >
                <Box py="0.5rem">
                  <For each={[...tree().children.values()]}>
                    {(child) => <NodeRow node={child} depth={0} />}
                  </For>
                </Box>
              </Suspense>
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </Box>
    </Flex>
  );
};

export default PathTreeSidebar;
