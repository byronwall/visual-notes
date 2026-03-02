// @refresh reload
import "./panda.css";

import { Meta, MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import {
  ErrorBoundary,
  Match,
  Suspense,
  Switch,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { SessionProvider } from "@solid-mediakit/auth/client";
import { clientEnv } from "~/env/client";
import { AppSidebarLayout } from "./components/sidebar/AppSidebarLayout";
import { MagicAuthProvider, useMagicAuth } from "~/hooks/useMagicAuth";
import { useLocation, useNavigate } from "@solidjs/router";
import { ToastProvider, ToastViewport } from "~/components/Toast";
import { GlobalErrorOverlay } from "~/components/errors/GlobalErrorOverlay";

type ClientExceptionState = {
  source: "error" | "unhandledrejection";
  error: unknown;
};

export default function App() {
  const queryClient = new QueryClient();
  const [clientException, setClientException] =
    createSignal<ClientExceptionState | null>(null);

  onMount(() => {
    const handleError = (event: ErrorEvent) => {
      setClientException({
        source: "error",
        error: event.error || event.message || "Unknown client error",
      });
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setClientException({
        source: "unhandledrejection",
        error: event.reason || "Unhandled promise rejection",
      });
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    onCleanup(() => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    });
  });

  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>Visual Notes</Title>
          <Meta
            name="description"
            content="Visual Notes is a workspace for writing, organizing, and exploring your notes."
          />
          <Meta property="og:title" content="Visual Notes" />
          <Meta
            property="og:description"
            content="Visual Notes is a workspace for writing, organizing, and exploring your notes."
          />
          <Meta property="og:type" content="website" />
          <Meta name="twitter:card" content="summary" />
          <Meta name="twitter:title" content="Visual Notes" />
          <Meta
            name="twitter:description"
            content="Visual Notes is a workspace for writing, organizing, and exploring your notes."
          />
          <SessionProvider basePath={clientEnv.VITE_AUTH_PATH || "/api/auth"}>
            <QueryClientProvider client={queryClient}>
              <MagicAuthProvider>
                <ToastProvider>
                  <ErrorBoundary
                    fallback={(error, reset) => (
                      <GlobalErrorOverlay
                        title="Something went wrong"
                        message="An unexpected error interrupted the app. You can retry or reload the page."
                        error={error}
                        secondaryActionLabel="Reload page"
                        onSecondaryAction={() => {
                          window.location.reload();
                        }}
                        primaryActionLabel="Try again"
                        onPrimaryAction={() => {
                          setClientException(null);
                          reset();
                        }}
                      />
                    )}
                  >
                    <Suspense fallback={null}>
                      <AuthGate>
                        <Suspense>{props.children}</Suspense>
                      </AuthGate>
                    </Suspense>
                  </ErrorBoundary>
                  <ToastViewport />
                  <GlobalErrorOverlay
                    title="Client exception"
                    message="The page resumed with a stale connection and hit an uncaught client error."
                    error={clientException()?.error}
                    open={() => clientException() !== null}
                    secondaryActionLabel="Dismiss"
                    onSecondaryAction={() => {
                      setClientException(null);
                    }}
                    primaryActionLabel="Reload page"
                    onPrimaryAction={() => {
                      window.location.reload();
                    }}
                  />
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
