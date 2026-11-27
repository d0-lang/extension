/** The DaDict note type: what each card holds and how Anki shows it. */
import { okAsync, type ResultAsync } from "neverthrow"
import * as z from "zod/mini"
import { invoke, modelNames, type AnkiError, type AnkiTarget } from "./connect"

export const NOTE_TYPE = "DaDict"

/** In Anki's order. `Word` is first because Anki looks for duplicates in the first field. */
export const FIELDS = [
  "Word",
  "Reading",
  "Pronunciation",
  "Part of speech",
  "Meaning",
  "Sentence",
  "Audio",
  "Source",
] as const

export type Field = (typeof FIELDS)[number]

// A word reached through a link has no sentence, so its front is the word.
// `dir="auto"` takes each field's direction from its own text, so Arabic or Hebrew reads right to left.
const QUESTION = `{{#Sentence}}<div class="sentence" dir="auto">{{Sentence}}</div>{{/Sentence}}{{^Sentence}}<div class="sentence" dir="auto">{{Word}}</div>{{/Sentence}}`

export const FRONT = `<div class="dadict">
  ${QUESTION}
</div>`

export const BACK = `<div class="dadict">
  ${QUESTION}
  <hr id="answer">
  <div class="head">
    <span class="word" dir="auto">{{Word}}</span>
    {{#Part of speech}}<span class="pos">{{Part of speech}}</span>{{/Part of speech}}
    {{Audio}}
  </div>
  {{#Reading}}<div class="reading" dir="auto">{{Reading}}</div>{{/Reading}}
  {{#Pronunciation}}<div class="ipa">{{Pronunciation}}</div>{{/Pronunciation}}
  <div class="meaning" dir="auto">{{Meaning}}</div>
  {{#Source}}<div class="source">{{Source}}</div>{{/Source}}
</div>`

// The variables are Anki's own, so the card follows its light and dark themes.
export const CSS = `.card {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans CJK JP", sans-serif;
  font-size: 20px;
  line-height: 1.5;
  text-align: start;
  color: var(--fg, #1f1f1f);
  background: var(--canvas, #fff);
}
.dadict { max-width: 36rem; margin: 0 auto; padding: 0.5rem 1rem; }
.sentence { font-size: 1.35em; line-height: 1.45; }
.sentence b { font-weight: 650; color: var(--accent-note, #2563eb); }
.nightMode .sentence b, .night_mode .sentence b { color: #7cb0ff; }
hr#answer { border: 0; border-top: 1px solid var(--border, #d4d4d4); margin: 0.75rem 0; }
.head { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.word { font-size: 1.2em; font-weight: 650; }
.pos, .ipa, .source { color: var(--fg-subtle, #737373); font-size: 0.8em; }
.reading { font-size: 0.95em; }
.head .replay-button svg { width: 1.4em; height: 1.4em; }
.meaning { margin-top: 0.5rem; }
.meaning ol { margin: 0; padding-inline-start: 1.4em; }
.meaning li + li { margin-top: 0.2em; }
.meaning p { margin: 0; }
.source { margin-top: 0.75rem; }
.source a { color: inherit; }
/* Many fonts put U+0301 after the letter instead of over it, so the accent is drawn, as in the popover. */
.stress { position: relative; }
.stress::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 0.1em;
  width: 0.08em;
  height: 0.26em;
  border-radius: 0.04em;
  background: currentColor;
  transform: translateX(-20%) rotate(40deg);
}
.stress[data-lift="1"]::after { top: -0.15em; }
.stress[data-lift="2"]::after { top: -0.36em; }`

/** Creates the note type when Anki has none by its name. One the user already has, maybe restyled, is left as it is. */
export const ensureNoteType = (target: AnkiTarget): ResultAsync<void, AnkiError> =>
  modelNames(target).andThen((names) =>
    names.includes(NOTE_TYPE)
      ? okAsync(undefined)
      : invoke(target, "createModel", z.unknown(), {
          modelName: NOTE_TYPE,
          inOrderFields: FIELDS,
          css: CSS,
          isCloze: false,
          cardTemplates: [{ Name: "Sentence", Front: FRONT, Back: BACK }],
        }).map(() => undefined),
  )
