import { Suspense } from "solid-js";
import { DuplicatesView } from "~/components/people/DuplicatesView";
import { PeopleShell } from "~/components/people/PeopleShell";
import { Skeleton } from "~/components/ui/skeleton";

export default function PeopleDuplicatesRoute() {
  return (
    <PeopleShell title="Duplicates • People" heading="People" tabs>
      <Suspense fallback={<Skeleton h="20" />}>
        <DuplicatesView />
      </Suspense>
    </PeopleShell>
  );
}
