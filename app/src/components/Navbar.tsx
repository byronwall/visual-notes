import type { VoidComponent } from "solid-js";
import { createSignal, onMount } from "solid-js";

const Navbar: VoidComponent = () => {
  const [authed, setAuthed] = createSignal(false);
  const handleLogout = async () => {
    console.log("Logging out");
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  };

  onMount(() => {
    setAuthed(
      typeof document !== "undefined" && document.cookie.includes("magic_auth=")
    );
  });

  return (
    <nav class="w-full border-b border-gray-200 bg-white">
      <div class="container mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a
            href="/"
            class="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <img
              src="/favicon-32x32.png"
              alt=""
              width="24"
              height="24"
              class="rounded"
            />
            <span>Visual Notes</span>
          </a>
          <div class="flex items-center gap-4 text-sm">
            <a href="/docs" class="hover:underline">
              Notes
            </a>
            <a href="/docs/new" class="hover:underline">
              New Note
            </a>

            <a href="/embeddings" class="hover:underline">
              Embeddings
            </a>
            <a href="/umap" class="hover:underline">
              UMAP
            </a>
          </div>
        </div>
        <div class="flex items-center gap-2">
          {authed() ? (
            <button class="cta" onClick={handleLogout}>
              Sign out
            </button>
          ) : (
            <a class="cta" href="/login">
              Sign in
            </a>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
