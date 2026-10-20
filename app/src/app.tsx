// @refresh reload
import "./panda.css";

import { Meta, MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import {
  ErrorBoundary,
  Match,
  Show,
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
import { Toaster } from "~/components/ui/toast";
import { GlobalErrorOverlay } from "~/components/errors/GlobalErrorOverlay";
import { sectionTitleForPath } from "~/components/sidebar/nav-items";
import { loginPathFor } from "~/utils/safe-next";
import { NoteLiveSyncProvider } from "~/features/live-sync/NoteLiveSyncProvider";

type ClientExceptionState = {
  source: "error" | "unhandledrejection";
  error: unknown;
};

export default function App() {
  const queryClient = new QueryClient();
  const [clientException, setClientException] =
    createSignal<ClientExceptionState | null>(null);

  onMount(() => {
    document.documentElement.dataset.appHydrated = "true";
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
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    });
  });

  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <DefaultMetadata />
          <SessionProvider basePath={clientEnv.VITE_AUTH_PATH || "/api/auth"}>
            <QueryClientProvider client={queryClient}>
              <MagicAuthProvider>
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
                <Toaster />
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

const DefaultMetadata = () => {
  const location = useLocation();
  const isPublicShareRoute = () => location.pathname.startsWith("/share/");
  // Route modules may set a more specific <Title>; this is the fallback so
  // every tab names its section instead of a generic "Visual Notes".
  const defaultTitle = () => {
    const section = sectionTitleForPath(location.pathname);
    return section ? `${section} • Visual Notes` : "Visual Notes";
  };

  return (
    <Show when={!isPublicShareRoute()}>
      <Title>{defaultTitle()}</Title>
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
    </Show>
  );
};

const AuthGate = (props: { children: JSX.Element }) => {
  const { authed, loading } = useMagicAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isLoginRoute = () => location.pathname === "/login";
  const isPublicShareRoute = () => location.pathname.startsWith("/share/");
  // OAuth consent renders without the app chrome but still requires login.
  const isOAuthRoute = () => location.pathname.startsWith("/oauth/");

  createEffect(() => {
    if (typeof window === "undefined") return;
    if (loading()) {
      return;
    }
    const path = location.pathname;
    if (!authed() && path !== "/login" && !path.startsWith("/share/")) {
      console.log("[auth-gate] redirecting to /login from", path);
      navigate(loginPathFor(path + location.search), { replace: true });
      return;
    }
  });

  return (
    <Switch fallback={null}>
      {/* Always allow the login page to render when unauthenticated. */}
      <Match when={isLoginRoute() || isPublicShareRoute()}>
        {props.children}
      </Match>

      <Match when={authed() && isOAuthRoute()}>{props.children}</Match>

      {/* Hide navbar and content flash when not authed (non-login pages) */}
      <Match when={authed()}>
        <NoteLiveSyncProvider>
          <AppSidebarLayout>{props.children}</AppSidebarLayout>
        </NoteLiveSyncProvider>
      </Match>
    </Switch>
  );
};
