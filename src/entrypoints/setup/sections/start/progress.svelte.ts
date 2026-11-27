import { getOnboarding, getServerByLang, ONBOARDING_KEY, setOnboarding, type Onboarding } from "$lib/storage"

/** The Get started list's steps, read from what the user has done, kept current as it changes in any tab. */
export class StartProgress {
  onboarding = $state.raw<Onboarding>({ tried: false, lookedUp: false, closed: false })
  /** Whether any language is bound to a server. */
  hasServer = $state(false)
  loaded = $state(false)

  /** In the sidebar and opened first, until it is done or skipped. */
  shown = $derived(this.loaded && !this.onboarding.closed)
  /** Server, sample lookup, real lookup. */
  steps = $derived([this.hasServer, this.onboarding.tried, this.onboarding.lookedUp])
  done = $derived(this.steps.filter(Boolean).length)

  load = async () => {
    const [onboarding, bound] = await Promise.all([getOnboarding(), getServerByLang()])
    this.onboarding = onboarding
    this.hasServer = Object.keys(bound).length > 0
    this.loaded = true
  }

  watch = (): (() => void) => {
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && [ONBOARDING_KEY, "serverByLang"].some((key) => key in changes)) {
        void this.load()
      }
    }
    browser.storage.onChanged.addListener(onChanged)
    return () => browser.storage.onChanged.removeListener(onChanged)
  }

  tried = () => setOnboarding({ tried: true })

  close = () => setOnboarding({ closed: true })
}
