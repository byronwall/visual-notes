import { JSX } from "solid-js";
import { Button } from "~/components/ui/button";

export function Toggle(props: {
  title?: string;
  pressed?: boolean;
  onChange?: () => void;
  children: JSX.Element;
}) {
  return (
    <Button
      type="button"
      title={props.title}
      size="xs"
      variant="subtle"
      colorPalette="gray"
      data-state={props.pressed ? "on" : "off"}
      minW="6"
      h="6"
      px="0"
      onClick={props.onChange}
    >
      {props.children}
    </Button>
  );
}

