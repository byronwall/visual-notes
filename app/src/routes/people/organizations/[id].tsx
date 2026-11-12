import { useParams } from "@solidjs/router";
import { Show, Suspense } from "solid-js";
import { OrganizationView } from "~/components/people/OrganizationView";
import { PeopleShell } from "~/components/people/PeopleShell";
import { Skeleton } from "~/components/ui/skeleton";
import { fetchOrganization } from "~/services/people/people.queries";
import { createKeptAsync } from "~/utils/kept-async";

export default function OrganizationRoute() {
  const params = useParams();
  const org = createKeptAsync(() => fetchOrganization(params.id!));
  return (
    <Suspense fallback={<Skeleton h="40" m="8" />}>
      <Show
        when={org.latest}
        fallback={
          <PeopleShell
            title="Not found • Organizations"
            heading="Organization not found"
            backHref="/people/organizations"
            backLabel="Organizations"
          >
            <p>This organization does not exist.</p>
          </PeopleShell>
        }
      >
        {(o) => (
          <PeopleShell
            title={`${o().name} • Organizations`}
            heading={o().name}
            backHref="/people/organizations"
            backLabel="Organizations"
          >
            <OrganizationView organization={o()} />
          </PeopleShell>
        )}
      </Show>
    </Suspense>
  );
}
