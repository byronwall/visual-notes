import { CopyIcon } from "lucide-solid";
import { For } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { useToasts } from "~/components/Toast";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import type { CalendarFeed } from "~/lib/events/types";
import { FeedSection } from "./FeedSection";

export const feedHttpUrl = (origin: string, token: string) =>
  `${origin}/cal/${token}.ics`;
export const feedWebcalUrl = (origin: string, token: string) =>
  feedHttpUrl(origin, token).replace(/^https?:\/\//, "webcal://");

/** The secret subscribe URL in https and webcal forms, with copy buttons. */
export function FeedSubscribeUrl(props: {
  feed: CalendarFeed;
  origin: string;
}) {
  const { show } = useToasts();
  const rows = () => [
    {
      label: "Subscribe URL",
      hint: "Google Calendar: Other calendars → From URL",
      value: feedHttpUrl(props.origin, props.feed.token),
    },
    {
      label: "webcal://",
      hint: "Opens Apple Calendar or Outlook directly",
      value: feedWebcalUrl(props.origin, props.feed.token),
    },
  ];
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      show({
        title: "Copied",
        message: "Anyone with this URL can read the feed.",
      });
    } catch {
      window.prompt("Copy the URL", value);
    }
  };

  return (
    <FeedSection title="Subscribe">
      <Stack gap="3">
        <For each={rows()}>
          {(row) => (
            <Stack gap="1" minW="0">
              <HStack justify="space-between" gap="2" minW="0">
                <Text fontSize="xs" fontWeight="medium" flexShrink="0">
                  {row.label}
                </Text>
                <Text fontSize="xs" color="fg.subtle" truncate minW="0">
                  {row.hint}
                </Text>
              </HStack>
              <HStack gap="1.5" minW="0">
                <Input
                  size="sm"
                  readOnly
                  value={row.value}
                  aria-label={row.label}
                  fontFamily="mono"
                  fontSize="xs"
                  flex="1"
                  minW="0"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <IconButton
                  size="sm"
                  variant="outline"
                  aria-label={`Copy ${row.label}`}
                  title="Copy"
                  onClick={() => void copy(row.value)}
                >
                  <CopyIcon />
                </IconButton>
              </HStack>
            </Stack>
          )}
        </For>
      </Stack>
    </FeedSection>
  );
}
