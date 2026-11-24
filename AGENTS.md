# Extension

Dict client lives in `src/lib/dict`. Protocol is `../protocol/PROTOCOL.md` ([d0-lang/protocol](https://github.com/d0-lang/protocol/blob/main/PROTOCOL.md)).

## Layout

```
src/
  entrypoints/   one folder per context: background, content, popup, setup
  lib/           code more than one entrypoint uses: dict client, storage, messages, theme, UI components
  styles/        app.css and the shared tokens
```

Code lives in the entrypoint folder that uses it. It moves to `lib/` once a second entrypoint needs it. Entrypoints do not import each other, and `lib/` does not import entrypoints.

An entrypoint's `index.ts` or `main.ts` only wires things up: listeners, mounting, and calls into named modules. Logic goes in those modules.

Inside an entrypoint, group files by job, like `content/youtube` for YouTube and `content/video` for other sites' videos. Split a folder once it mixes jobs, and split a component once it renders separate parts. Do not wait for it to get large.

Tests sit next to the file they test, as `name.test.ts`.

## Issues and pull requests

Issues and PRs follow the templates in `.github/`, and stay as short as the template.

## Formatting

Prettier, configured in `.prettierrc.json`. Run `bun run format` after editing.

## Comments

Match comments already in the tree.

Short JSDoc on exports: what it does, plus behaviour the types do not say. One line on a const only if the name is not enough. Inline comment only above a line that is easy to misread, and only why, not a restatement of the call.

Do not document TypeScript. Do not put error kinds in JSDoc when they already exist as types. Do not squeeze two ideas into one clause. Unfinished work is `// TODO:`.

Do not rewrite comments the user just edited unless they ask.

## neverthrow

Fallible dict code returns `Result` / `ResultAsync`. Do not throw on those paths.

A `safeTry` generator must return `ok(...)` or `err(...)`. `yield*` unwraps to the success value, so a recursive call inside `safeTry` is `return ok(yield* fn(...))`, not `return yield* fn(...)`. Prefer recursion over rewriting the same walk as a loop. Extra parameters used only for that recursion stay optional and callers leave them unset.

Map errors at the boundary that owns the user-facing kind. Do not act on untrusted payload fields until the body has verified.
