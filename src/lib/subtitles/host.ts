/** What the subtitles need to know of the player they show in, which differs from site to site. */

export type Host = {
  /**
   * How far the player's own bars reach in from its top and bottom, in pixels, kept clear of the subtitles. Players
   * fade their bars out rather than take them out of the layout, so they can be measured while hidden. Read on every
   * frame, so a player whose bars take a lot of room can keep them clear only while they show.
   */
  bars: (player: HTMLElement) => { top: number; bottom: number }
  /** What the player draws its own subtitles in, hidden while the extension's show. */
  ownSubtitles?: string
  /** What the player draws its controls in, hidden while a lookup is open, since the pause for it would show them. */
  ownControls?: string
  /**
   * What darkens the whole video behind the player's controls, itself or by a `::before` or `::after`, kept clear while
   * the overlay is in it.
   */
  ownShade?: string
  /** What of the player's sits where the subtitles go and would be under them, hidden while the overlay is in it. */
  inTheWay?: string
  /** The player's own right-click menu, hidden when the subtitles' opens, since it would stay over it. */
  ownMenu?: string
}
