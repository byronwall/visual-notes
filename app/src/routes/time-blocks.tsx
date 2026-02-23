import { Meta, Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { Container } from "styled-system/jsx";
import { WeeklyTimeBlocksCalendar } from "~/components/time-blocks/WeeklyTimeBlocksCalendar";

const TimeBlocksPage = () => {
  const [searchParams] = useSearchParams();
  const noteId = () => String(searchParams.noteId || "").trim();

  return (
    <Container
      py="3"
      px="4"
      maxW="7xl"
      h="100dvh"
      minH="0"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      <Title>Time Blocks • Visual Notes</Title>
      <Meta property="og:title" content="Time Blocks • Visual Notes" />
      <Meta
        name="description"
        content="Plan focused work sessions and link them to notes."
      />
      <WeeklyTimeBlocksCalendar initialNoteId={noteId() || undefined} />
    </Container>
  );
};

export default TimeBlocksPage;
