// @refresh reload
import "./app.css";
import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { SessionProvider } from "@solid-mediakit/auth/client";
import { clientEnv } from "~/env/client";
import Navbar from "~/components/Navbar";
import { MagicAuthProvider, useMagicAuth } from "~/hooks/useMagicAuth";
import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect } from "solid-js";

export default function App() {
  const queryClient = new QueryClient();
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>Visual Notes</Title>
          <SessionProvider basePath={clientEnv.VITE_AUTH_PATH || "/api/auth"}>
            <QueryClientProvider client={queryClient}>
              <MagicAuthProvider>
                <Suspense fallback={null}>
                  <AuthGate>
                    <Suspense>{props.children}</Suspense>
                  </AuthGate>
                </Suspense>
              </MagicAuthProvider>
            </QueryClientProvider>
          </SessionProvider>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}

const AuthGate = (props: { children: any }) => {
  const { authed, loading } = useMagicAuth();
  const navigate = useNavigate();
  const location = useLocation();

  createEffect(() => {
    if (typeof window === "undefined") return;
    if (loading()) {
      return;
    }
    const path = location.pathname;
    if (!authed() && path !== "/login") {
      console.log("[auth-gate] redirecting to /login from", path);
      navigate("/login", { replace: true });
      return;
    }
  });

  // Hide navbar and content flash when not authed
  if (!authed() && location.pathname !== "/login") {
    return null;
  }
  return (
    <>
      {authed() ? <Navbar /> : null}
      {props.children}
    </>
  );
};
