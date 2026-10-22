import { Title } from "@solidjs/meta";
import { createAsync, useAction, useSearchParams } from "@solidjs/router";
import { Match, Suspense, Switch, createEffect } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { OAuthConsentCard } from "~/components/oauth/OAuthConsentCard";
import { Text } from "~/components/ui/text";
import {
  decideOAuthConsent,
  fetchOAuthConsent,
} from "~/services/oauth/oauth-consent";

export default function OAuthAuthorizeRoute() {
  const [searchParams] = useSearchParams();
  const params = () =>
    Object.fromEntries(
      Object.entries(searchParams).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]),
    );
  const consent = createAsync(() => fetchOAuthConsent(params()));
  const decide = useAction(decideOAuthConsent);
  const ask = () => {
    const current = consent();
    return current?.kind === "ask" ? current : undefined;
  };
  const errorMessage = () => {
    const current = consent();
    return current?.kind === "error" ? current.message : undefined;
  };

  // Protocol errors go straight back to the client; this needs the browser.
  createEffect(() => {
    const current = consent();
    if (current?.kind === "redirect") window.location.replace(current.url);
  });

  const onDecide = async (approve: boolean) => {
    const { url } = await decide({ params: params(), approve });
    window.location.assign(url);
  };

  return (
    <Box
      as="main"
      minH="100dvh"
      bg="bg.subtle"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px="4"
      py="10"
    >
      <Title>Connect app • Visual Notes</Title>
      <Stack gap="5" w="full" maxW="md">
        <HStack gap="2.5" justifyContent="center">
          <img src="/favicon-32x32.png" alt="" width="28" height="28" />
          <Box fontSize="lg" fontWeight="semibold" letterSpacing="tight">
            Visual Notes
          </Box>
        </HStack>
        <Suspense fallback={<Box minH="48" aria-busy="true" />}>
          <Switch>
            <Match when={ask()}>
              {(current) => (
                <OAuthConsentCard
                  clientName={current().clientName}
                  redirectHost={current().redirectHost}
                  redirectIsLocal={current().redirectIsLocal}
                  scopes={current().scopes}
                  onDecide={onDecide}
                />
              )}
            </Match>
            <Match when={errorMessage()}>
              {(message) => (
                <Text textAlign="center" color="fg.muted">
                  {message()}
                </Text>
              )}
            </Match>
            <Match when={consent()?.kind === "redirect"}>
              <Text textAlign="center" color="fg.muted">
                Returning to the app…
              </Text>
            </Match>
          </Switch>
        </Suspense>
      </Stack>
    </Box>
  );
}
