import { ark } from "@ark-ui/solid/factory";
import type { VoidComponent } from "solid-js";
import { Show, Suspense, onMount } from "solid-js";
import { useMagicAuth } from "~/hooks/useMagicAuth";
import { useLLMSidebar } from "~/components/ai/LLMSidebar";
import { onLLMSidebarEvent } from "~/components/ai/LLMSidebarBus";
import { Button } from "~/components/ui/button";
import { Image } from "~/components/ui/image";
import { Link } from "~/components/ui/link";
import {
  Box,
  Container,
  HStack,
  Spacer,
  VisuallyHidden,
  styled,
} from "styled-system/jsx";
import { button } from "styled-system/recipes";

const CtaLink = styled(ark.a, button);

export const Navbar: VoidComponent = () => {
  const { authed, logout } = useMagicAuth();
  const {
    open: openLLM,
    view: llmSidebarView,
    hasUnreadAny,
    hasLoadingAny,
  } = useLLMSidebar();

  const handleChatOpen = () => {
    openLLM();
  };

  const handleLogout = async () => {
    await logout();
  };

  onMount(() => {
    const off = onLLMSidebarEvent((e) => {
      if (e.type === "open") {
        openLLM(e.threadId);
      }
    });
    return () => {
      off();
    };
  });

  return (
    <Box as="nav" bg="bg.default" borderBottomWidth="1px" borderColor="border">
      <Container py="3" px="4" maxW="1200px">
        <HStack gap="4">
          <Link
            href="/"
            variant="plain"
            textDecorationLine="none"
            color="fg.default"
            _hover={{ textDecorationLine: "none" }}
          >
            <HStack gap="2">
              <Image
                src="/favicon-32x32.png"
                alt=""
                boxSize="6"
                fit="contain"
                borderRadius="l2"
              />
              <Box as="span" fontWeight="semibold" letterSpacing="tight">
                Visual Notes
              </Box>
            </HStack>
          </Link>

          <HStack gap="3" flexWrap="wrap" color="fg.muted" textStyle="sm">
            <Link href="/docs" variant="plain">
              Notes
            </Link>
            <Link href="/docs/new" variant="plain">
              New Note
            </Link>
            <Link href="/embeddings" variant="plain">
              Embeddings
            </Link>
            <Link href="/umap" variant="plain">
              UMAP
            </Link>
            <Link href="/ai" variant="plain">
              AI
            </Link>

            <Button variant="plain" size="sm" onClick={handleChatOpen}>
              <HStack gap="1.5">
                <Box as="span">Chat</Box>
                {/* Prefer unread over loading */}
                <Suspense fallback={null}>
                  {/* suspense needed since hasUnreadAny and hasLoadingAny depend on resources */}
                  <Box as="span" display="inline-flex" alignItems="center">
                    <VisuallyHidden>Chat status</VisuallyHidden>
                    <Show when={hasUnreadAny()}>
                      <Box
                        as="span"
                        ml="1"
                        boxSize="2"
                        borderRadius="full"
                        bg="blue.9"
                      />
                    </Show>
                    <Show when={!hasUnreadAny() && hasLoadingAny()}>
                      <Box
                        as="span"
                        ml="1"
                        boxSize="2"
                        borderRadius="full"
                        bg="amber.9"
                      />
                    </Show>
                  </Box>
                </Suspense>
              </HStack>
            </Button>
          </HStack>

          <Spacer />

          <Show
            when={authed()}
            fallback={
              <CtaLink
                href="/login"
                variant="solid"
                size="sm"
                colorPalette="green"
              >
                Sign in
              </CtaLink>
            }
          >
            <Button
              variant="outline"
              size="sm"
              colorPalette="red"
              onClick={handleLogout}
            >
              Sign out
            </Button>
          </Show>
        </HStack>
      </Container>
      {llmSidebarView}
    </Box>
  );
};
