import PassageChip from "./PassageChip";
import { createMemo } from "solid-js";
import { passageKey } from "~/utils/passages";
import type { PlanDay } from "~/types";

export default function DayCard(props: {
  planId: string;
  day: PlanDay;
  onOpen: (data: {
    norm: string;
    planId: string;
    dayId: string;
    passageId: string;
  }) => void;
  isToday?: boolean;
}) {
  const allKeys = createMemo(() =>
    props.day.passages.map((p) => passageKey(p.norm))
  );
  const allDone = () => false;
  return (
    <div class="card" data-today={props.isToday ? "true" : "false"}>
      <div class="dayhead">
        <strong>{props.day.label}</strong>
        {/* Local mark/unmark removed; managed by server */}
      </div>
      <div class="passage-row">
        {props.day.passages.map((p) => (
          <PassageChip
            refText={p.ref}
            onOpen={() =>
              props.onOpen({
                norm: p.norm,
                planId: props.planId,
                dayId: props.day.id,
                passageId: p.id,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}
