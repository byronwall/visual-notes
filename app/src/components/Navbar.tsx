import { ark } from "@ark-ui/solid/factory";
import type { VoidComponent } from "solid-js";
import { For, Show, Suspense, createSignal, onMount } from "solid-js";
import { useLocation } from "@solidjs/router";
import { useMagicAuth } from "~/hooks/useMagicAuth";
import { useLLMSidebar } from "~/components/ai/LLMSidebar";
import { onLLMSidebarEvent } from "~/components/ai/LLMSidebarBus";
import { NewNoteModal } from "~/components/NewNoteModal";
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

type NavItem = {
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
};

export const Navbar: VoidComponent = () => {
  const { authed, logout } = useMagicAuth();
  const location = useLocation();
  const {
    open: openLLM,
    view: llmSidebarView,
    hasUnreadAny,
    hasLoadingAny,
  } = useLLMSidebar();

  const [newNoteOpen, setNewNoteOpen] = createSignal(false);

  const pathname = () => location.pathname;

  const isActiveExact = (href: string, path: string) => path === href;
  const isActiveSection = (href: string, path: string) =>
    path === href || path.startsWith(`${href}/`);

  const navLinkStyle = (active: boolean) => ({
    color: active ? "fg.default" : "fg.muted",
    fontWeight: active ? "semibold" : "normal",
    textDecorationLine: "none",
    borderBottomWidth: "2px",
    borderBottomColor: active ? "fg.default" : "transparent",
    pb: "1",
    _hover: {
      color: "fg.default",
      borderBottomColor: "fg.default",
      textDecorationLine: "none",
    },
  });

  const navItems: NavItem[] = [
    {
      label: "Canvas",
      href: "/canvas",
      isActive: (path) => isActiveSection("/canvas", path),
    },
    {
      label: "Embeddings",
      href: "/embeddings",
      isActive: (path) => isActiveSection("/embeddings", path),
    },
    {
      label: "UMAP",
      href: "/umap",
      isActive: (path) => isActiveSection("/umap", path),
    },
    {
      label: "AI",
      href: "/ai",
      isActive: (path) => isActiveSection("/ai", path),
    },
  ];

  const handleChatOpen = () => {
    openLLM();
  };

  const handleNewNoteOpen = () => {
    console.log("[navbar] open new note modal");
    setNewNoteOpen(true);
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
            <For each={navItems}>
              {(item) => (
                <Link
                  href={item.href}
                  variant="plain"
                  aria-current={item.isActive(pathname()) ? "page" : undefined}
                  {...navLinkStyle(item.isActive(pathname()))}
                >
                  {item.label}
                </Link>
              )}
            </For>

            <Button variant="plain" size="sm" onClick={handleNewNoteOpen}>
              New Note
            </Button>

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
      <NewNoteModal open={newNoteOpen()} onOpenChange={setNewNoteOpen} />
    </Box>
  );
};
