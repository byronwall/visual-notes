import { PeopleImportView } from "~/components/people/PeopleImportView";
import { PeopleShell } from "~/components/people/PeopleShell";

export default function PeopleImportRoute() {
  return (
    <PeopleShell title="Import • People" heading="People" tabs>
      <PeopleImportView />
    </PeopleShell>
  );
}
