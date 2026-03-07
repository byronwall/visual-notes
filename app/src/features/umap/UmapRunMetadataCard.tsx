import { Show } from "solid-js";
import { Heading } from "~/components/ui/heading";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { formatRelativeTimestamp } from "~/features/umap/format";
import type { UmapRunMeta } from "~/features/umap/detail-types";
import { Box, Grid, Stack } from "styled-system/jsx";

type UmapRunMetadataCardProps = {
  meta: UmapRunMeta;
};

export function UmapRunMetadataCard(props: UmapRunMetadataCardProps) {
  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="l3" p="3">
      <Stack gap="2">
        <Heading as="h2" fontSize="sm">
          Run Metadata
        </Heading>
        <Grid gridTemplateColumns="auto 1fr" columnGap="3" rowGap="2" alignItems="start">
          <Text textStyle="xs" color="fg.subtle">
            ID
          </Text>
          <Text textStyle="xs" fontFamily="mono" lineBreak="anywhere">
            {props.meta.id}
          </Text>

          <Text textStyle="xs" color="fg.subtle">
            Embedding run
          </Text>
          <Link href={`/embeddings/${props.meta.embeddingRunId}`}>
            {props.meta.embeddingRunId}
          </Link>

          <Text textStyle="xs" color="fg.subtle">
            Created
          </Text>
          <Text textStyle="sm" color="fg.muted">
            {formatRelativeTimestamp(props.meta.createdAt)}
          </Text>

          <Text textStyle="xs" color="fg.subtle">
            Model artifact
          </Text>
          <Show
            when={props.meta.artifactPath}
            fallback={
              <Text textStyle="sm" color="fg.muted">
                Not available
              </Text>
            }
          >
            <Text textStyle="xs" fontFamily="mono" lineBreak="anywhere">
              {props.meta.artifactPath}
            </Text>
          </Show>
        </Grid>
      </Stack>
    </Box>
  );
}
