import { type VoidComponent } from "solid-js";
import DocumentEditor from "~/components/DocumentEditor";
import { useNavigate } from "@solidjs/router";

const NewDocRoute: VoidComponent = () => {
  const nav = useNavigate();
  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4">
        <h1 class="text-2xl font-bold mb-2">New note</h1>
        <article class="prose max-w-none">
          <DocumentEditor
            initialTitle="Untitled note"
            initialMarkdown={"# Untitled\n\nStart writing..."}
            onCreated={(id) => {
              console.log("[new-doc] created id", id);
              nav(`/docs/${id}`);
            }}
          />
        </article>
      </div>
    </main>
  );
};

export default NewDocRoute;
