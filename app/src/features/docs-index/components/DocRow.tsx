import { A } from "@solidjs/router";
import { formatRelativeTime } from "../utils/time";
import { renderHighlighted } from "../utils/highlight";
import { MetaChips } from "./MetaChips";

export const DocRow = (props: {
  id: string;
  title: string;
  updatedAt: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  snippet?: string | null;
  query?: string;
  onFilterPath?: (p: string) => void;
  onFilterMeta?: (k: string, v: string) => void;
}) => {
  return (
    <li class="flex items-center justify-between border border-gray-200 rounded p-3 hover:bg-gray-50">
      <div class="min-w-0">
        <A href={`/docs/${props.id}`} class="font-medium hover:underline">
          {props.query
            ? renderHighlighted(props.title, props.query)
            : props.title}
        </A>
        {props.snippet && props.query ? (
          <div class="text-sm text-gray-600 mt-1 truncate">
            {renderHighlighted(props.snippet, props.query)}
          </div>
        ) : null}
      </div>
      <div class="flex items-center gap-2 text-sm text-gray-500 ml-3">
        {props.path && (
          <button
            type="button"
            class="text-xs px-2 py-0.5 rounded bg-gray-100 border hover:bg-gray-200"
            onClick={() => props.onFilterPath?.(props.path!)}
            title={`Filter by path: ${props.path}`}
          >
            {props.path}
          </button>
        )}
        <MetaChips meta={props.meta} onClick={props.onFilterMeta} />
        <span title={`Updated ${new Date(props.updatedAt).toLocaleString()}`}>
          {formatRelativeTime(props.updatedAt)}
        </span>
      </div>
    </li>
  );
};
