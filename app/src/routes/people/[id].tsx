import { useParams } from "@solidjs/router";
import { Show, Suspense } from "solid-js";
import { PeopleShell } from "~/components/people/PeopleShell";
import { PersonProfileView } from "~/components/people/PersonProfileView";
import { Skeleton } from "~/components/ui/skeleton";
import { fetchPerson } from "~/services/people/people.queries";
import { createKeptAsync } from "~/utils/kept-async";

export default function PersonRoute() {
  const params = useParams();
  const person = createKeptAsync(() => fetchPerson(params.id!));
  return (
    <Suspense fallback={<Skeleton h="40" m="8" />}>
      <Show
        when={person.latest}
        fallback={
          <PeopleShell
            title="Not found • People"
            heading="Person not found"
            backLink
          >
            <p>This person does not exist.</p>
          </PeopleShell>
        }
      >
        {(p) => (
          <PeopleShell
            title={`${p().displayName} • People`}
            heading={p().displayName}
            backLink
          >
            <PersonProfileView person={p()} />
          </PeopleShell>
        )}
      </Show>
    </Suspense>
  );
}
