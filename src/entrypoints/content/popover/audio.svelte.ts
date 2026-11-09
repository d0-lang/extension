/** One pronunciation at a time. `playing` is the URL being fetched or played, `failed` the last one that could not play. */
export class AudioPlayer {
  playing = $state<string>()
  failed = $state<string>()

  #player: HTMLAudioElement | undefined

  stop = () => {
    this.#player?.pause()
    this.#player = undefined
    this.playing = undefined
  }

  /** Stops instead when `url` is the audio already going. */
  play = (url: string) => {
    const again = this.playing === url
    this.stop()
    if (again) {
      return
    }
    this.failed = undefined
    const next = new Audio(url)
    this.#player = next
    this.playing = url
    const fail = () => {
      if (this.#player === next) {
        this.stop()
        this.failed = url
      }
    }
    next.addEventListener("ended", () => {
      if (this.#player === next) {
        this.stop()
      }
    })
    next.addEventListener("error", fail)
    void next.play().catch(fail)
  }
}
