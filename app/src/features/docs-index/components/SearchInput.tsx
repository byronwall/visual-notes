import type { VoidComponent } from "solid-js";

export const SearchInput: VoidComponent<{
  value: string;
  onChange: (v: string) => void;
}> = (props) => {
  const handleChange = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    props.onChange(target.value);
  };
  return (
    <div class="mt-3 flex items-center gap-2">
      <span class="text-xs text-gray-600 w-24 shrink-0">Search</span>
      <input
        class="flex-1 border rounded px-2 py-1 text-sm"
        placeholder="Filter by title (client) and contents (server)"
        value={props.value}
        onInput={handleChange}
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck={false}
      />
    </div>
  );
};


