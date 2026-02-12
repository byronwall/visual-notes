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
      variant="plain"
      colorPalette="gray"
      data-state={props.pressed ? "on" : "off"}
      minW="6"
      h="6"
      px="0"
      borderWidth="1px"
      borderColor={props.pressed ? "gray.outline.border" : "transparent"}
      bg={props.pressed ? "gray.surface.bg" : "transparent"}
      color={props.pressed ? "fg.default" : "fg.muted"}
      _hover={{
        bg: "gray.surface.bg.hover",
        color: "fg.default",
      }}
      onClick={props.onChange}
    >
      {props.children}
    </Button>
  );
}
