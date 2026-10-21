import { Meta, Title } from "@solidjs/meta";
import { Navigate, useParams } from "@solidjs/router";
import { Show, createMemo } from "solid-js";
import { PathDetailView } from "~/features/path-view/components/PathDetailView";
import { routeParamToPath } from "~/utils/path-links";
import { useRecordRecentView } from "~/services/recents/useRecordRecentView";

const DocsPathPage = () => {
  const params = useParams();
  const path = createMemo(() => routeParamToPath(params.segments));
  useRecordRecentView("path", path);

  return (
    <Show when={path()} fallback={<Navigate href="/path" />}>
      {(current) => (
        <>
          <Title>{`${current()} • Paths • Visual Notes`}</Title>
          <Meta property="og:title" content={`${current()} • Visual Notes`} />
          <Meta name="description" content={`Notes filed under ${current()} and its subpaths.`} />
          <PathDetailView path={current()} />
        </>
      )}
    </Show>
  );
};

export default DocsPathPage;
