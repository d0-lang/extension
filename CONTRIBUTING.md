# Contributing

This is a hobby project with one maintainer. I read everything, but a reply can take a while.

## What helps most

- **A page where DaDict doesn't work.** Open a "Doesn't work on a page" issue with your browser, the site and what happened. No code needed.
- **A fix for one browser.** Chrome and Firefox behave differently in small ways, and each fix helps.

A wrong or missing meaning is not an extension problem: meanings come from the dictionary server. Report it with **Report a problem** in the toolbar popup, or to whoever runs that server.

## Ask first for big changes

A small fix can go straight to a PR. For the changes below, open an issue and wait for my reply before you write code. I may say no, or want it done another way, and I don't want your work wasted.

- **The protocol** ([d0-lang/protocol](https://github.com/d0-lang/protocol)). Every server and every client has to follow a change to it.
- **A new browser permission.** The stores review it again, and every user is asked to accept it.
- **Sending more to a server** than the README's Privacy section says. That section is a promise to users.

## Setup

You need [Bun](https://bun.sh) 1.4.4.

```sh
bun install
bun run dev            # Chrome, with live reload
bun run dev:firefox    # Firefox, with live reload
bun run mock-server    # test dictionary servers on http://localhost:8787
```

Some tests run in headless Chromium: install it once with `bunx playwright install chromium`. `README.md` lists the other commands and the layout.

## Before you open a PR

- `bun run check`, `bun run test` and `bun run format:check` pass. CI runs the same three, and both builds.
- Try the change in Chrome and in Firefox, and say in the PR which you tried.
- Add a screenshot when the change is visible.
- One change per PR.
- Fill in the PR template and keep the description that short. Say what you checked and what you did not.

## Releasing

For maintainers.

1. Open a release PR that only bumps `version` in `package.json`, for example to `0.7.0`, and merge it.
2. Tag the merge commit and push the tag: `git tag v0.7.0 origin/main && git push origin v0.7.0`.
3. The release workflow builds the Chrome zip, the Firefox zip and the sources zip from that commit, and publishes them as a GitHub Release with the PRs merged since the last tag. It fails if the tag does not match `package.json` or is not on `main`.
4. Load both zips in their browser and try them.
5. Upload the Chrome zip to the Chrome Web Store, and the Firefox zip with the sources zip to addons.mozilla.org. The release notes are the starting point for the stores' "what's new".

CI does not upload to the stores: a store key in the repo's secrets could publish a version every user auto-updates to, if it leaked.

## AI-written changes

Fine. You answer for them: run the checks, read the diff yourself, and keep the description short. `AGENTS.md` has the rules agents follow in this repo.

## Security

Report a vulnerability privately, through "Report a vulnerability" on the repo's Security tab, not in a public issue.

## Licence

The code is MIT. By sending a change you agree it is under MIT too.
