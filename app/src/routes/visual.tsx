import type { VoidComponent } from "solid-js";
import { onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";

const VisualRoute: VoidComponent = () => {
  const navigate = useNavigate();

  onMount(() => {
    console.log("[visual] redirecting to /canvas");
    navigate("/canvas", { replace: true });
  });

  return null;
};

export default VisualRoute;
