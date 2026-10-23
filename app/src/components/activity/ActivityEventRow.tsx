import {
  ActivityIcon,
  ArchiveIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  FileTextIcon,
  FlaskConicalIcon,
  ListChecksIcon,
  PlugIcon,
  TableIcon,
  SearchIcon,
  SparklesIcon,
  WrenchIcon,
} from "lucide-solid";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Box, HStack, styled } from "styled-system/jsx";
import type { ActionEventItem } from "~/services/activity/activity.types";
import { type ActivityDomain, describeActivityEvent } from "./activity-format";

const domainIcon: Record<ActivityDomain, typeof ActivityIcon> = {
  doc: FileTextIcon,
  research: FlaskConicalIcon,
  task: ListChecksIcon,
  collection: TableIcon,
  time_block: CalendarClockIcon,
  event: CalendarDaysIcon,
  archive: ArchiveIcon,
  search: SearchIcon,
  ai: SparklesIcon,
  admin: WrenchIcon,
  mcp: PlugIcon,
  other: ActivityIcon,
};

type ActivityEventRowProps = {
  event: ActionEventItem;
  count: number;
  timeLabel: string;
  timeTitle: string;
};

export const ActivityEventRow = (props: ActivityEventRowProps) => {
  const description = () => describeActivityEvent(props.event);
  const isDanger = () => description().tone === "danger";

  return (
    <HStack
      gap="3"
      alignItems="baseline"
      px="3"
      py="1.5"
      borderRadius="l2"
      transitionProperty="background-color"
      transitionDuration="140ms"
      _hover={{ bg: "bg.subtle" }}
      flexWrap={{ base: "wrap", md: "nowrap" }}
      data-event-type={props.event.eventType}
    >
      <styled.time
        datetime={props.event.createdAt}
        title={props.timeTitle}
        flexShrink="0"
        w="14"
        fontSize="xs"
        color="fg.subtle"
        fontVariantNumeric="tabular-nums"
        whiteSpace="nowrap"
      >
        {props.timeLabel}
      </styled.time>
      <Box
        flexShrink="0"
        alignSelf="center"
        w="4"
        color={isDanger() ? "red.11" : "fg.muted"}
        display="inline-flex"
        justifyContent="center"
      >
        <Dynamic component={domainIcon[description().domain]} size={14} />
      </Box>
      <Box
        flex="1"
        minW="0"
        fontSize="sm"
        lineHeight="1.5"
        color="fg.default"
        overflowWrap="anywhere"
      >
        <styled.span color={isDanger() ? "red.11" : "fg.muted"}>
          {description().verb}
        </styled.span>
        <Show when={description().docTitle}>
          {(title) => (
            <>
              {" "}
              <Show
                when={description().docHref}
                fallback={
                  <styled.span fontWeight="medium">{title()}</styled.span>
                }
              >
                {(href) => (
                  <styled.a
                    href={href()}
                    fontWeight="medium"
                    color="fg.default"
                    borderRadius="l1"
                    transitionProperty="color"
                    transitionDuration="140ms"
                    _hover={{ color: "blue.11" }}
                  >
                    {title()}
                  </styled.a>
                )}
              </Show>
            </>
          )}
        </Show>
        <Show when={description().detail}>
          {(detail) => (
            <styled.span color="fg.muted">
              {" "}
              <Show when={description().href} fallback={detail()}>
                {(href) => (
                  <styled.a
                    href={href()}
                    color="fg.muted"
                    transitionProperty="color"
                    transitionDuration="140ms"
                    _hover={{ color: "blue.11" }}
                  >
                    {detail()}
                  </styled.a>
                )}
              </Show>
            </styled.span>
          )}
        </Show>
        <Show when={!description().detail && description().href}>
          {(href) => (
            <>
              {" "}
              <styled.a
                href={href()}
                color="fg.muted"
                _hover={{ color: "blue.11" }}
              >
                View
              </styled.a>
            </>
          )}
        </Show>
        <Show when={description().via}>
          {(via) => (
            <styled.span color="fg.subtle" fontSize="xs">
              {" · via "}
              {via()}
            </styled.span>
          )}
        </Show>
        <Show when={props.count > 1}>
          <styled.span
            ml="1.5"
            fontSize="xs"
            color="fg.subtle"
            fontVariantNumeric="tabular-nums"
          >
            {"×"}
            {props.count}
          </styled.span>
        </Show>
      </Box>
      <Show when={props.event.relatedDocPath}>
        {(path) => (
          <styled.span
            fontFamily="mono"
            fontSize="xs"
            color="fg.subtle"
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
            maxW={{ base: "100%", md: "40%" }}
            pl={{ base: "24", md: "0" }}
            title={path()}
          >
            {path()}
          </styled.span>
        )}
      </Show>
    </HStack>
  );
};
