// @refresh reload
import "./panda.css";

import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Match, Suspense, Switch, createEffect, type JSX } from "solid-js";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { SessionProvider } from "@solid-mediakit/auth/client";
import { clientEnv } from "~/env/client";
import { AppSidebarLayout } from "./components/sidebar/AppSidebarLayout";
import { MagicAuthProvider, useMagicAuth } from "~/hooks/useMagicAuth";
import { useLocation, useNavigate } from "@solidjs/router";
import { ToastProvider, ToastViewport } from "~/components/Toast";

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
                <ToastProvider>
                  <Suspense fallback={null}>
                    <AuthGate>
                      <Suspense>{props.children}</Suspense>
                    </AuthGate>
                  </Suspense>
                  <ToastViewport />
                </ToastProvider>
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

const AuthGate = (props: { children: JSX.Element }) => {
  const { authed, loading } = useMagicAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isLoginRoute = () => location.pathname === "/login";

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

  return (
    <Switch fallback={null}>
      {/* Always allow the login page to render when unauthenticated. */}
      <Match when={isLoginRoute()}>{props.children}</Match>

      {/* Hide navbar and content flash when not authed (non-login pages) */}
      <Match when={authed()}>
        <AppSidebarLayout>{props.children}</AppSidebarLayout>
      </Match>
    </Switch>
  );
};
