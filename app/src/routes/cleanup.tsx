import { Meta, Title } from "@solidjs/meta";
import { CleanupWorkspace } from "~/components/cleanup/CleanupWorkspace";

export default function CleanupRoute() {
  return (
    <>
      <Title>Cleanup • Visual Notes</Title>
      <Meta property="og:title" content="Cleanup • Visual Notes" />
      <Meta
        name="description"
        content="Review notes the cleanup pass flagged: distill, regroup, summarize, or archive."
      />
      <CleanupWorkspace />
    </>
  );
}
