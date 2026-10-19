import { Link, Meta, Title } from "@solidjs/meta";
import { Show } from "solid-js";

type SharedDocHeadProps = {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  modifiedAt: string;
};

export const SharedDocHead = (props: SharedDocHeadProps) => {
  const imageAlt = () => `Preview image for ${props.title}`;
  return (
    <>
      <Title>{`${props.title} • Visual Notes`}</Title>
      <Meta name="description" content={props.description} />
      <Show when={props.url}>
        <Link rel="canonical" href={props.url} />
        <Meta property="og:url" content={props.url} />
      </Show>
      <Meta property="og:site_name" content="Visual Notes" />
      <Meta property="og:type" content="article" />
      <Meta property="og:title" content={props.title} />
      <Meta property="og:description" content={props.description} />
      <Meta property="og:image" content={props.imageUrl} />
      <Meta property="og:image:alt" content={imageAlt()} />
      <Meta property="article:modified_time" content={props.modifiedAt} />
      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:title" content={props.title} />
      <Meta name="twitter:description" content={props.description} />
      <Meta name="twitter:image" content={props.imageUrl} />
      <Meta name="twitter:image:alt" content={imageAlt()} />
    </>
  );
};
