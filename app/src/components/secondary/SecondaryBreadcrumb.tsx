import { For, Show } from "solid-js";
import { HStack, styled } from "styled-system/jsx";

export type CrumbItem = { label: string; href?: string; mono?: boolean };

/** Every segment with an href is a link, so a detail page always leads back. */
export const SecondaryBreadcrumb = (props: { items: CrumbItem[] }) => (
  <HStack as="nav" aria-label="Breadcrumb" gap="1.5" fontSize="sm" color="fg.muted" flexWrap="wrap">
    <For each={props.items}>
      {(item, index) => (
        <>
          <Show when={index() > 0}>
            <styled.span color="fg.subtle" aria-hidden="true">
              /
            </styled.span>
          </Show>
          <Show
            when={item.href}
            fallback={
              <styled.span color="fg.default" fontFamily={item.mono ? "mono" : undefined}>
                {item.label}
              </styled.span>
            }
          >
            {(href) => (
              <styled.a
                href={href()}
                color="fg.muted"
                fontFamily={item.mono ? "mono" : undefined}
                transitionProperty="color"
                transitionDuration="140ms"
                _hover={{ color: "blue.11" }}
              >
                {item.label}
              </styled.a>
            )}
          </Show>
        </>
      )}
    </For>
  </HStack>
);
