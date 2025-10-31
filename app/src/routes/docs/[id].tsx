import { useNavigate, useParams } from "@solidjs/router";
import { type VoidComponent, Show, createResource } from "solid-js";
import { apiFetch } from "~/utils/base-url";
import DocumentViewer from "../../components/DocumentViewer";

type DocResponse = {
  id: string;
  title: string;
  markdown: string;
  html: string;
  createdAt: string;
  updatedAt: string;
  embeddingRuns?: {
    id: string;
    model?: string;
    dims?: number;
    params?: Record<string, unknown> | null;
    runCreatedAt?: string;
    embeddedAt?: string;
    vectorDims?: number;
    vectorPreview?: number[];
  }[];
};

async function fetchDoc(id: string) {
  const res = await apiFetch(`/api/docs/${id}`);
  if (!res.ok) throw new Error("Failed to load doc");
  return (await res.json()) as DocResponse;
}

const DocView: VoidComponent = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [doc] = createResource(
    () => params.id,
    (id) => fetchDoc(id!)
  );

  const handleDeleted = () => {
    try {
      console.log("[DocView] onDeleted → navigating to /docs");
    } catch {}
    navigate("/docs");
  };

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4">
        <div class="mx-auto max-w-[900px]">
          <Show when={doc()} fallback={<p>Loading…</p>}>
            {(d) => (
              <article class="prose max-w-none">
                <DocumentViewer doc={d()} onDeleted={handleDeleted} />
              </article>
            )}
          </Show>
        </div>
      </div>
    </main>
  );
};

export default DocView;
