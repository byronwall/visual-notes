import { For, Show, type Accessor } from "solid-js";
import { Portal } from "solid-js/web";
import { EllipsisIcon } from "lucide-solid";
import type { SourcesResponse } from "../data/docs.service";
import { IconButton } from "~/components/ui/icon-button";
import * as Menu from "~/components/ui/menu";

/** Maintenance and destructive tools; rarely used, so kept behind one menu. */
export const ActionsMenu = (props: {
  sources: Accessor<SourcesResponse | undefined>;
  onBulkSetSource: () => Promise<void>;
  onCleanupTitles: () => Promise<void>;
  onProcessPathRound: () => Promise<void>;
  onScanRelativeImages: () => Promise<void>;
  onDeleteBySource: (source: string, count: number) => Promise<void>;
  onDeleteAll: () => Promise<void>;
}) => {
  const run = (fn: () => Promise<void>) => () => void fn();

  return (
    <Menu.Root size="sm" positioning={{ placement: "bottom-end", gutter: 6 }}>
      <Menu.Trigger
        asChild={(triggerProps) => (
          <IconButton
            {...triggerProps}
            size="sm"
            variant="plain"
            aria-label="Note maintenance actions"
            title="Actions"
          >
            <EllipsisIcon size={16} />
          </IconButton>
        )}
      />
      <Portal>
        <Menu.Positioner zIndex="popover">
          <Menu.Content zIndex="popover" minW="14rem">
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>Maintenance</Menu.ItemGroupLabel>
              <Menu.Item
                value="path-round"
                onSelect={run(props.onProcessPathRound)}
              >
                Process one path round
              </Menu.Item>
              <Menu.Item
                value="relative-images"
                onSelect={run(props.onScanRelativeImages)}
              >
                Mark notes with relative images
              </Menu.Item>
              <Menu.Item
                value="set-source"
                onSelect={run(props.onBulkSetSource)}
              >
                Set source on all notes…
              </Menu.Item>
              <Menu.Item
                value="clean-titles"
                onSelect={run(props.onCleanupTitles)}
              >
                Clean bad titles
              </Menu.Item>
            </Menu.ItemGroup>
            <Menu.Separator />
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>Delete</Menu.ItemGroupLabel>
              <Show when={props.sources()}>
                {(data) => (
                  <For each={data().sources}>
                    {(s) => (
                      <Menu.Item
                        value={`delete-source-${s.originalSource}`}
                        color="red.11"
                        onSelect={() =>
                          void props.onDeleteBySource(s.originalSource, s.count)
                        }
                      >
                        All from {s.originalSource}
                        <Menu.ItemText ml="auto" color="fg.subtle">
                          {s.count}
                        </Menu.ItemText>
                      </Menu.Item>
                    )}
                  </For>
                )}
              </Show>
              <Menu.Item
                value="delete-all"
                color="red.11"
                onSelect={run(props.onDeleteAll)}
              >
                All notes
                <Show when={props.sources()}>
                  {(d) => (
                    <Menu.ItemText ml="auto" color="fg.subtle">
                      {d().total}
                    </Menu.ItemText>
                  )}
                </Show>
              </Menu.Item>
            </Menu.ItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
