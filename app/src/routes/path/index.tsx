import { Meta, Title } from "@solidjs/meta";
import { PathIndexView } from "~/features/path-view/components/PathIndexView";

const PathsIndexPage = () => (
  <>
    <Title>Paths • Visual Notes</Title>
    <Meta property="og:title" content="Paths • Visual Notes" />
    <Meta name="description" content="Browse every note path, with counts and recent activity." />
    <PathIndexView />
  </>
);

export default PathsIndexPage;
