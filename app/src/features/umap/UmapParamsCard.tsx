import { Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Box, Flex, Grid, Stack } from "styled-system/jsx";
import { INIT_ITEMS, METRIC_ITEMS, type UmapFormState } from "~/features/umap/types";
import { parseInit, parseMetric } from "~/features/umap/format";

type UmapParamsCardProps = {
  state: UmapFormState;
  onToggleAdvanced: () => void;
  onFieldChange: (
    field:
      | "pcaVarsToKeep"
      | "nNeighbors"
      | "minDist"
      | "metric"
      | "learningRate"
      | "nEpochs"
      | "localConnectivity"
      | "repulsionStrength"
      | "negativeSampleRate"
      | "setOpMixRatio"
      | "spread"
      | "init",
    value: string
  ) => void;
};

function Label(props: { children: string }) {
  return (
    <Box as="label" fontSize="xs" color="fg.muted">
      {props.children}
    </Box>
  );
}

function TextField(props: {
  label: string;
  type?: "text" | "number";
  value: string;
  placeholder: string;
  min?: string;
  max?: string;
  step?: string;
  onInput: (value: string) => void;
}) {
  return (
    <Stack gap="1">
      <Label>{props.label}</Label>
      <Input
        type={props.type ?? "text"}
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        placeholder={props.placeholder}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
    </Stack>
  );
}

export function UmapParamsCard(props: UmapParamsCardProps) {
  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="l2" bg="bg.default" p="3">
      <Stack gap="3">
        <Flex align="center" justify="space-between" gap="3" flexWrap="wrap">
          <Heading as="h2" fontSize="sm">
            UMAP Parameters
          </Heading>
          <Button size="xs" variant="outline" onClick={props.onToggleAdvanced}>
            <Show when={props.state.showAdvanced} fallback={"Advanced"}>
              Hide Advanced
            </Show>
          </Button>
        </Flex>

        <Grid
          gridTemplateColumns={{
            base: "1fr",
            md: "repeat(3, minmax(0, 1fr))",
          }}
          gap="3"
        >
          <TextField
            label="PCA variables to keep"
            type="number"
            min="1"
            value={props.state.pcaVarsToKeep}
            placeholder="50"
            onInput={(value) => props.onFieldChange("pcaVarsToKeep", value)}
          />
          <TextField
            label="nNeighbors"
            type="number"
            min="2"
            max="200"
            value={props.state.nNeighbors}
            placeholder="15"
            onInput={(value) => props.onFieldChange("nNeighbors", value)}
          />
          <TextField
            label="minDist"
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={props.state.minDist}
            placeholder="0.1"
            onInput={(value) => props.onFieldChange("minDist", value)}
          />

          <Stack gap="1">
            <SimpleSelect
              items={METRIC_ITEMS}
              value={props.state.metric}
              onChange={(value) => props.onFieldChange("metric", parseMetric(value))}
              label="metric"
              labelProps={{ fontSize: "xs", color: "fg.muted" }}
              skipPortal
              sameWidth
              placeholder="metric"
            />
          </Stack>

          <TextField
            label="learningRate (optional)"
            type="number"
            min="0"
            step="0.01"
            value={props.state.learningRate}
            placeholder="1.0"
            onInput={(value) => props.onFieldChange("learningRate", value)}
          />

          <Show when={!props.state.showAdvanced}>
            <Stack gap="1">
              <SimpleSelect
                items={INIT_ITEMS}
                value={props.state.init}
                onChange={(value) => props.onFieldChange("init", parseInit(value))}
                label="init"
                labelProps={{ fontSize: "xs", color: "fg.muted" }}
                skipPortal
                sameWidth
                placeholder="init"
              />
            </Stack>
          </Show>
        </Grid>

        <Show when={props.state.showAdvanced}>
          <Grid
            gridTemplateColumns={{
              base: "1fr",
              md: "repeat(3, minmax(0, 1fr))",
            }}
            gap="3"
          >
            <TextField
              label="nEpochs (optional)"
              type="number"
              min="1"
              value={props.state.nEpochs}
              placeholder="200"
              onInput={(value) => props.onFieldChange("nEpochs", value)}
            />
            <TextField
              label="localConnectivity (optional)"
              type="number"
              min="1"
              value={props.state.localConnectivity}
              placeholder="1"
              onInput={(value) => props.onFieldChange("localConnectivity", value)}
            />
            <TextField
              label="repulsionStrength (optional)"
              type="number"
              min="0"
              step="0.01"
              value={props.state.repulsionStrength}
              placeholder="1.0"
              onInput={(value) => props.onFieldChange("repulsionStrength", value)}
            />
            <TextField
              label="negativeSampleRate (optional)"
              type="number"
              min="1"
              value={props.state.negativeSampleRate}
              placeholder="5"
              onInput={(value) => props.onFieldChange("negativeSampleRate", value)}
            />
            <TextField
              label="setOpMixRatio (optional)"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={props.state.setOpMixRatio}
              placeholder="1.0"
              onInput={(value) => props.onFieldChange("setOpMixRatio", value)}
            />
            <TextField
              label="spread (optional)"
              type="number"
              min="0"
              step="0.01"
              value={props.state.spread}
              placeholder="1.0"
              onInput={(value) => props.onFieldChange("spread", value)}
            />
            <Stack gap="1">
              <SimpleSelect
                items={INIT_ITEMS}
                value={props.state.init}
                onChange={(value) => props.onFieldChange("init", parseInit(value))}
                label="init"
                labelProps={{ fontSize: "xs", color: "fg.muted" }}
                skipPortal
                sameWidth
                placeholder="init"
              />
            </Stack>
          </Grid>
        </Show>
      </Stack>
    </Box>
  );
}
