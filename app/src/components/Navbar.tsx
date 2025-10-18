import { useAuth } from "@solid-mediakit/auth/client";
import { Show, createSignal } from "solid-js";
import Modal from "~/components/Modal";
import type { VoidComponent } from "solid-js";

const Navbar: VoidComponent = () => {
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = createSignal(false);

  const initial = () =>
    (auth.session()?.user?.name?.[0] || auth.session()?.user?.email?.[0] || "?")
      .toString()
      .toUpperCase();

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
            <a href="/visual" class="hover:underline">
              Canvas
            </a>
          </div>
        </div>
        <div class="flex items-center gap-2">
          {auth.status() === "authenticated" ? (
            <div class="relative">
              <button
                class="flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 bg-white"
                title="Account"
                onClick={() => setMenuOpen(!menuOpen())}
              >
                <span class="text-sm font-semibold">{initial()}</span>
              </button>
              <Modal open={menuOpen()} onClose={() => setMenuOpen(false)}>
                <div class="absolute right-4 top-16 w-44 bg-white border border-gray-200 rounded-md shadow-md p-1">
                  <button
                    class="w-full text-left cta"
                    onClick={() => auth.signOut({ redirectTo: "/" })}
                  >
                    Sign out
                  </button>
                </div>
              </Modal>
            </div>
          ) : (
            <a class="cta" href="/">
              Sign in
            </a>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
