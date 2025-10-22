# Main Todo

## Major arcs - what to do next

1. Need to clean up HTML -> markdown pipeline - formatting + line breaks are busted - consider using HTML?
2. add features around lasso and AI on top of the notes
3. Need to be able to edit notes

## Major goals or guiding lights - what's the point?

1. Want to be able to view/edit/grow reference notes and lists of related things
   1. Combine stuff that is longer form from Notion w/ the shorter links and bookmarks of Notes, Chrome, and other link tracking sites
      1. Basically... never lose a link
      2. Even better though, links will be brought into the fold so they immediate are adding to a whole in a useful way (or possibly more useful)

## Prisma + DB

- Need to add proper relations instead of just storing IDs as string

## UMAP

- Need to see the params for the UMAP run
- Need to be able to change the params for the UMAP run
- Goal is to get more local movement instead of 2 large global clusters -- really want to create small pockets of commonness
- Probably need some sort of algo to separate things after the UMAP run
- Consider if the PWA step is helping anything?
  - Running at 0, somewhat expensive to try a bunch rapidly
- Consider switching to python or something faster - ideally with the ability to save
  - Can call out via node or embed another server in Docker

## CLI

- Add logs to show when things are skipped or duplicated. Want to avoid sitting and wondering what is going on.

## Content

- Find all the notes with youtube links - organize those somehow
- Review link only notes and process them - load the apge with LLM and get a summary or something?
  - Or really, figure out what the goal is on these - they were meant to be for "future ref" - it'd be nice to know what they are and have that info available when reviewing similar stuff.
  - When processing, might just bring across all content if it's a short blog post or tweet or similar.

## Canvas

- Or keep the force thing and use it when we need to filter or change the view? **seems like a better idea**
- Give the stories a small square or rect layout - allow them to pack better
- Create a "focused" view that subsets based on locality and then allows me to work in there.
- Perf is not great - esp zooming - should really be better
- Maybe add a debounce on the mouse nearness changes - every frame or couple of frames is probably enough?
- Need to be able to "jump" over to left side listing without changing the sort order - some sort of "lock" or "jump" -- lock is better.
- Would be good to get a quick preview of the note content - for link only and short things - would save an open
- Mouse threshold for showing hover depends on zoom level
- Need a better color pallette - make it intentional - allow color to be a variable with dynamic data

## Embeddings

- Likely thrown off by the repeating elements - may want to strip out markdown formatting and URLs?

## General

- Need some sort of large table view or something of the embeddings
