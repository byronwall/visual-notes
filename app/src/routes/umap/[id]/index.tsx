import { type VoidComponent, Show, createSignal, Suspense } from "solid-js";
import { createAsync, revalidate, useAction, useNavigate, useParams } from "@solidjs/router";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { Box, Container, Grid, Stack } from "styled-system/jsx";
import {
  fetchUmapPointsForRun,
  fetchUmapRun,
} from "~/services/umap/umap.queries";
import {
  deleteUmapRun,
  regenerateUmapRegionsAction,
} from "~/services/umap/umap.actions";
import { getParamEntries } from "~/features/umap/format";
import {
  type UmapDetailData,
  type UmapRunMeta,
  type UmapRunPointsData,
} from "~/features/umap/detail-types";
import { useUmapCanvas } from "~/features/umap/useUmapCanvas";
import { UmapRunCanvasCard } from "~/features/umap/UmapRunCanvasCard";
import { UmapRunMetadataCard } from "~/features/umap/UmapRunMetadataCard";
import { UmapRunParamsCard } from "~/features/umap/UmapRunParamsCard";
import { UmapRunRegionsCard } from "~/features/umap/UmapRunRegionsCard";

const UmapDetail: VoidComponent = () => {
  const params = useParams();
  const navigate = useNavigate();
  const runDelete = useAction(deleteUmapRun);
  const runRegenerateRegions = useAction(regenerateUmapRegionsAction);
  const [busy, setBusy] = createSignal(false);
  const [regeneratingRegions, setRegeneratingRegions] = createSignal(false);

  const detail = createAsync(async (): Promise<UmapDetailData | null> => {
    if (!params.id) return null;

    const run = (await fetchUmapRun(params.id)) as UmapRunMeta | null;
    if (!run) return null;

    const pointsData = (await fetchUmapPointsForRun(params.id).catch(() => null)) as
      | UmapRunPointsData
      | null;

    return {
      meta: run,
      dims: pointsData?.dims ?? run.dims,
      points: pointsData?.points ?? [],
    };
  });

  const { setCanvasContainerEl, setCanvasEl } = useUmapCanvas({ detail });

  const refreshPoints = () => {
    if (!params.id) return;
    void revalidate(fetchUmapPointsForRun.keyFor(params.id));
  };

  const handleDelete = async () => {
    if (!confirm("Delete this UMAP run?")) return;

    try {
      setBusy(true);
      console.log("[UmapDetail] deleteRun", { id: params.id });
      await runDelete({ id: params.id });
      navigate("/umap");
    } catch (error) {
      console.error(error);
      alert("Failed to delete run");
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerateRegions = async () => {
    if (!params.id) return;
    try {
      setRegeneratingRegions(true);
      await runRegenerateRegions({ id: params.id });
      await Promise.all([
        revalidate(fetchUmapRun.keyFor(params.id)),
        revalidate(fetchUmapPointsForRun.keyFor(params.id)),
      ]);
    } catch (error) {
      console.error(error);
      alert("Failed to regenerate regions");
    } finally {
      setRegeneratingRegions(false);
    }
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="4" px="4" maxW="1440px">
        <Suspense
          fallback={
            <Box borderWidth="1px" borderColor="border" borderRadius="l3" p="4">
              <Text textStyle="sm" color="fg.muted">
                Loading run…
              </Text>
            </Box>
          }
        >
          <Show
            when={detail()}
            fallback={
              <Box borderWidth="1px" borderColor="border" borderRadius="l3" p="4">
                <Text textStyle="sm" color="fg.muted">
                  This UMAP run could not be loaded.
                </Text>
                <Box mt="3">
                  <Link href="/umap">Back to UMAP</Link>
                </Box>
              </Box>
            }
          >
            {(result) => {
              const meta = result().meta;
              return (
                <Stack gap="4">
                  <Grid
                    gridTemplateColumns={{
                      base: "1fr",
                      xl: "minmax(0, 1.9fr) minmax(320px, 1fr)",
                    }}
                    gap="4"
                    alignItems="start"
                  >
                    <UmapRunCanvasCard
                      dims={result().dims}
                      pointsCount={result().points.length}
                      busy={busy()}
                      onRefresh={refreshPoints}
                      onDelete={handleDelete}
                      setCanvasContainerEl={setCanvasContainerEl}
                      setCanvasEl={setCanvasEl}
                    />

                    <Stack gap="3">
                      <UmapRunMetadataCard meta={meta} />
                      <UmapRunParamsCard paramEntries={getParamEntries(meta.params)} />
                    </Stack>
                  </Grid>

                  <UmapRunRegionsCard
                    runId={meta.id}
                    regions={meta.regions}
                    busy={regeneratingRegions()}
                    onRegenerate={handleRegenerateRegions}
                  />
                </Stack>
              );
            }}
          </Show>
        </Suspense>
      </Container>
    </Box>
  );
};

export default UmapDetail;
