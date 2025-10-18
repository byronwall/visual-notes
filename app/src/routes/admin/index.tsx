import { A } from "@solidjs/router";

export default function AdminHome() {
  return (
    <div class="p-6 space-y-4">
      <h2 class="text-xl font-semibold">Admin</h2>
      <ul class="list-disc pl-5 space-y-2">
        <li>
          <A href="/admin/prompts" class="text-blue-600 underline">
            Prompts
          </A>
        </li>
        <li>
          <A href="/admin/runs" class="text-blue-600 underline">
            Runs
          </A>
        </li>
        <li>
          <A href="/admin/llm-requests" class="text-blue-600 underline">
            All LLM requests
          </A>
        </li>
      </ul>
    </div>
  );
}
