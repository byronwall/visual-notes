import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type VoidComponent,
} from "solid-js";

type TitleEditPopoverProps = {
  initialTitle: string;
  onConfirm: (title: string) => void;
  onCancel: () => void;
  class?: string;
};

export const TitleEditPopover: VoidComponent<TitleEditPopoverProps> = (
  props
) => {
  const [value, setValue] = createSignal(props.initialTitle || "");
  let inputRef: HTMLInputElement | undefined;

  createEffect(() => {
    setValue(props.initialTitle || "");
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      try {
        console.log("[TitleEditPopover] ESC pressed → cancel");
      } catch {}
      props.onCancel();
    } else if (e.key === "Enter") {
      const v = value().trim();
      if (v.length === 0) return;
      try {
        console.log("[TitleEditPopover] ENTER pressed → confirm", v);
      } catch {}
      props.onConfirm(v);
    }
  };

  onMount(() => {
    if (inputRef) {
      inputRef.focus();
      try {
        inputRef.select();
      } catch {}
    }
    window.addEventListener("keydown", handleKeyDown as any);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown as any);
  });

  const handleChange = (e: InputEvent) => {
    const t = e.target as HTMLInputElement;
    setValue(t.value);
  };

  const handleConfirmClick = () => {
    const v = value().trim();
    if (v.length === 0) return;
    props.onConfirm(v);
  };

  const handleCancelClick = () => {
    props.onCancel();
  };

  return (
    <div
      class={`absolute -top-3 left-0 z-20 translate-y-[-100%] rounded-md border border-gray-300 bg-white shadow-lg p-2 flex items-center gap-2 ${
        props.class || ""
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={(el) => (inputRef = el)}
        type="text"
        value={value()}
        onInput={handleChange}
        class="w-64 px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        class="px-2 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
        onClick={handleConfirmClick}
      >
        Save
      </button>
      <button
        type="button"
        class="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
        onClick={handleCancelClick}
      >
        Cancel
      </button>
    </div>
  );
};
