import { Show, createEffect, onCleanup } from "solid-js";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { HStack } from "styled-system/jsx";

/** Loads the next page as the end of the list nears; the button is a fallback. */
export const LoadMoreButton = (props: {
  shown: number;
  total: number;
  loading?: boolean;
  onLoadMore: () => void;
}) => {
  let el: HTMLDivElement | undefined;
  const hasMore = () => props.total > props.shown;

  createEffect(() => {
    if (!hasMore() || !el || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) props.onLoadMore();
      },
      { rootMargin: "600px 0px" },
    );
    // Re-observe after each page so a still-visible sentinel keeps loading.
    void props.shown;
    observer.observe(el);
    onCleanup(() => observer.disconnect());
  });

  return (
    <Show when={hasMore()}>
      <HStack
        ref={el}
        gap="3"
        py="3"
        fontSize="xs"
        color="fg.muted"
        fontVariantNumeric="tabular-nums"
      >
        <span>
          {props.shown.toLocaleString()} of {props.total.toLocaleString()}
        </span>
        {/* Same footprint while loading, so the list end does not jump. */}
        <Button
          variant="plain"
          size="xs"
          disabled={props.loading}
          onClick={props.onLoadMore}
        >
          <Show when={props.loading} fallback="Show more">
            <Spinner size="xs" />
            Loading…
          </Show>
        </Button>
      </HStack>
    </Show>
  );
};
