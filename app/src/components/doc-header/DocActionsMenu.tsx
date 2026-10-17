import { CopyIcon, HeadingIcon, EllipsisIcon, Trash2Icon } from "lucide-solid";
import { Show, type VoidComponent } from "solid-js";
import { IconButton } from "~/components/ui/icon-button";
import * as Menu from "~/components/ui/menu";
import { Tooltip } from "~/components/ui/tooltip";

/**
 * Secondary note actions. Delete lives here instead of as a red button in
 * the header so the one destructive action is never a stray click away.
 */
export const DocActionsMenu: VoidComponent<{
  onDelete: () => void;
  onCopyLink: () => void;
  /** Offered when the note's first heading differs from its title. */
  headingTitle?: string;
  onUseHeadingTitle?: () => void;
  disabled?: boolean;
}> = (props) => {
  return (
    <Menu.Root size="sm" positioning={{ placement: "bottom-end" }}>
      <Tooltip content="More actions" showArrow>
        <Menu.Trigger
          asChild={(triggerProps) => (
            <IconButton
              {...triggerProps}
              size="sm"
              variant="plain"
              colorPalette="gray"
              minW="8"
              w="8"
              h="8"
              color="fg.muted"
              aria-label="More note actions"
              disabled={props.disabled}
            >
              <EllipsisIcon size={16} />
            </IconButton>
          )}
        />
      </Tooltip>
      <Menu.Positioner>
        <Menu.Content>
          <Show when={props.headingTitle}>
            {(heading) => (
              <Menu.Item
                value="use-heading-title"
                onSelect={() => props.onUseHeadingTitle?.()}
                title={heading()}
              >
                <HeadingIcon size={14} />
                Use first heading as title
              </Menu.Item>
            )}
          </Show>
          <Menu.Item value="copy-link" onSelect={() => props.onCopyLink()}>
            <CopyIcon size={14} />
            Copy link
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item
            value="delete"
            color="red.11"
            _highlighted={{ bg: "red.a3", color: "red.11" }}
            onSelect={() => props.onDelete()}
          >
            <Trash2Icon size={14} />
            Delete note…
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
