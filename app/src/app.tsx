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

export default function App() {
  const queryClient = new QueryClient();
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>Visual Notes</Title>
          <SessionProvider basePath={clientEnv.VITE_AUTH_PATH || "/api/auth"}>
            <QueryClientProvider client={queryClient}>
              <Navbar />
              <Suspense>{props.children}</Suspense>
            </QueryClientProvider>
          </SessionProvider>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
