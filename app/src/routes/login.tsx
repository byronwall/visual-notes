import { useNavigate } from "@solidjs/router";
import type { VoidComponent } from "solid-js";
import { createSignal, Show } from "solid-js";
import { useMagicAuth } from "~/hooks/useMagicAuth";
import { Box, Container, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Card from "~/components/ui/card";
import * as Field from "~/components/ui/field";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";

const LoginPage: VoidComponent = () => {
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const { refresh } = useMagicAuth();
  const navigate = useNavigate();

  const handlePasswordInput = (
    e: InputEvent & { currentTarget: HTMLInputElement }
  ) => {
    setPassword(e.currentTarget.value);
  };

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
    <Box as="main" minH="100vh" bg="bg.default">
      <Container py="4rem" px="1rem" maxW="420px">
        <Card.Root>
          <Card.Header>
            <Stack gap="0.25rem">
              <Heading as="h1" fontSize="lg" m="0">
                Sign in
              </Heading>
              <Text fontSize="sm" color="fg.muted" m="0">
                Enter the password to continue.
              </Text>
            </Stack>
          </Card.Header>
          <Card.Body>
            <Box as="form" onSubmit={onSubmit}>
              <Stack gap="0.75rem">
                <Field.Root invalid={Boolean(error())} required>
                  <Field.Label>Password</Field.Label>
                  <Input
                    id="password"
                    type="password"
                    value={password()}
                    onInput={handlePasswordInput}
                    autocomplete="current-password"
                    required
                  />
                </Field.Root>

                <Show when={error()}>
                  {(msg) => (
                    <Text fontSize="xs" color="red.11" m="0">
                      {msg()}
                    </Text>
                  )}
                </Show>

                <Button
                  type="submit"
                  w="full"
                  loading={submitting()}
                  loadingText="Signing in..."
                >
                  Sign in
                </Button>
              </Stack>
            </Box>
          </Card.Body>
        </Card.Root>
      </Container>
    </Box>
  );
};

export default LoginPage;
