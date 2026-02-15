import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";

const LegacyPathsRedirect = () => {
  const navigate = useNavigate();

  onMount(() => {
    navigate("/path", { replace: true });
  });

  return null;
};

export default LegacyPathsRedirect;
