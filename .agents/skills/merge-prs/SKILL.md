---
name: merge-prs
description: Review and merge visual-notes pull requests or PR stacks. Use whenever asked to merge a PR, "merge the stack", "get these PRs merged", mark a stack ready and merge it, or resolve conflicts and land a stack. Checks each PR's base, runs a code review against CODING_STANDARDS.md, then merges bottom-up and proves the commits reached main.
---

# Merge PRs

Every PR from #94 to #145 merged with zero reviews, and #106 "merged" into a base branch that had already landed, so its fixes never reached main. This skill closes both gaps. Follow the steps in order for each PR, bottom of the stack first.

## 1. Map the stack

```sh
gh pr view <n> --json number,baseRefName,headRefName,state,isDraft,labels
```

Walk `baseRefName` down until you reach `main`. Merge from the bottom up.

## 2. Check every base

For each PR whose base is not `main`:

```sh
gh pr list --state merged --head <baseRefName> --json number --jq '.[0].number // empty'
```

If that prints a number, the base already merged. Retarget before anything else: `gh pr edit <n> --base main`, then rebase or merge `origin/main` into the branch if GitHub reports conflicts. The `Stack base` CI check fails on such PRs too.

## 3. Review each PR

Run the `code-review` skill on the PR (`/code-review <n>`, medium effort or higher for storage, migration, auth, or sync changes). The reviewer reads `CODING_STANDARDS.md`; point it there if it doesn't.

- Fix confirmed correctness findings on the PR's branch before merging, and push.
- Leave a PR comment that lists what the review found and what you fixed or left.
- If a finding needs the user's decision, stop and ask before merging that PR and everything above it.

A PR labelled `visuals-unverified` needs someone to look at its screenshots first. Look at them yourself if you can read images; otherwise ask the user.

## 4. Merge

Wait for CI to pass (`gh pr checks <n>`). Then merge bottom-up with `gh stack merge <top> --yes` when the stack is tracked by `gh stack`, or `gh pr merge <n> --merge` one PR at a time, retargeting the next PR to `main` after each.

## 5. Prove it landed

For every merged PR:

```sh
git fetch -q origin
git merge-base --is-ancestor "$(gh pr view <n> --json headRefOid --jq .headRefOid)" origin/main && echo on-main
```

A PR that shows as merged but is not an ancestor of `origin/main` merged into a dead branch. Re-land it from its commits on a new branch against `main`, and tell the user.

## 6. Check the deploy

Nothing deploys automatically. Before you act on production (an MCP write, a live check), or when the user says the site looks unchanged, compare production's commit with the merge:

```sh
curl -s https://notes.apps.byroni.us/api/version   # {"commit":"<sha>","startedAt":"…"}
git merge-base --is-ancestor <merged-head-sha> <prod-commit> && echo deployed
```

If it isn't deployed, or the commit is `unknown`, ask the user to deploy and stop there rather than guessing from output shapes. A redeploy doesn't refresh an MCP client's tool list; the user has to reconnect the connector.
