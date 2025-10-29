import { useNavigate } from "@solidjs/router";
import type { VoidComponent } from "solid-js";
import { createSignal } from "solid-js";
import { useMagicAuth } from "~/hooks/useMagicAuth";

const LoginPage: VoidComponent = () => {
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const { refresh } = useMagicAuth();
  const navigate = useNavigate();

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    console.log("Submitting magic login");
    try {
      const res = await fetch("/api/magic-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: password() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Login failed");
        return;
      }
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error)?.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="w-full flex justify-center mt-16">
      <form
        class="w-full max-w-sm border rounded-md p-4 bg-white"
        onSubmit={onSubmit}
      >
        <h1 class="text-lg font-semibold mb-3">Enter Password</h1>
        <div class="mb-3">
          <label class="block text-sm mb-1" for="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            class="w-full border rounded px-3 py-2"
            value={password()}
            onInput={(e) =>
              setPassword((e.currentTarget as HTMLInputElement).value)
            }
            autocomplete="current-password"
            required
          />
        </div>
        {error() && <div class="text-red-600 text-sm mb-2">{error()}</div>}
        <button type="submit" class="cta w-full" disabled={submitting()}>
          {submitting() ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
