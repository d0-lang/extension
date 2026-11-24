/**
 * The made-up lines the subtitle preview plays over and over, two people talking, each in the colour a creator might
 * give them. The second line takes two rows, to show the row it ends on staying.
 */
export const SAMPLE_CUES: ReadonlyArray<{ text: string; color: string }> = [
  { text: "Is this the last train going north tonight?", color: "#ffff00" },
  { text: "It is, but it only stops at the bigger stations along the coast.", color: "#00ffff" },
  { text: "Then we should buy something to eat first.", color: "#ffff00" },
  { text: "There's a bakery right by the exit.", color: "#00ffff" },
]

/** How long each line shows. */
export const SAMPLE_CUE_MS = 2600
