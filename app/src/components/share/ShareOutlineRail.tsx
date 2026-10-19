import { For, createSignal, onCleanup, onMount } from "solid-js";
import { Box, styled } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import type { ShareOutlineItem } from "./share-reading";

type ShareOutlineRailProps = {
  items: ShareOutlineItem[];
};

export const ShareOutlineRail = (props: ShareOutlineRailProps) => {
  const [activeId, setActiveId] = createSignal<string | null>(null);

  // Scroll-spy is a progressive enhancement: the rail renders identically on
  // the server and only gains an active marker once headings are observable.
  onMount(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const headings = props.items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (headings.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const firstVisible = props.items.find((item) => visible.has(item.id));
        if (firstVisible) {
          setActiveId(firstVisible.id);
          return;
        }
        const above = headings.filter(
          (el) => el.getBoundingClientRect().top < 0,
        );
        setActiveId(above.length > 0 ? above[above.length - 1].id : null);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    headings.forEach((el) => observer.observe(el));
    onCleanup(() => observer.disconnect());
  });

  return (
    <Box as="nav" aria-label="On this page" position="sticky" top="8">
      <Text
        fontSize="xs"
        fontWeight="semibold"
        color="fg.muted"
        mb="2"
        letterSpacing="0.02em"
      >
        On this page
      </Text>
      <Box as="ul" display="grid" gap="0.5">
        <For each={props.items}>
          {(item) => (
            <li>
              <styled.a
                href={`#${item.id}`}
                display="block"
                py="1"
                pl={item.level === 3 ? "5" : "2"}
                pr="2"
                borderRadius="l2"
                fontSize="sm"
                lineHeight="1.35"
                color={activeId() === item.id ? "fg.default" : "fg.muted"}
                fontWeight={activeId() === item.id ? "medium" : "normal"}
                bg={activeId() === item.id ? "bg.muted" : "transparent"}
                transitionProperty="color, background-color"
                transitionDuration="140ms"
                _hover={{ color: "fg.default", bg: "bg.subtle" }}
                aria-current={activeId() === item.id ? "location" : undefined}
              >
                {item.text}
              </styled.a>
            </li>
          )}
        </For>
      </Box>
    </Box>
  );
};
