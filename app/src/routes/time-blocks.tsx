import { Meta, Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { Box } from "styled-system/jsx";
import { WeeklyTimeBlocksCalendar } from "~/components/time-blocks/WeeklyTimeBlocksCalendar";

const TimeBlocksPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const noteId = () => String(searchParams.noteId || "").trim();

  return (
    <Box
      pt="3"
      pb={{ base: "2", md: "4" }}
      px={{ base: "2", md: "4" }}
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
      <WeeklyTimeBlocksCalendar
        initialNoteId={noteId() || undefined}
        onClearNoteFilter={() => setSearchParams({ noteId: undefined })}
      />
    </Box>
  );
};

export default TimeBlocksPage;
