import { Title } from "@solidjs/meta";
import { useParams } from "@solidjs/router";
import { ResearchTopicPage } from "~/components/research/ResearchTopicPage";

const ResearchTopicRoute = () => {
  const params = useParams<{ slug: string }>();
  return (
    <>
      <Title>Research • Visual Notes</Title>
      <ResearchTopicPage slug={params.slug} />
    </>
  );
};

export default ResearchTopicRoute;
