import { createResource, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import PlanView from "~/components/PlanView";

type ApiPassage = { passage: { id: string; ref: string; norm: string } };
type ApiDay = {
  id: string;
  position: number;
  label: string;
  date: string | null;
  passages: ApiPassage[];
};
type ApiPlan = {
  id: string;
  title: string;
  days: ApiDay[];
};

function fetchPlan(id: string) {
  return fetch(`/api/plans/${id}`).then(async (res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as ApiPlan | null;
  });
}

export default function PlanDetails() {
  const params = useParams();
  const [plan] = createResource(() => params.id, fetchPlan);

  const uiPlan = () => {
    const p = plan();
    if (!p) return undefined;
    return {
      id: p.id,
      title: p.title,
      days: p.days.map((d) => ({
        id: d.id,
        label: d.label,
        date: d.date ?? undefined,
        passages: d.passages.map((pp) => ({
          id: pp.passage.id,
          ref: pp.passage.ref,
          norm: pp.passage.norm,
        })),
      })),
    } as const;
  };

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4">
        <Show when={!plan.loading} fallback={<p>Loading…</p>}>
          <Show when={uiPlan()} fallback={<p>Plan not found.</p>}>
            {(p) => <PlanView plan={p()} />}
          </Show>
        </Show>
      </div>
    </main>
  );
}
