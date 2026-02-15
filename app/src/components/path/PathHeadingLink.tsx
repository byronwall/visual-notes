import { type JSX, splitProps } from "solid-js";
import { Link } from "~/components/ui/link";

type PathHeadingLinkProps = {
  href: string;
  children: JSX.Element;
  onClick?: JSX.EventHandlerUnion<HTMLAnchorElement, MouseEvent>;
  title?: string;
  variant?: "page" | "popover";
};

export const PathHeadingLink = (props: PathHeadingLinkProps) => {
  const [local] = splitProps(props, [
    "href",
    "children",
    "onClick",
    "title",
    "variant",
  ]);
  const isPopover = () => (local.variant ?? "page") === "popover";

  return (
    <Link
      href={local.href}
      onClick={local.onClick}
      title={local.title}
      fontWeight="bold"
      fontFamily="mono"
      fontSize={isPopover() ? "2xl" : { base: "2xl", md: "3xl" }}
      textDecoration="none"
      _hover={{ textDecoration: "underline" }}
    >
      {local.children}
    </Link>
  );
};
