import { useParams } from "@solidjs/router";
import { Show, Suspense } from "solid-js";
import { OrganizationView } from "~/components/people/OrganizationView";
import { OrgMark } from "~/components/people/OrgMark";
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
            heading={
              <span
                style={{ display: "inline-flex", gap: "0.75rem", "align-items": "center" }}
              >
                <OrgMark org={o()} size={40} />
                {o().name}
              </span>
            }
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
