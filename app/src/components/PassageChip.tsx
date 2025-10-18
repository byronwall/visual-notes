import { JSX } from "solid-js";
import { passageKey } from "~/utils/passages";

export default function PassageChip(props: {
  refText: string;
  onOpen: () => void;
}) {
  const key = passageKey(props.refText);
  const done = () => false;
  const toggle: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent> = (e) => {
    e.stopPropagation();
    // Local toggle removed; mark handled by server when opening/explicit actions
  };
  return (
    <div
      class="chip"
      data-done={done()}
      onClick={props.onOpen}
      title="Open reading"
    >
      <span>{props.refText}</span>
      {/* Local mark removed */}
    </div>
  );
}
