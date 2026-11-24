/** Reads the YouTube player from its DOM, since its API lives in the page's own world. */
import type { Host } from "$lib/subtitles/host"

const HOSTS = new Set(["www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"])

/** Whether the page is YouTube or one of its embedded players. */
export const isYouTube = (hostname: string): boolean => HOSTS.has(hostname)

/** The video a page plays: `/watch?v=`, `/shorts/` or `/embed/`. */
export const videoIdOf = (url: URL): string | undefined => {
  const fromQuery = url.searchParams.get("v")
  if (fromQuery !== null && fromQuery !== "") {
    return fromQuery
  }
  return /^\/(?:shorts|embed|live)\/([\w-]+)/u.exec(url.pathname)?.[1]
}

/** The main player. Thumbnails that play on hover are players too, so the watch page's comes first. */
export const findPlayer = (): HTMLElement | null =>
  document.querySelector<HTMLElement>("#movie_player") ??
  document.querySelector<HTMLElement>(".html5-video-player")

export const videoIn = (player: HTMLElement): HTMLVideoElement | null => player.querySelector("video")

/** YouTube's player, for the subtitles shown in it. */
export const YOUTUBE_HOST: Host = {
  bars: (player) => {
    const box = player.getBoundingClientRect()
    // Players without a title, like the watch page's, keep the bar empty or hidden.
    const title = player.querySelector(".ytp-chrome-top")?.getBoundingClientRect()
    const controls = player.querySelector(".ytp-chrome-bottom")?.getBoundingClientRect()
    return {
      top: title === undefined || title.height === 0 ? 0 : Math.max(0, title.bottom - box.top),
      bottom: controls === undefined || controls.height === 0 ? 0 : Math.max(0, box.bottom - controls.top),
    }
  },
  ownSubtitles: ".ytp-caption-window-container",
  ownMenu: ".ytp-contextmenu",
}

/** Whether the viewer has the CC button on. */
export const captionsOn = (player: HTMLElement): boolean =>
  player.querySelector(".ytp-subtitles-button")?.getAttribute("aria-pressed") === "true"

export const adShowing = (player: HTMLElement): boolean => player.classList.contains("ad-showing")
