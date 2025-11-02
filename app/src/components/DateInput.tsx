import { createMemo, splitProps } from "solid-js";

export type DateInputProps = {
  id?: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  class?: string;
  "aria-label"?: string;
};

// Expects and returns a date-only string in the form YYYY-MM-DD
// Converts empty string to undefined
export function DateInput(props: DateInputProps) {
  const [local, rest] = splitProps(props, [
    "id",
    "value",
    "onChange",
    "placeholder",
    "min",
    "max",
    "class",
    "aria-label",
  ]);

  const inputValue = createMemo(() => local.value ?? "");

  const handleInput = (e: Event) => {
    const v = (e.currentTarget as HTMLInputElement).value;
    props.onChange(v.trim() ? v : undefined);
  };

  return (
    <input
      id={local.id}
      type="date"
      value={inputValue()}
      onInput={handleInput}
      placeholder={local.placeholder}
      min={local.min}
      max={local.max}
      class={local.class ?? "flex-1 border rounded px-2 py-1 text-sm"}
      aria-label={local["aria-label"]}
      autocomplete="off"
      autocapitalize="none"
      autocorrect="off"
      spellcheck={false}
      {...rest}
    />
  );
}

