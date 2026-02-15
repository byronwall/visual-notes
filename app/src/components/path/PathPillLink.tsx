import { type JSX, splitProps } from "solid-js";
import { Link } from "~/components/ui/link";

type PathPillLinkProps = {
  href: string;
  children: JSX.Element;
  endSlot?: JSX.Element;
  onClick?: JSX.EventHandlerUnion<HTMLAnchorElement, MouseEvent>;
  title?: string;
  variant?: "outline" | "subtle";
  size?: "xs" | "sm";
};

export const PathPillLink = (props: PathPillLinkProps) => {
  const [local] = splitProps(props, [
    "href",
    "children",
    "endSlot",
    "onClick",
    "title",
    "variant",
    "size",
  ]);

  const isOutline = () => (local.variant ?? "subtle") === "outline";
  const isSmall = () => (local.size ?? "xs") === "sm";

  return (
    <Link
      href={local.href}
      onClick={local.onClick}
      title={local.title}
      fontFamily="mono"
      fontSize={isSmall() ? "sm" : "xs"}
      textDecoration="none"
      px={isSmall() ? "2.5" : "2"}
      py={isSmall() ? "1.5" : "1"}
      display="flex"
      alignItems="center"
      justifyContent={local.endSlot ? "space-between" : "flex-start"}
      gap="2"
      w={local.endSlot ? "full" : undefined}
      borderWidth={isOutline() ? "1px" : "0"}
      borderColor="border"
      borderRadius="l2"
      color={isOutline() ? "fg.default" : "fg.muted"}
      _hover={{
        textDecoration: isOutline() ? "none" : "underline",
        bg: isOutline() ? "bg.subtle" : undefined,
      }}
    >
      {local.children}
      {local.endSlot}
    </Link>
  );
};
