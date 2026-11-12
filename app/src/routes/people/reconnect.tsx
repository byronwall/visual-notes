import { Suspense } from "solid-js";
import { PeopleShell } from "~/components/people/PeopleShell";
import { ReconnectView } from "~/components/people/ReconnectView";
import { Skeleton } from "~/components/ui/skeleton";

export default function PeopleReconnectRoute() {
  return (
    <PeopleShell title="Reconnect • People" heading="People" tabs>
      <Suspense fallback={<Skeleton h="20" />}>
        <ReconnectView />
      </Suspense>
    </PeopleShell>
  );
}
