import { PlusIcon } from "lucide-solid";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { usePathKeyboard } from "../hooks/usePathKeyboard";

/** Shown when nothing is filed at or under the path. Keeps the N shortcut alive. */
export const PathEmptyState = (props: { path: string; onCreateNote: () => void }) => {
  usePathKeyboard({
    move: () => {},
    hasActive: () => false,
    open: () => {},
    focusFilter: () => {},
    createNote: props.onCreateNote,
  });

  return (
    <div class={css({ py: "10", textAlign: "center", color: "fg.muted", fontSize: "sm" })}>
      <p>
        Nothing is filed under{" "}
        <span class={css({ fontFamily: "mono", color: "fg.default" })}>{props.path}</span> yet.
      </p>
      <Button size="sm" variant="outline" mt="3" onClick={() => props.onCreateNote()}>
        <PlusIcon size={14} />
        Create the first note here
      </Button>
    </div>
  );
};
