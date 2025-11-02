export const LoadMoreButton = (props: {
  shown: number;
  total: number;
  onClick: () => void;
}) => {
  if (props.total <= props.shown) return null as unknown as any;
  return (
    <div class="mt-2">
      <button
        class="px-3 py-1.5 rounded bg-gray-100 border hover:bg-gray-200 text-sm"
        onClick={props.onClick}
      >
        Show more ({props.shown} / {props.total})
      </button>
    </div>
  );
};


