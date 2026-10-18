import { AlertTriangleIcon, CheckCircle2Icon, XCircleIcon } from "lucide-solid";
import { Match, Switch } from "solid-js";
import { Box } from "styled-system/jsx";
import type { RunStatus } from "./ai-dashboard-model";

const labels: Record<RunStatus, string> = {
  SUCCESS: "Succeeded",
  ERROR: "Failed",
  PARTIAL: "Partial",
};

export const RunStatusIcon = (props: { status: RunStatus }) => (
  <Box
    as="span"
    display="inline-flex"
    flexShrink="0"
    color={
      props.status === "SUCCESS"
        ? "grass.10"
        : props.status === "ERROR"
          ? "red.10"
          : "amber.10"
    }
    title={labels[props.status]}
    aria-label={labels[props.status]}
    role="img"
  >
    <Switch>
      <Match when={props.status === "SUCCESS"}>
        <CheckCircle2Icon size={15} />
      </Match>
      <Match when={props.status === "ERROR"}>
        <XCircleIcon size={15} />
      </Match>
      <Match when={props.status === "PARTIAL"}>
        <AlertTriangleIcon size={15} />
      </Match>
    </Switch>
  </Box>
);
