import {
  CalendarIcon,
  CircleDotIcon,
  ClockIcon,
  HashIcon,
  HistoryIcon,
  LinkIcon,
  ListIcon,
  MailIcon,
  PhoneIcon,
  SquareCheckIcon,
  StarIcon,
  TagsIcon,
  AlignLeftIcon,
  TypeIcon,
} from "lucide-solid";
import { Dynamic } from "solid-js/web";
import type { CollectionProperty, PropertyKind } from "~/lib/collections/types";
import { TITLE_PROPERTY_ID } from "~/lib/collections/types";

export const KIND_LABELS: Record<PropertyKind, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  status: "Status",
  multi_select: "Multi-select",
  date: "Date",
  checkbox: "Checkbox",
  created_time: "Created time",
  updated_time: "Updated time",
};

const iconFor = (property: Pick<CollectionProperty, "id" | "kind" | "config">) => {
  if (property.id === TITLE_PROPERTY_ID) return TypeIcon;
  const format = property.config?.format;
  switch (property.kind) {
    case "text":
      if (format === "url") return LinkIcon;
      if (format === "email") return MailIcon;
      if (format === "phone") return PhoneIcon;
      return AlignLeftIcon;
    case "number":
      return format === "rating" ? StarIcon : HashIcon;
    case "select":
      return CircleDotIcon;
    case "status":
      return CircleDotIcon;
    case "multi_select":
      return TagsIcon;
    case "date":
      return CalendarIcon;
    case "checkbox":
      return SquareCheckIcon;
    case "created_time":
      return ClockIcon;
    case "updated_time":
      return HistoryIcon;
    default:
      return ListIcon;
  }
};

export const PropertyKindIcon = (props: {
  property: Pick<CollectionProperty, "id" | "kind" | "config">;
  size?: number;
}) => <Dynamic component={iconFor(props.property)} size={props.size ?? 14} aria-hidden="true" />;
