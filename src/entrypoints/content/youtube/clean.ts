/** What subtitles drop or tidy away before they show. */

/** Sounds and bleeps, like `[Musik]`, `[ __ ]` or `♪`, which have nothing to look up. */
export const SOUND = /\[[^\]]*\]|♪/gu

/** A creator's cue that only describes a sound, like `(Helle Klänge)`. Parentheses inside a cue stay, because they can be part of what is said. */
export const SOUND_ONLY = /^\([^)]*\)$/u

/** One space between words, none at the ends. `\s` takes in no-break spaces, which creator tracks use for padding. */
export const tidy = (text: string): string => text.replace(/\s+/gu, " ").trim()
