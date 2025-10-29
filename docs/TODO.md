# Main Todo

## Major arcs - what to do next

1. Need to clean up HTML -> markdown pipeline - formatting + line breaks are busted - consider using HTML?
2. add features around lasso and AI on top of the notes
3. Public deploy so it's always available = replace task site for one off notes
4. Pull in Notion notes and start to think about hierarchies + databases

## Major goals or guiding lights - what's the point?

1. Want to be able to view/edit/grow reference notes and lists of related things
   1. Combine stuff that is longer form from Notion w/ the shorter links and bookmarks of Notes, Chrome, and other link tracking sites
      1. Basically... never lose a link
      2. Even better though, links will be brought into the fold so they immediate are adding to a whole in a useful way (or possibly more useful)

## ChatGPT import

- Review embedding token limits - hitting the limit by a ton on one request -- also why is this bringing down the whole thing?

> hook.js:608 Error: OpenAI embeddings error 400: {
> "error": {

    "message": "This model's maximum context length is 8192 tokens, however you requested 18742 tokens (18742 in your prompt; 0 for the completion). Please reduce your prompt; or completion length.",
    "type": "invalid_request_error",
    "param": null,
    "code": null

}
}

## Prisma + DB

- Need to add proper relations instead of just storing IDs as string

## UMAP

- Probably need some sort of algo to separate things after the UMAP run
- Consider if the PWA step is helping anything?
  - Running at 0, somewhat expensive to try a bunch rapidly
- Consider switching to python or something faster - ideally with the ability to save
  - Can call out via node or embed another server in Docker

## Doc editing

- Need to support tables
- Need to get some representative "hard" documents to test with

## CLI

- Add logs to show when things are skipped or duplicated. Want to avoid sitting and wondering what is going on.
- Apple Notes is going to be fickle to maintain the drip sync
  - Need to detect the edges of new + old, but hard to know if the upload was interrupted or incomplete

## Content

- Find all the notes with youtube links - organize those somehow
- Review link only notes and process them - load the apge with LLM and get a summary or something?
  - Or really, figure out what the goal is on these - they were meant to be for "future ref" - it'd be nice to know what they are and have that info available when reviewing similar stuff.
  - When processing, might just bring across all content if it's a short blog post or tweet or similar.

## Canvas

- Perf is not great - esp zooming - should really be better
- Maybe add a debounce on the mouse nearness changes - every frame or couple of frames is probably enough?
- Create a "focused" view that subsets based on locality and then allows me to work in there.
- Need to be able to "jump" over to left side listing without changing the sort order - some sort of "lock" or "jump" -- lock is better.
- Would be good to get a quick preview of the note content - for link only and short things - would save an open - should appear on hover that is long enough
- Mouse threshold for showing hover depends on zoom level
- Need a better color pallette - make it intentional - allow color to be a variable with dynamic data
- Disconnect between hover display and click display - clicking should open the note in the side panel -- use the exact same code somehow to ensure it always opens the one that the hover preview shows

## Embeddings

- Likely thrown off by the repeating elements - may want to strip out markdown formatting and URLs?

## General

- Need some sort of large table view or something of the embeddings
