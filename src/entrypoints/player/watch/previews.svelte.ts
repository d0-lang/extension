import { SvelteMap } from "svelte/reactivity"

/** How wide a preview frame is drawn. */
const WIDTH_PX = 160
/** At most this many frames per video, and at least this many seconds between them. */
const MAX_FRAMES = 300
const MIN_STEP_SECONDS = 2
/** Rest between frames taken in the background, so the playing video keeps the decoder. */
const REST_MS = 100

/**
 * Frames for the seek bar's hover preview, taken from a second, hidden copy of the video.
 * The frame under the pointer comes first. The rest fill in the background, spread over the whole video and
 * then between, so a preview anywhere soon has a frame near it.
 */
export class Previews {
  /** Frame index to object URL. */
  readonly frames = new SvelteMap<number, string>()
  #video = document.createElement("video")
  #canvas = document.createElement("canvas")
  #step = 0
  #count = 0
  #wanted: number | undefined
  #order: Array<number> = []
  #stopped = false
  #running = false

  constructor(url: string) {
    this.#video.muted = true
    this.#video.preload = "auto"
    this.#video.addEventListener("loadedmetadata", () => this.#start(), { once: true })
    this.#video.src = url
  }

  /** The frame nearest before `time`, falling back to the nearest one taken. Asks for it first if it is missing. */
  frameAt(time: number): string | undefined {
    if (this.#count === 0) {
      return undefined
    }
    const index = this.#indexOf(time)
    const frame = this.frames.get(index)
    if (frame !== undefined) {
      return frame
    }
    this.#wanted = index
    this.#run()
    return this.#nearest(index)
  }

  stop() {
    this.#stopped = true
    this.#video.removeAttribute("src")
    this.#video.load()
    for (const url of this.frames.values()) {
      URL.revokeObjectURL(url)
    }
    this.frames.clear()
  }

  #start() {
    const { duration, videoWidth, videoHeight } = this.#video
    if (!Number.isFinite(duration) || duration <= 0 || videoWidth === 0) {
      return
    }
    this.#step = Math.max(MIN_STEP_SECONDS, duration / MAX_FRAMES)
    this.#count = Math.ceil(duration / this.#step)
    this.#canvas.width = WIDTH_PX
    this.#canvas.height = Math.round((WIDTH_PX * videoHeight) / videoWidth)
    this.#order = spread(this.#count)
    this.#run()
  }

  #indexOf(time: number) {
    return Math.min(this.#count - 1, Math.max(0, Math.floor(time / this.#step)))
  }

  #nearest(index: number) {
    for (let distance = 1; distance < this.#count; distance++) {
      const frame = this.frames.get(index - distance) ?? this.frames.get(index + distance)
      if (frame !== undefined) {
        return frame
      }
    }
    return undefined
  }

  #next(): { index: number; wanted: boolean } | undefined {
    if (this.#wanted !== undefined && !this.frames.has(this.#wanted)) {
      return { index: this.#wanted, wanted: true }
    }
    while (this.#order.length > 0) {
      const index = this.#order.shift()!
      if (!this.frames.has(index)) {
        return { index, wanted: false }
      }
    }
    return undefined
  }

  async #run() {
    if (this.#running) {
      return
    }
    this.#running = true
    for (let next = this.#next(); next !== undefined && !this.#stopped; next = this.#next()) {
      if (!next.wanted) {
        await new Promise((resolve) => setTimeout(resolve, REST_MS))
        // The pointer may have asked for another frame meanwhile.
        if (this.#wanted !== undefined && !this.frames.has(this.#wanted)) {
          this.#order.unshift(next.index)
          continue
        }
      }
      const url = await this.#take(next.index)
      if (url === undefined || this.#stopped) {
        break
      }
      this.frames.set(next.index, url)
    }
    this.#running = false
  }

  /** Seeks the hidden copy to the middle of the frame's span and draws it. */
  async #take(index: number): Promise<string | undefined> {
    const listening = new AbortController()
    // A stop empties the copy mid-seek, and then it never seeks.
    const seeked = new Promise<boolean>((resolve) => {
      const options = { signal: listening.signal }
      this.#video.addEventListener("seeked", () => resolve(true), options)
      this.#video.addEventListener("error", () => resolve(false), options)
      this.#video.addEventListener("emptied", () => resolve(false), options)
    }).finally(() => listening.abort())
    const time = Math.min(this.#video.duration, (index + 0.5) * this.#step)
    // Firefox's fastSeek lands on the keyframe before, which is plenty for a preview and much faster.
    if (typeof this.#video.fastSeek === "function") {
      this.#video.fastSeek(time)
    } else {
      this.#video.currentTime = time
    }
    if (!(await seeked) || this.#stopped) {
      return undefined
    }
    const context = this.#canvas.getContext("2d")
    if (context === null) {
      return undefined
    }
    context.drawImage(this.#video, 0, 0, this.#canvas.width, this.#canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => this.#canvas.toBlob(resolve, "image/jpeg", 0.7))
    return blob === null ? undefined : URL.createObjectURL(blob)
  }
}

/** Indices below `count`, coarse to fine: the first, then each step halving the gap between those already in. */
export const spread = (count: number): Array<number> => {
  const order: Array<number> = []
  const seen = new Set<number>()
  for (let stride = 2 ** Math.ceil(Math.log2(Math.max(1, count))); stride >= 1; stride /= 2) {
    for (let index = 0; index < count; index += stride) {
      if (!seen.has(index)) {
        seen.add(index)
        order.push(index)
      }
    }
  }
  return order
}
