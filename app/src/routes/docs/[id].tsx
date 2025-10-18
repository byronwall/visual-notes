import { type VoidComponent, Show, createResource } from "solid-js";
import { useParams } from "@solidjs/router";

async function fetchDoc(id: string) {
  const res = await fetch(`/api/docs/${id}`);
  if (!res.ok) throw new Error("Failed to load doc");
  return (await res.json()) as { id: string; title: string; html: string };
}

const DocView: VoidComponent = () => {
  const params = useParams();
  const [doc] = createResource(
    () => params.id,
    (id) => fetchDoc(id!)
  );

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4">
        <Show when={doc()} fallback={<p>Loading…</p>}>
          {(d) => (
            <article class="prose max-w-none">
              <h1>{d().title}</h1>
              <div innerHTML={d().html} />
            </article>
          )}
        </Show>
      </div>
    </main>
  );
};

export default DocView;
