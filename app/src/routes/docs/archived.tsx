import { Meta, Title } from "@solidjs/meta";
import { Container } from "styled-system/jsx";
import { ArchivedNotesView } from "~/components/note-archive/ArchivedNotesView";

export default function ArchivedNotesRoute() {
  return (
    <Container py="6" px={{ base: "4", md: "6" }} maxW="5xl">
      <Title>Archived notes • Visual Notes</Title>
      <Meta property="og:title" content="Archived notes • Visual Notes" />
      <Meta
        name="description"
        content="Notes archived by cleanup, with the days left before each is deleted."
      />
      <ArchivedNotesView />
    </Container>
  );
}
