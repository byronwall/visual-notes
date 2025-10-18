import {
  createMemo,
  createResource,
  Show,
  createSignal,
  onMount,
} from "solid-js";
import ReaderModal from "~/components/ReaderModal";
import PassageChip from "~/components/PassageChip";
import { findTodayIndex, parsePlanDate } from "~/utils/passages";

type LitePlan = { id: string; title: string; createdAt?: string };
type PlansResponse = { global: LitePlan[]; mine: LitePlan[] };

function fetchPlans() {
  return fetch("/api/plans").then(async (res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as PlansResponse;
  });
}

export default function PlansList() {
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));
  const [plans] = createResource(mounted, async () => fetchPlans());
  const [openRef, setOpenRef] = createSignal<{
    norm: string;
    planId?: string;
    dayId?: string;
    passageId?: string;
  } | null>(null);
  const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString() : "");
  return (
    <div class="flex flex-col gap-4">
      <Show
        when={mounted() && !plans.loading}
        fallback={
          <div class="card">
            <p>Loading…</p>
          </div>
        }
      >
        <div class="card">
          <h3>My Plans</h3>
          <Show
            when={plans()?.mine?.length}
            fallback={<p class="small">No personal plans yet.</p>}
          >
            <ul style="display:flex; flex-direction:column; gap:6px;">
              {plans()!.mine.map((p) => (
                <PlanRow plan={p} fmt={fmt} onOpen={(r) => setOpenRef(r)} />
              ))}
            </ul>
          </Show>
        </div>
        <div class="card">
          <h3>Global Plans</h3>
          <Show
            when={plans()?.global?.length}
            fallback={<p class="small">No global plans available.</p>}
          >
            <ul style="display:flex; flex-direction:column; gap:6px;">
              {plans()!.global.map((p) => (
                <PlanRow plan={p} fmt={fmt} onOpen={(r) => setOpenRef(r)} />
              ))}
            </ul>
          </Show>
        </div>
      </Show>
      <ReaderModal refData={openRef()} onClose={() => setOpenRef(null)} />
    </div>
  );
}

function PlanRow(props: {
  plan: { id: string; title: string; createdAt?: string };
  fmt: (d?: string) => string;
  onOpen: (data: {
    norm: string;
    planId?: string;
    dayId?: string;
    passageId?: string;
  }) => void;
}) {
  const [details] = createResource(async () => {
    const res = await fetch(`/api/plans/${props.plan.id}`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as any;
  });

  const daySummary = createMemo(() => {
    const p = details();
    if (!p) return null;
    const days = (p.days ?? []).map((d: any) => ({
      id: d.id as string,
      label: d.label as string,
      date: (d.date ?? undefined) as string | undefined,
      passages: (d.passages ?? []).map((dp: any) => ({
        id: dp.passage.id as string,
        ref: dp.passage.ref as string,
        norm: dp.passage.norm as string,
      })),
    }));
    if (!days.length) return null;
    const labels = days.map((d: any) => d.label);
    const dates = days.map((d: any) => d.date);
    let idx = findTodayIndex(labels, dates);
    if (idx < 0) {
      const today = new Date();
      const todayMid = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).getTime();
      idx = days.findIndex((d: any) => {
        const dd = parsePlanDate(d.date);
        return dd ? dd.getTime() >= todayMid : false;
      });
      if (idx < 0) idx = 0;
    }
    return days[idx];
  });

  return (
    <li style="display:flex; flex-direction:column; gap:6px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span>
          <strong>{props.plan.title}</strong>
          <span class="small" style="margin-left:8px; color:#6b7280;">
            {props.fmt(props.plan.createdAt)}
          </span>
        </span>
        <a class="cta" href={`/plans/${props.plan.id}`}>
          Open
        </a>
      </div>
      <Show when={details()} fallback={<span class="small">Loading…</span>}>
        {daySummary() ? (
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            {daySummary()!.passages.map((pp: any) => (
              <PassageChip
                refText={pp.ref}
                onOpen={() =>
                  props.onOpen({
                    norm: pp.norm,
                    planId: props.plan.id,
                    dayId: daySummary()!.id,
                    passageId: pp.id,
                  })
                }
              />
            ))}
          </div>
        ) : (
          <span class="small" style="color:#6b7280;">
            No readings found.
          </span>
        )}
      </Show>
    </li>
  );
}
