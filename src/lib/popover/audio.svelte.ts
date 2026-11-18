import { ResultAsync } from "neverthrow"
import { fromUnknown } from "$lib/dict/errors"
import { requestAudio } from "$lib/messages"

/**
 * One pronunciation at a time. `playing` is the URL being fetched or played, `failed` the last one that could not play.
 * The background fetches the file, so the request carries nothing of the page.
 * It plays through Web Audio, which a page's policy on media hosts does not cover.
 */
export class AudioPlayer {
  playing = $state<string>()
  failed = $state<string>()

  #context: AudioContext | undefined

  stop = () => {
    void this.#context?.close()
    this.#context = undefined
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
    // Made during the press, because a page may only start sound from one.
    const context = new AudioContext()
    this.#context = context
    this.playing = url
    void requestAudio(url)
      .andThen((data) => ResultAsync.fromPromise(context.decodeAudioData(data), fromUnknown))
      .match(
        (buffer) => {
          if (this.#context !== context) {
            return
          }
          const source = context.createBufferSource()
          source.buffer = buffer
          source.connect(context.destination)
          source.addEventListener("ended", () => {
            if (this.#context === context) {
              this.stop()
            }
          })
          source.start()
        },
        () => {
          if (this.#context === context) {
            this.stop()
            this.failed = url
          }
        },
      )
  }
}
