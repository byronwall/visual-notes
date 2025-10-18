import { onMount } from "solid-js";
import { passageKey, findTodayIndex } from "~/utils/passages";
import type { PlanDay } from "~/types";

export default function PlanTable(props: {
  planId: string;
  days: PlanDay[];
  onOpen: (data: {
    norm: string;
    planId: string;
    dayId: string;
    passageId: string;
  }) => void;
}) {
  // Local progress store removed; progress/actions flow through server
  const todayIdx = findTodayIndex(
    props.days.map((d) => d.label),
    props.days.map((d) => d.date)
  );
  onMount(() => {
    if (todayIdx < 0) return;
    queueMicrotask(() => {
      const row = document.querySelector(
        '[data-view="table"] tr[data-today="true"]'
      );
      row?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  });
  return (
    <div class="card" style="overflow:auto;" data-view="table">
      <h3>Table View</h3>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">
              Day
            </th>
            <th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">
              Readings
            </th>
          </tr>
        </thead>
        <tbody>
          {props.days.map((d, i) => (
            <tr data-today={i === todayIdx ? "true" : "false"}>
              <td style="padding:6px; border-bottom:1px solid #f0f2f4; white-space:nowrap;">
                {d.label}
              </td>
              <td style="padding:6px; border-bottom:1px solid #f0f2f4;">
                {d.passages.map((p) => {
                  const key = passageKey(p.norm);
                  const done = false;
                  return (
                    <span style="margin-right:8px; display:inline-flex; gap:6px; align-items:center;">
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          props.onOpen({
                            norm: p.norm,
                            planId: props.planId,
                            dayId: d.id,
                            passageId: p.id,
                          });
                        }}
                      >
                        {p.ref}
                      </a>
                      {/* Local mark removed; marking handled on open via server */}
                    </span>
                  );
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
