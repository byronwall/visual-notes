import { Button } from "~/components/ui/button";
import { Match, Switch } from "solid-js";

export const LoadMoreButton = (props: {
  shown: number;
  total: number;
  onClick: () => void;
}) => {
  return (
    <Switch fallback={null}>
      <Match when={props.total > props.shown}>
        <div>
          <Button variant="outline" size="sm" onClick={props.onClick}>
            Show more ({props.shown} / {props.total})
          </Button>
        </div>
      </Match>
    </Switch>
  );
};
