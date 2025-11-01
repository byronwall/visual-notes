import { useNavigate, useParams } from "@solidjs/router";
import { type VoidComponent, Show, createResource } from "solid-js";
import { apiFetch } from "~/utils/base-url";
import TableOfContents from "../../components/TableOfContents";
import DocumentViewer from "../../components/DocumentViewer";
import { PathEditor } from "../../components/PathEditor";
import { MetaKeyValueEditor } from "../../components/MetaKeyValueEditor";

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

  let articleEl: HTMLElement | undefined;

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4">
        <div class="mx-auto max-w-[900px] relative">
          <Show when={doc()} fallback={<p>Loading…</p>}>
            {(d) => (
              <>
                <div class="mx-auto max-w-[900px] mb-4">
                  <div class="rounded border border-gray-200 p-3">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div class="text-xs text-gray-600 mb-1">Path</div>
                        <PathEditor
                          docId={d().id}
                          initialPath={d().path || undefined}
                        />
                      </div>
                      <div>
                        <div class="text-xs text-gray-600 mb-1">Key/Value metadata</div>
                        <MetaKeyValueEditor
                          docId={d().id}
                          initialMeta={d().meta as any}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <article class="prose max-w-none" ref={(el) => (articleEl = el)}>
                  <DocumentViewer doc={d()} onDeleted={handleDeleted} />
                </article>
              </>
            )}
          </Show>
          {/* TOC attached to the right edge of the note view */}
          <TableOfContents
            getRootEl={() => {
              const root = articleEl as HTMLElement | undefined;
              if (!root) return null;
              const pm = root.querySelector(
                ".ProseMirror"
              ) as HTMLElement | null;
              return pm || root;
            }}
            maxVh={60}
          />
        </div>
      </div>
    </main>
  );
};

export default DocView;
