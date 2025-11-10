import { JSX } from "solid-js";

export function Toggle(props: { title?: string; class?: string; pressed?: boolean; onChange?: () => void; children: JSX.Element }) {
  return (
    <button
      type="button"
      title={props.title}
      class={`w-6 h-6 flex items-center justify-center rounded focus:outline-none focus-visible:ring focus-visible:ring-purple-400 focus-visible:ring-opacity-75 ${
        props.class || ""
      } ${props.pressed ? "bg-white/25" : ""}`}
      onClick={props.onChange}
    >
      {props.children}
    </button>
  );
}


