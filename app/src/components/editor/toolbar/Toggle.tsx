import { type JSX, splitProps } from "solid-js";
import { Button } from "~/components/ui/button";

type ToggleProps = {
  title?: string;
  ariaLabel?: string;
  pressed?: boolean;
  onPress?: () => void;
  children: JSX.Element;
} & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "title">;

export function Toggle(props: ToggleProps) {
  const [local, rest] = splitProps(props, [
    "title",
    "ariaLabel",
    "pressed",
    "onPress",
    "children",
  ]);
  return (
    <Button
      type="button"
      {...rest}
      title={local.title || undefined}
      aria-label={local.ariaLabel}
      aria-pressed={local.pressed === undefined ? undefined : local.pressed}
      size="xs"
      variant="plain"
      colorPalette="gray"
      data-state={local.pressed ? "on" : "off"}
      minW="7"
      h="7"
      px="0"
      borderRadius="l2"
      bg={local.pressed ? "gray.subtle.bg" : "transparent"}
      color={local.pressed ? "fg.default" : "fg.muted"}
      transitionProperty="background-color, color"
      transitionDuration="140ms"
      _hover={{
        bg: local.pressed ? "gray.subtle.bg.hover" : "gray.plain.bg.hover",
        color: "fg.default",
      }}
      _active={{ bg: "gray.subtle.bg.active" }}
      onClick={(event) => {
        if (typeof rest.onClick === "function") rest.onClick(event);
        local.onPress?.();
      }}
    >
      {local.children}
    </Button>
  );
}
