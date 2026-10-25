# Experiment scripts

These are the scripts behind [results.md](../results.md). Note text, raw answers, and labels are not checked in. They were kept in a local scratch folder because they hold private notes.

To re-run, put everything in one folder:

1. Export notes with `notes_get` (MCP) into `notes.json`, a list of note objects with `markdown`.
2. Run `python3 -I prep.py notes.json states.json` to compute the code-side facts, clean the bodies, and assign the dev/holdout split.
3. Run `python3 -I run.py <note|note_rep|note_rev|note_v2|sections|pairs|llm> <jev|openai>`. It reads `TYPESAFE_API_KEY` and `OPENAI_API_KEY` from the environment and caches answers in `results/`.
4. Run `analyze.py` and `analyze_v2.py` to score against the reference labels in `labels_claude.json`.
5. Run `make_labeler.py out.html` to build the blind labeling page. Then run `analyze_byron.py` to score against the owner's `labels_byron.json`.

The note titles in `questions.py` (`PAIRS`) come from the sampled prod notes. Titles that name family members are redacted.
