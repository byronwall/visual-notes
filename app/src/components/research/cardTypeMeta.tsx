import {
  CircleCheckIcon,
  CircleDotIcon,
  CircleHelpIcon,
  CircleSlashIcon,
  GitForkIcon,
  LayersIcon,
  LightbulbIcon,
  LinkIcon,
  ScaleIcon,
  SquareCheckIcon,
} from "lucide-solid";
import type { JSX } from "solid-js";
import { css } from "styled-system/css";
import type { ResearchCardState, ResearchCardType } from "~/services/research/research.types";

type Icon = (props: { size?: number; strokeWidth?: number; class?: string }) => JSX.Element;

export const CARD_TYPE_META: Record<ResearchCardType, { label: string; icon: Icon; colorClass: string }> = {
  task: { label: "Task", icon: SquareCheckIcon, colorClass: css({ color: "blue.11" }) },
  question: { label: "Question", icon: CircleHelpIcon, colorClass: css({ color: "amber.11" }) },
  finding: { label: "Finding", icon: LightbulbIcon, colorClass: css({ color: "green.11" }) },
  source: { label: "Source", icon: LinkIcon, colorClass: css({ color: "fg.muted" }) },
  summary: { label: "Summary", icon: LayersIcon, colorClass: css({ color: "gray.11" }) },
  option: { label: "Option", icon: GitForkIcon, colorClass: css({ color: "green.11" }) },
  criterion: { label: "Criterion", icon: ScaleIcon, colorClass: css({ color: "fg.muted" }) },
};

export const CARD_STATE_META: Record<ResearchCardState, { label: string; icon: Icon }> = {
  open: { label: "Open", icon: CircleDotIcon },
  done: { label: "Done", icon: CircleCheckIcon },
  dropped: { label: "Dropped", icon: CircleSlashIcon },
};

export const CardTypeIcon = (props: { type: ResearchCardType; size?: number }) => {
  const meta = () => CARD_TYPE_META[props.type];
  return (
    <span
      class={`${meta().colorClass} ${css({ display: "inline-flex", flexShrink: 0 })}`}
      title={meta().label}
      aria-label={meta().label}
    >
      {meta().icon({ size: props.size ?? 14, strokeWidth: 2 })}
    </span>
  );
};
