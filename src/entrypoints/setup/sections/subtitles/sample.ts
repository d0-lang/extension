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
    { text: "Did you remember to buy flour for the bread?", color: "#ffff00", ms: 2600 },
    {
      text: "I did, but the shop only had the expensive kind in small paper bags.",
      color: "#00ffff",
      ms: 2600,
    },
    { text: "Then we make one loaf instead of two.", color: "#ffff00", ms: 2600 },
    { text: "Fine, but I'm keeping the crust.", color: "#00ffff", ms: 2600 },
  ],
  fast: [
    { text: "Salt or sugar?", color: "#ffff00", ms: 900 },
    { text: "Salt!", color: "#00ffff", ms: 500 },
    { text: "Are you sure? The recipe says a spoon of sugar goes in first.", color: "#ffff00", ms: 1900 },
    { text: "No, but stir!", color: "#00ffff", ms: 700 },
    { text: "Okay, okay.", color: "#ffff00", ms: 1200 },
    { text: "It's boiling over!", color: "#00ffff", ms: 600 },
  ],
}
