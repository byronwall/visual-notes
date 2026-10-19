import { Meta, Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

const notFoundTitle = "Shared note not found • Visual Notes";
const notFoundDescription =
  "That shared note no longer exists or is no longer public.";

export const ShareNotFound = () => (
  <Stack
    gap="3"
    alignItems="flex-start"
    maxW="560px"
    mx="auto"
    px={{ base: "4", md: "8" }}
    pt={{ base: "20", md: "32" }}
  >
    <HttpStatusCode code={404} />
    <Title>{notFoundTitle}</Title>
    <Meta name="robots" content="noindex" />
    <Meta name="description" content={notFoundDescription} />
    <Meta property="og:title" content={notFoundTitle} />
    <Meta property="og:description" content={notFoundDescription} />
    <Meta name="twitter:title" content={notFoundTitle} />
    <Meta name="twitter:description" content={notFoundDescription} />
    <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
      Visual Notes
    </Text>
    <Text as="h1" fontSize="3xl" fontWeight="bold" letterSpacing="-0.02em">
      This note isn’t shared anymore
    </Text>
    <Text color="fg.muted" lineHeight="1.6">
      The link may have been turned off by its owner, or the address may be
      mistyped. Ask the person who sent it for a fresh link.
    </Text>
    <A href="/login">
      <Button variant="outline" size="sm" mt="3">
        Open Visual Notes
      </Button>
    </A>
  </Stack>
);
