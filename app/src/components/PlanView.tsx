import { createEffect, createMemo, createSignal } from "solid-js";
import DayCard from "./DayCard";
import PlanTable from "./PlanTable";
import ReaderModal from "./ReaderModal";
import { weekIndex, findTodayIndex } from "~/utils/passages";

// For now, this component expects a plan object to be present higher up in state.
// The plan load/list UI can be added later; this preserves the client experience.
export default function PlanView(props: {
  plan?: { id?: string; title: string; days: any[] };
}) {
  const [openRef, setOpenRef] = createSignal<{
    norm: string;
    planId: string;
    dayId: string;
    passageId: string;
  } | null>(null);
  const [mode, setMode] = createSignal<"cards" | "table">("cards");
  const days = () => (props.plan?.days ?? []) as any[];
  const todayIndex = createMemo(() => {
    const ds = days();
    const labels = ds.map((d) => d.label);
    const dates = ds.map((d) => d.date);
    return findTodayIndex(labels, dates);
  });

  createEffect(() => {
    const idx = todayIndex();
    const m = mode();
    if (idx < 0) return;
    queueMicrotask(() => {
      if (m === "cards") {
        const el = document.querySelector('.card[data-today="true"]');
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      } else {
        const row = document.querySelector(
          '[data-view="table"] tr[data-today="true"]'
        );
        row?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
  });

  const grouped = createMemo(() => {
    const buckets: Record<number, any[]> = {};
    days().forEach((d, i) => {
      const w = weekIndex(i);
      if (!buckets[w]) buckets[w] = [];
      buckets[w].push(d);
    });
    return Object.keys(buckets).map((w) => ({
      week: Number(w),
      list: buckets[Number(w)],
    }));
  });

  return (
    <>
      <header>
        <h1>{props.plan?.title ?? "No Plan Loaded"}</h1>
        <div class="tools">
          <button
            class="cta"
            onClick={() => setMode(mode() === "cards" ? "table" : "cards")}
          >
            {mode() === "cards" ? "Table View" : "Card View"}
          </button>
        </div>
      </header>
      <section>
        {days().length > 0 ? (
          mode() === "cards" ? (
            <>
              {grouped().map(({ week, list }) => (
                <>
                  <h3 style="margin:8px 0;">Week {week}</h3>
                  <div class="grid">
                    {list.map((day, idx) => (
                      <DayCard
                        planId={props.plan?.id as string}
                        day={day}
                        onOpen={(data) => setOpenRef(data)}
                        isToday={days().indexOf(day) === todayIndex()}
                      />
                    ))}
                  </div>
                </>
              ))}
            </>
          ) : (
            <PlanTable
              planId={props.plan?.id as string}
              days={days()}
              onOpen={(data) => setOpenRef(data)}
            />
          )
        ) : (
          <div class="small">Import a plan to begin.</div>
        )}
      </section>
      <ReaderModal refData={openRef()} onClose={() => setOpenRef(null)} />
    </>
  );
}
