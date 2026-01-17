import { Button } from "~/components/ui/button";

export const LoadMoreButton = (props: {
  shown: number;
  total: number;
  onClick: () => void;
}) => {
  if (props.total <= props.shown) return null as unknown as any;
  return (
    <div>
      <Button variant="outline" size="sm" onClick={props.onClick}>
        Show more ({props.shown} / {props.total})
      </Button>
    </div>
  );
};
