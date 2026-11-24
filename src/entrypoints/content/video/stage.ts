/** A box laid over a video that has no player box around it, like a plain `<video controls>`, for the subtitles. */

const STAGE_ATTRIBUTE = "data-dadict-stage"

const SIDES = ["top", "left", "width", "height"] as const

export type Stage = {
  video: HTMLVideoElement
  element: HTMLElement
  /** Moves the box back over the video, which the page may have moved or resized. */
  follow: () => void
  remove: () => void
}

/**
 * Lays a box over `video`, next to it in the page so it scrolls and goes fullscreen with it. The box takes no clicks,
 * so the video's own controls still work under it.
 */
export const createStage = (video: HTMLVideoElement): Stage => {
  const element = document.createElement("div")
  element.setAttribute(STAGE_ATTRIBUTE, "")
  element.style.cssText =
    "position: absolute; top: 0; left: 0; margin: 0; padding: 0; border: 0; pointer-events: none"
  video.after(element)
  let at = { top: 0, left: 0, width: 0, height: 0 }

  const follow = () => {
    const box = video.getBoundingClientRect()
    const now = element.getBoundingClientRect()
    // Moved by how far it is off, since where `top` and `left` start from depends on the page.
    const next = {
      top: at.top + box.top - now.top,
      left: at.left + box.left - now.left,
      width: box.width,
      height: box.height,
    }
    if (SIDES.some((side) => Math.abs(next[side] - at[side]) >= 0.5)) {
      at = next
      Object.assign(element.style, {
        top: `${at.top}px`,
        left: `${at.left}px`,
        width: `${at.width}px`,
        height: `${at.height}px`,
      })
    }
  }
  follow()

  return { video, element, follow, remove: () => element.remove() }
}

/** Removes the boxes an earlier run of the content script left on the page. */
export const removeStages = () => {
  for (const stage of document.querySelectorAll(`[${STAGE_ATTRIBUTE}]`)) {
    stage.remove()
  }
}
