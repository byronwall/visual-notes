import { Suspense } from "solid-js";
import { NetworkView } from "~/components/people/NetworkView";
import { PeopleShell } from "~/components/people/PeopleShell";
import { Skeleton } from "~/components/ui/skeleton";

export default function PeopleNetworkRoute() {
  return (
    <PeopleShell title="Network • People" heading="People" tabs>
      <Suspense fallback={<Skeleton h="40" />}>
        <NetworkView />
      </Suspense>
    </PeopleShell>
  );
}
