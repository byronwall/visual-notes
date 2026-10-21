import { Title } from "@solidjs/meta";
import { useParams } from "@solidjs/router";
import { ResearchTopicPage } from "~/components/research/ResearchTopicPage";
import { useRecordRecentView } from "~/services/recents/useRecordRecentView";

const ResearchTopicRoute = () => {
  const params = useParams<{ slug: string }>();
  useRecordRecentView("research", () => params.slug);
  return (
    <>
      <Title>Research • Visual Notes</Title>
      <ResearchTopicPage slug={params.slug} />
    </>
  );
};

export default ResearchTopicRoute;
