import { useAction, useNavigate } from "@solidjs/router";
import { useAudioRecorder } from "~/features/audio-recorder/useAudioRecorder";
import { createDoc } from "~/services/docs.service";

const titleFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Create a new note and start recording into it from a single tap. */
export function useStartVoiceNote() {
  const recorder = useAudioRecorder();
  const create = useAction(createDoc);
  const navigate = useNavigate();

  return async () => {
    if (recorder.status() !== "idle") {
      const current = recorder.docId();
      if (current) navigate(`/docs/${current}`);
      return;
    }
    const title = `Voice note · ${titleFormat.format(new Date())}`;
    const docId = await recorder.start(async () => {
      const created = await create({
        title,
        html: `<h1>${title}</h1><p></p>`,
      });
      console.info("[voice-note] created", created.id);
      return created.id;
    });
    if (docId) navigate(`/docs/${docId}`);
  };
}
