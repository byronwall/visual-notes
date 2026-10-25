"""Question set v1. Vendor-neutral; adapters in run.py translate to Jev / OpenAI shapes.

Rules applied (see docs/intent/notes-cleanup-decisions/question-design.md): atomic questions, high = yes,
situations not adjectives for score levels, `other` on every choice, dates/counting kept in code.
"""

QUESTION_SET_VERSION = "v1"

NOTE_QUESTIONS = [
    dict(id="author_specific", type="noul", instructions=(
        "Does `note.body` contain something specific to `owner`: his own decisions, measurements, logs, plans, "
        "opinions, or results? A question he asked or a link he saved does not count by itself.")),
    dict(id="rederivable", type="noul", instructions=(
        "Could a person get the useful content of `note.body` today with one general web search or chatbot "
        "question, with nothing lost?")),
    dict(id="time_anchor", type="choice", instructions="What is `note.body` mainly organized around?", options=[
        ("ongoing_reference", "Reference or ideas that are useful at any time; not tied to a date."),
        ("one_event", "A single trip, outing, appointment, purchase, or event that happens once."),
        ("period_plan", "Plans, quotes, schedules, or options for one specific window of time."),
        ("dated_log", "A running record of entries describing what already happened on past dates."),
        ("other", "None of the above fits."),
    ]),
    dict(id="evergreen_core", type="noul", instructions=(
        "If `note.body` is about a dated event or plan, does it also contain information that would still be "
        "useful after that date, such as a packing list, contacts, lessons, or recurring sources? If it is not "
        "about a dated event or plan, answer yes.")),
    dict(id="tech_staleness", type="score", instructions=(
        "If `note.body` gives technical advice about software tools, libraries, or APIs, which describes it?"), levels=[
        ("no_technical_advice", "The note gives no technical advice about software tools, libraries, or APIs."),
        ("tools_still_standard", "It gives technical advice about tools that are still standard and maintained."),
        ("some_tools_replaced", "It mentions some tools or approaches that have since been replaced or deprecated."),
        ("centers_on_replaced", "It is built around tools or approaches that are now replaced or abandoned."),
    ]),
    dict(id="empty_or_stub", type="noul", instructions=(
        "Is `note.body` empty, a title with no content, or a single link or line with no explanation?")),
    dict(id="import_junk", type="noul", instructions=(
        "Is most of `note.body` leftover formatting from an import, such as delimiter rows (|||), lists of links "
        "to other pages, or metadata lines, rather than readable content?")),
    dict(id="kind", type="choice", instructions="What is `note.body` mostly?", options=[
        ("reference", "Facts, explanations, or specs to look things up in."),
        ("how_to", "Steps or a procedure for doing something."),
        ("log", "A record of what was done, with dates or in order."),
        ("plan", "Plans, options, or decisions for something upcoming."),
        ("idea", "An idea, concept, or brainstorm for something to build or try."),
        ("todo", "One or more tasks to do."),
        ("link_collection", "Mostly a list of links or resources with little text."),
        ("chat_transcript", "A conversation with a chatbot, with questions and answers."),
        ("journal", "Personal reflections or a diary entry."),
        ("list", "A list of items such as products, gear, names, or places."),
        ("other", "None of the above fits."),
    ]),
    dict(id="length_fit", type="score", instructions="Which describes how `note.body` uses its length?", levels=[
        ("too_little", "There is too little content to be useful."),
        ("short_complete", "It is short and says what it needs to."),
        ("long_entries", "It is long because it holds many entries, rows, or distinct items."),
        ("long_filler", "It is long because of repetition, chat back-and-forth, or filler."),
    ]),
    dict(id="is_todo", type="noul", instructions=(
        "Is the main content of `note.body` one or a few things `owner` intends to do but has not recorded as done?")),
    dict(id="worth_reading", type="noul", instructions=(
        "Would `owner` learn or recall something useful by reading `note.body` today?")),
    dict(id="title_fits", type="noul", instructions=(
        "Does `note.title` tell a reader what `note.body` is about, without opening it?")),
]

SECTION_QUESTIONS = lambda n: [q for i in range(n) for q in (
    dict(id=f"same_subject_{i}", type="noul",
         instructions=f"Is `note.sections[{i}]` about the same subject as `note.title`?"),
    dict(id=f"standalone_{i}", type="noul",
         instructions=f"Would `note.sections[{i}]` make sense as its own note to someone who had not read the rest?"),
)]

PAIR_QUESTIONS = [
    dict(id="relation", type="score", instructions="How do the notes `a` and `b` relate?", levels=[
        ("shares_words_only", "They are about different problems that happen to share some vocabulary."),
        ("same_area", "Same general area, but different problems or questions."),
        ("same_problem", "Same problem or question, approached from different angles."),
        ("same_content", "Mostly the same content repeated."),
    ]),
    dict(id="a_covers_b", type="noul", instructions="Is everything useful in `b.body` also present in `a.body`?"),
    dict(id="b_covers_a", type="noul", instructions="Is everything useful in `a.body` also present in `b.body`?"),
    dict(id="better_together", type="noul", instructions=(
        "Would `owner` be better served by one note combining `a` and `b` than by two separate notes?")),
]

# pairs by exact title; expected relation is my provisional label (sanity check only)
PAIRS = [
    ("CSS Animations and Transitions", "CSS Animations and Gradients", "same_area"),
    ("CSS Animations and Transitions", "CSS slide effect", "same_area"),
    ("CSS slide effect", "CSS animation on removal", "same_problem"),
    ("CSS Animations and Transitions", "CSS Rotation Animation Ease", "same_area"),
    ("CSS calc value in DevTools", "CSS tricks with calc", "same_area"),
    ("Backdrop-filter color shift", "Backdrop-filter blur fix", "same_problem"),
    ("Postgres Backup and Restore", "Database Backup and Import", "same_problem"),
    ("Allison Transmission Redback Propulsion", "Allison Transm. Redback Partnership", "same_content"),
    ("Math Games for Kids", "Math Games from 1990s", "same_area"),
    ("Math Games from 1990s", "Math &amp; Physics Games", "same_area"),
    ("math stats tsne", "math stats umap", "same_area"),
    ("Eyeglasses — Frame Options and Purchase Decision", "Eyeglass Frames — Virtual Try-On Shortlist", "same_problem"),
    ("Auto Insurance Coverage and Quote Comparison — October 23, 2026", "Progressive renewal benchmark: Oct 30–Apr 30", "same_problem"),
    ("js regex", "prog regex", "same_problem"),
    ("Cub Scout Camping Trip", "life camping", "same_area"),
    ("Replace bathroom exhaust fan motor", "house projects guest_exhaust_fan", "same_problem"),
    ("Snowflake role and user survey", "Snowflake roles and access testing", "same_problem"),
    ("Building log, March 2026", "Building log, January 2026", "same_area"),
    ("AI Companies in Indy", "AI events in Indy", "same_area"),
    ("Indy AI people", "AI Companies in Indy", "same_area"),
    ("Debugging SolidJs", "Understanding SolidJS Resources", "same_area"),
    ("Guidelines for SolidJS code", "Understanding SolidJS Resources", "same_area"),
    ("git rebase docs", "Cheat sheet for the gh cli command", "same_area"),
    ("js", "js yarn", "same_area"),
    ("house", "house wiring", "same_area"),
    ("October 20 2026 Research trails and reusable state", "October 18 2026 Evening repo reading", "same_area"),
    ("Whimsical Bear Backyard", "Backyard Scene Analysis", "same_area"),
    ("Color coding hex output", "Color palette generators", "same_area"),
    # negatives: shared vocabulary, different problems
    ("Back-to-School Information and Actions", "Backyard Scene Analysis", "shares_words_only"),
    ("Link in Navigator Share Text", "Page Links Created.", "shares_words_only"),
    ("Aluminum &amp; Alzheimer&#x27;s Link", "Link checker tools list", "shares_words_only"),
    ("house tips", "life coffee", "shares_words_only"),
    ("Power outage map", "JS Image Processing Libraries", "shares_words_only"),
    ("life knots", "woodwork table_saw", "shares_words_only"),
    ("Life is Short", "Life Expectancy by zip code", "shares_words_only"),
    ("<redacted: kid finance note>", "<redacted: games for a child>", "shares_words_only"),  # titles name family members
]

# v2 additions, asked in a separate request (task note_v2) so v1 answers stay comparable
NOTE_QUESTIONS_V2 = [
    dict(id="todo_list", type="noul", instructions=(
        "Is `note.body` mainly a short list of tasks or reminders for `owner`, rather than instructions, reference "
        "material, research, or a plan with supporting details?")),
    dict(id="copied_or_generated", type="noul", instructions=(
        "Was most of `note.body` copied from a website or produced by a chatbot or agent, rather than written by "
        "`owner` in his own words?")),
    dict(id="verdict", type="choice", instructions=(
        "Overall, what should `owner` do with this note during a cleanup of his notes?"), options=[
        ("keep", "Keep it as it is; it is useful or meaningful to him."),
        ("keep_but_trim", "Keep the useful part but cut or condense the rest."),
        ("archive", "Move it out of the way; it might matter someday but not now."),
        ("delete", "Delete it; it has no lasting value to him."),
        ("make_task", "Turn it into a task; it is really a to-do."),
    ]),
]
