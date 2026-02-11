import { CircleXIcon } from "lucide-solid";
import { splitProps } from "solid-js";
import { IconButton, type IconButtonProps } from "./icon-button";

export type ClearButtonProps = IconButtonProps & {
  label?: string;
};

export const ClearButton = (props: ClearButtonProps) => {
  const [local, rest] = splitProps(props, ["children", "label"]);
  const label = () => local.label ?? "Clear";

  return (
    <IconButton
      size="xs"
      variant="plain"
      aria-label={label()}
      title={label()}
      type="button"
      {...rest}
    >
      {local.children ?? <CircleXIcon />}
    </IconButton>
  );
};
