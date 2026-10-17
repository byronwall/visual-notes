import {
  CircleCheckIcon,
  CircleDotIcon,
  CircleIcon,
  CirclePauseIcon,
  CircleXIcon,
} from "lucide-solid";
import { Dynamic } from "solid-js/web";
import { css } from "styled-system/css";
import { TASK_STATUSES, type TaskStatus } from "~/services/tasks/tasks.service";

export const STATUS_META: Record<
  TaskStatus,
  { label: string; icon: typeof CircleIcon; shortcut?: string }
> = {
  waiting: { label: "To do", icon: CircleIcon },
  started: { label: "In progress", icon: CircleDotIcon, shortcut: "S" },
  deferred: { label: "Deferred", icon: CirclePauseIcon },
  complete: { label: "Done", icon: CircleCheckIcon, shortcut: "X" },
  cancelled: { label: "Cancelled", icon: CircleXIcon },
};

export const STATUS_ORDER: readonly TaskStatus[] = TASK_STATUSES;

/** Colors status glyphs via `data-status` so Panda can extract every value. */
export const statusColorClass = css({
  color: "fg.subtle",
  "&[data-status=started]": { color: "amber.10" },
  "&[data-status=deferred]": { color: "fg.muted" },
  "&[data-status=complete]": { color: "green.10" },
});

export const TaskStatusIcon = (props: { status: TaskStatus; size?: number }) => (
  <Dynamic
    component={STATUS_META[props.status].icon}
    size={props.size ?? 16}
    stroke-width={2}
    aria-hidden="true"
  />
);
