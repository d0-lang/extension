/** How quickly the preview's lines change: like most videos, or like quick back-and-forth dialogue. */
export type Pace = "slow" | "fast"

/**
 * The made-up lines the subtitle preview plays over and over, two people talking, each in the colour a creator might
 * give them, and how long each shows. The slow lines' second takes two rows, to show the row it ends on staying.
 * The fast ones come at uneven times, as quick dialogue does, and quickly enough that Calm fast subtitles takes their
 * slide out.
 */
export const SAMPLES: Record<Pace, ReadonlyArray<{ text: string; color: string; ms: number }>> = {
  slow: [
    { text: "Is this the last train going north tonight?", color: "#ffff00", ms: 2600 },
    { text: "It is, but it only stops at the bigger stations along the coast.", color: "#00ffff", ms: 2600 },
    { text: "Then we should buy something to eat first.", color: "#ffff00", ms: 2600 },
    { text: "There's a bakery right by the exit.", color: "#00ffff", ms: 2600 },
  ],
  fast: [
    { text: "Left or right?", color: "#ffff00", ms: 900 },
    { text: "Left!", color: "#00ffff", ms: 500 },
    { text: "Are you sure? The map says the station is the other way.", color: "#ffff00", ms: 1900 },
    { text: "No, but go!", color: "#00ffff", ms: 700 },
    { text: "Okay, okay.", color: "#ffff00", ms: 1200 },
    { text: "Run, it's leaving!", color: "#00ffff", ms: 600 },
  ],
}
