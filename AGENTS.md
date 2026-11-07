# Extension

Dict client lives in `src/lib/dict`. Protocol is `../Protocol.md`.

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
