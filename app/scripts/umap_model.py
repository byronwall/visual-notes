#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any

import joblib
import numpy as np

os.environ.setdefault(
  "NUMBA_CACHE_DIR", str(Path(tempfile.gettempdir()) / "vn-numba-cache")
)

import umap
from sklearn.decomposition import PCA

DEFAULT_RANDOM_STATE = 42


def _load_json(path: Path) -> dict[str, Any]:
  with path.open("r", encoding="utf-8") as handle:
    payload = json.load(handle)
  if not isinstance(payload, dict):
    raise ValueError("Input JSON must be an object")
  return payload


def _write_json(path: Path, payload: dict[str, Any]) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  with path.open("w", encoding="utf-8") as handle:
    json.dump(payload, handle, separators=(",", ":"))


def _matrix_from_payload(payload: dict[str, Any]) -> np.ndarray:
  matrix = np.asarray(payload.get("matrix", []), dtype=np.float32)
  if matrix.ndim != 2:
    raise ValueError("matrix must be a 2D array")
  if matrix.shape[0] == 0:
    raise ValueError("matrix must not be empty")
  return matrix


def _params(payload: dict[str, Any]) -> dict[str, Any]:
  raw = payload.get("params")
  if raw is None:
    return {}
  if not isinstance(raw, dict):
    raise ValueError("params must be an object")
  return raw


def _train(args: argparse.Namespace) -> None:
  payload = _load_json(Path(args.input))
  matrix = _matrix_from_payload(payload)
  params = _params(payload)

  dims = int(payload.get("dims", 2))
  if dims not in (2, 3):
    raise ValueError("dims must be 2 or 3")

  random_state = int(params.get("randomState", DEFAULT_RANDOM_STATE))
  pca_vars_to_keep = int(params.get("pcaVarsToKeep", 50))

  pca: PCA | None = None
  fit_matrix = matrix
  pca_components = 0

  if pca_vars_to_keep > 0 and matrix.shape[1] > 1:
    pca_components = min(pca_vars_to_keep, matrix.shape[0], matrix.shape[1])
    if pca_components < matrix.shape[1]:
      pca = PCA(n_components=pca_components, random_state=random_state)
      fit_matrix = pca.fit_transform(matrix).astype(np.float32, copy=False)

  umap_kwargs: dict[str, Any] = {
    "n_components": dims,
    "n_neighbors": int(params.get("nNeighbors", 15)),
    "min_dist": float(params.get("minDist", 0.1)),
    "metric": str(params.get("metric", "cosine")),
    "random_state": random_state,
    "transform_seed": random_state,
  }

  optional_mapping = {
    "learningRate": ("learning_rate", float),
    "nEpochs": ("n_epochs", int),
    "localConnectivity": ("local_connectivity", int),
    "repulsionStrength": ("repulsion_strength", float),
    "negativeSampleRate": ("negative_sample_rate", int),
    "setOpMixRatio": ("set_op_mix_ratio", float),
    "spread": ("spread", float),
    "init": ("init", str),
  }

  for key, (out_key, caster) in optional_mapping.items():
    value = params.get(key)
    if value is None:
      continue
    umap_kwargs[out_key] = caster(value)

  fit_start = time.perf_counter()
  reducer = umap.UMAP(**umap_kwargs)
  points = reducer.fit_transform(fit_matrix).astype(np.float32, copy=False)
  fit_ms = (time.perf_counter() - fit_start) * 1000.0

  artifact_payload = {
    "reducer": reducer,
    "pca": pca,
    "meta": {
      "dims": dims,
      "input_dims": int(matrix.shape[1]),
      "reduced_dims": int(fit_matrix.shape[1]),
      "count": int(matrix.shape[0]),
      "pca_components": int(pca_components if pca is not None else 0),
      "params": params,
      "random_state": random_state,
      "trained_at_unix": time.time(),
    },
  }

  artifact_path = Path(args.artifact)
  artifact_path.parent.mkdir(parents=True, exist_ok=True)
  joblib.dump(artifact_payload, artifact_path, compress=3)

  _write_json(
    Path(args.output),
    {
      "count": int(points.shape[0]),
      "dims": int(points.shape[1]),
      "points": points.tolist(),
      "fitMs": fit_ms,
      "pcaComponents": int(artifact_payload["meta"]["pca_components"]),
    },
  )


def _transform(args: argparse.Namespace) -> None:
  payload = _load_json(Path(args.input))
  matrix = _matrix_from_payload(payload)

  artifact = joblib.load(Path(args.artifact))
  reducer = artifact.get("reducer")
  pca = artifact.get("pca")
  meta = artifact.get("meta") or {}
  trained_dims = int(meta.get("dims", 2))
  input_dims = int(meta.get("input_dims", matrix.shape[1]))

  requested_dims = payload.get("dims")
  if requested_dims is not None and int(requested_dims) != trained_dims:
    raise ValueError(
      f"Requested dims {requested_dims} do not match model dims {trained_dims}"
    )

  if pca is None and matrix.shape[1] != input_dims:
    raise ValueError(
      f"Input vectors have {matrix.shape[1]} dims but model expects {input_dims}"
    )

  transform_input = matrix
  if pca is not None:
    transform_input = pca.transform(matrix).astype(np.float32, copy=False)

  start = time.perf_counter()
  points = reducer.transform(transform_input).astype(np.float32, copy=False)
  transform_ms = (time.perf_counter() - start) * 1000.0

  _write_json(
    Path(args.output),
    {
      "count": int(points.shape[0]),
      "dims": int(points.shape[1]),
      "points": points.tolist(),
      "transformMs": transform_ms,
    },
  )


def _check(args: argparse.Namespace) -> None:
  payload = {
    "ok": True,
    "numpy": np.__version__,
    "umap": getattr(umap, "__version__", "unknown"),
  }
  _write_json(Path(args.output), payload)


def main() -> None:
  parser = argparse.ArgumentParser(description="UMAP model trainer/transformer")
  subparsers = parser.add_subparsers(dest="command", required=True)

  train = subparsers.add_parser("train", help="Fit and persist a UMAP model")
  train.add_argument("--input", required=True)
  train.add_argument("--output", required=True)
  train.add_argument("--artifact", required=True)
  train.set_defaults(func=_train)

  transform = subparsers.add_parser("transform", help="Project vectors using a persisted model")
  transform.add_argument("--input", required=True)
  transform.add_argument("--output", required=True)
  transform.add_argument("--artifact", required=True)
  transform.set_defaults(func=_transform)

  check = subparsers.add_parser("check", help="Dependency smoke test")
  check.add_argument("--output", required=True)
  check.set_defaults(func=_check)

  args = parser.parse_args()
  args.func(args)


if __name__ == "__main__":
  main()
