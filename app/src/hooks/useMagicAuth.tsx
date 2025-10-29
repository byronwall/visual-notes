import { createContext, useContext, type ParentComponent } from "solid-js";
import { createSignal, createResource, onMount } from "solid-js";

type MagicAuthValue = {
  authed: () => boolean;
  loading: () => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const MagicAuthContext = createContext<MagicAuthValue>();

async function fetchSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/magic-session", { credentials: "include" });
    if (!res.ok) return false;
    const data = (await res.json()) as { authed?: boolean };
    return Boolean(data?.authed);
  } catch {
    return false;
  }
}

export const MagicAuthProvider: ParentComponent = (props) => {
  const [force, setForce] = createSignal(0);
  const [authed, { refetch }] = createResource(force, fetchSession, {
    initialValue: false,
  });
  const [loading, setLoading] = createSignal(true);

  const refresh = async () => {
    console.log("[magic-auth] refresh");
    setForce((v) => v + 1);
    await refetch();
  };

  const logout = async () => {
    console.log("[magic-auth] logout");
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    await refresh();
    if (typeof window !== "undefined") window.location.href = "/login";
  };

  onMount(async () => {
    await refresh();
    setLoading(false);
  });

  const value: MagicAuthValue = {
    authed: () => Boolean(authed()) === true,
    loading,
    refresh,
    logout,
  };

  return (
    <MagicAuthContext.Provider value={value}>
      {props.children}
    </MagicAuthContext.Provider>
  );
};

export function useMagicAuth(): MagicAuthValue {
  const ctx = useContext(MagicAuthContext);
  if (!ctx)
    throw new Error("useMagicAuth must be used within MagicAuthProvider");
  return ctx;
}
