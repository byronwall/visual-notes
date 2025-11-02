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
    <div class="mt-3">
      <label class="block text-xs text-gray-600 mb-1">Search</label>
      <input
        class="w-full border rounded px-2 py-1 text-sm"
        placeholder="Filter by title (client) and contents (server)"
        value={props.value}
        onInput={handleChange}
      />
    </div>
  );
};


