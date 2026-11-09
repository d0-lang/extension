/** The protocol locks the identity and testing-server warnings for 5 seconds. */
export const WARNING_LOCK_SECONDS = 5

/** Seconds left before a locked warning can be accepted. */
export class Countdown {
  seconds = $state(0)

  locked = $derived(this.seconds > 0)

  #timer: ReturnType<typeof setInterval> | undefined

  /** Starts over from `seconds`. */
  start = (seconds = WARNING_LOCK_SECONDS) => {
    this.stop()
    this.seconds = seconds
    this.#timer = setInterval(() => {
      this.seconds -= 1
      if (this.seconds <= 0) {
        this.stop()
      }
    }, 1000)
  }

  stop = () => {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer)
      this.#timer = undefined
    }
    this.seconds = 0
  }
}
