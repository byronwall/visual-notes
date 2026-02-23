import { mount, StartClient } from "@solidjs/start/client";
import "solid-devtools";

export default mount(() => <StartClient />, document.getElementById("app")!);
