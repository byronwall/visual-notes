import { type VoidComponent, createSignal } from "solid-js";
import { A, useNavigate } from "@solidjs/router";

const Home: VoidComponent = () => {
  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4">
        <h1 class="text-2xl font-bold mb-4">Visual Notes</h1>
        <p class="mb-4">
          <A href="/docs" class="text-blue-600 underline">
            Browse Notes
          </A>
        </p>
        <MinimalIngestForm />
      </div>
    </main>
  );
};

export default Home;

const MinimalIngestForm: VoidComponent = () => {
  const nav = useNavigate();
  const [title, setTitle] = createSignal("");
  const [markdown, setMarkdown] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title(), markdown: markdown() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to ingest document");
      if (json?.id) nav(`/docs/${json.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form class="flex flex-col gap-3" onSubmit={submit}>
      <input
        class="cta"
        placeholder="Title"
        value={title()}
        onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)}
      />
      <textarea
        class="cta"
        rows={10}
        placeholder="Paste Markdown here..."
        value={markdown()}
        onInput={(e) =>
          setMarkdown((e.currentTarget as HTMLTextAreaElement).value)
        }
      />
      <div class="flex items-center gap-2">
        <button class="cta" type="submit" disabled={busy()}>
          {busy() ? "Uploading..." : "Ingest Document"}
        </button>
        {error() && <span class="text-red-600 small">{error()}</span>}
      </div>
    </form>
  );
};
