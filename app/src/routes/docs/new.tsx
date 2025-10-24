import { type VoidComponent, createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";

const NewDocRoute: VoidComponent = () => {
  const nav = useNavigate();
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(true);

  onMount(async () => {
    console.log("[new-doc] creating placeholder note");
    setBusy(true);
    setError(null);
    try {
      const title = "Untitled note";
      const markdown = "# Untitled\n\nStart writing...";
      const res = await apiFetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, markdown }),
      });
      const json = await res.json().catch(() => ({}));
      console.log("[new-doc] create response", res.status, json);
      if (!res.ok || !json?.id) {
        throw new Error((json as any)?.error || "Failed to create note");
      }
      nav(`/docs/${json.id}`);
    } catch (e) {
      const msg = (e as Error).message || "Failed to create note";
      console.log("[new-doc] error", msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  });

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4">
        <h1 class="text-2xl font-bold mb-2">New note</h1>
        <Show when={busy()}>
          <p>Preparing editor…</p>
        </Show>
        <Show when={error()}>
          {(e) => (
            <div class="text-red-700 bg-red-50 border border-red-200 rounded p-3">
              {e()}
            </div>
          )}
        </Show>
      </div>
    </main>
  );
};

export default NewDocRoute;
