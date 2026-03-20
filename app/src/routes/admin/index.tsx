import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { For } from "solid-js";
import { Box, Container, Grid, Stack, styled } from "styled-system/jsx";
import { button } from "styled-system/recipes";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";

const RouterButtonLink = styled(A, button);

const ADMIN_SECTIONS = [
  {
    title: "Explorer Admin",
    description:
      "Inspect captured HTML snapshots, review stored page content, and download the extension package.",
    href: "/admin/archive",
    cta: "Open explorer admin",
  },
  {
    title: "Image Migrations",
    description:
      "Review inline-image migration status, recent backups, and HEIC conversion utilities.",
    href: "/admin/migrations",
    cta: "Open image migrations",
  },
] as const;

const AdminIndexRoute = () => {
  return (
    <Box as="main" minH="100vh" bg="bg.default">
      <Title>Admin • Visual Notes</Title>
      <Container py="4" px="4" maxW="1200px">
        <Stack gap="4">
          <Stack
            gap="2"
            p="4"
            borderRadius="l3"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border"
          >
            <Text fontSize="2xl" fontWeight="semibold">
              Admin
            </Text>
            <Text color="fg.muted" fontSize="sm" maxW="720px">
              Pick the admin surface you want to inspect. Explorer and migration tools are
              split so snapshot review and maintenance work do not compete for space.
            </Text>
          </Stack>

          <Grid gap="3" gridTemplateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }}>
            <For each={ADMIN_SECTIONS}>
              {(section) => (
                <Stack
                  gap="3"
                  p="4"
                  borderRadius="l3"
                  borderWidth="1px"
                  borderColor="border"
                  bg="bg.default"
                >
                  <Stack gap="1">
                    <Text fontSize="lg" fontWeight="semibold">
                      {section.title}
                    </Text>
                    <Text color="fg.muted" fontSize="sm">
                      {section.description}
                    </Text>
                  </Stack>
                  <RouterButtonLink href={section.href} variant="solid" size="sm" w="fit-content">
                    {section.cta}
                  </RouterButtonLink>
                </Stack>
              )}
            </For>
          </Grid>

          <Stack
            gap="2"
            p="4"
            borderRadius="l3"
            borderWidth="1px"
            borderColor="border"
            bg="bg.default"
          >
            <Text fontWeight="semibold">Extension package</Text>
            <Text color="fg.muted" fontSize="sm">
              Until the Chrome extension is in the web store, download the local package from the
              Explorer admin tools.
            </Text>
            <Link href="/api/archive/extension-package" w="fit-content">
              Open extension download page
            </Link>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default AdminIndexRoute;
