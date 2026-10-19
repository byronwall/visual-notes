import { useAction, useNavigate } from "@solidjs/router";
import type { VoidComponent } from "solid-js";
import { createSignal, Show } from "solid-js";
import { useMagicAuth } from "~/hooks/useMagicAuth";
import { magicLogin } from "~/services/auth/magic-auth.actions";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";

const LoginPage: VoidComponent = () => {
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const { refresh } = useMagicAuth();
  const navigate = useNavigate();
  const runLogin = useAction(magicLogin);

  const handlePasswordInput = (
    e: InputEvent & { currentTarget: HTMLInputElement }
  ) => {
    setPassword(e.currentTarget.value);
  };

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    console.info("[login] submitting");
    try {
      await runLogin({ password: password() });
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error)?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
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
      <Stack gap="5" w="full" maxW="sm">
        <HStack gap="2.5" justifyContent="center">
          <img src="/favicon-32x32.png" alt="" width="28" height="28" />
          <Box fontSize="lg" fontWeight="semibold" letterSpacing="tight">
            Visual Notes
          </Box>
        </HStack>
        <Box
          as="form"
          onSubmit={onSubmit}
          bg="bg.default"
          borderWidth="1px"
          borderColor="border"
          borderRadius="l3"
          boxShadow="sm"
          p="5"
        >
          <Stack gap="4">
            <Heading as="h1" fontSize="md" m="0">
              Sign in
            </Heading>
            <Field.Root invalid={Boolean(error())} required>
              <Field.Label>Password</Field.Label>
              <Input
                id="password"
                type="password"
                value={password()}
                onInput={handlePasswordInput}
                autocomplete="current-password"
                autofocus
                required
              />
              <Show when={error()}>
                {(msg) => <Field.ErrorText>{msg()}</Field.ErrorText>}
              </Show>
            </Field.Root>
            <Button
              type="submit"
              w="full"
              loading={submitting()}
              loadingText="Signing in…"
            >
              Sign in
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default LoginPage;
