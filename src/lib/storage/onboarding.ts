/** How far the Get started list in settings has come. */

/**
 * `tried` is the sample lookup on the list itself, `lookedUp` a first lookup on a real page. `closed` hides the list,
 * once it is done or skipped.
 */
export type Onboarding = { tried: boolean; lookedUp: boolean; closed: boolean }

/**
 * A key for each flag, so a write changes only its own. The settings page and the background both write them, and
 * one shared object would let a write from one bring back a flag the other just changed.
 */
const KEYS = {
  tried: "onboardingTried",
  lookedUp: "onboardingLookedUp",
  closed: "onboardingClosed",
} satisfies Record<keyof Onboarding, string>

export const ONBOARDING_KEYS = Object.values(KEYS)

export const getOnboarding = async (): Promise<Onboarding> => {
  const stored = await browser.storage.local.get(ONBOARDING_KEYS)
  const flag = (key: keyof Onboarding) => stored[KEYS[key]] === true
  return { tried: flag("tried"), lookedUp: flag("lookedUp"), closed: flag("closed") }
}

export const setOnboarding = async (patch: Partial<Onboarding>): Promise<void> => {
  const entries = Object.entries(patch).map(([key, on]) => [KEYS[key as keyof Onboarding], on])
  await browser.storage.local.set(Object.fromEntries(entries))
}

/** Stores the list as started, on install, so a later update knows it came with it. */
export const startOnboarding = (): Promise<void> => setOnboarding({ closed: false })

/** Ticks the real-page lookup, writing only the first time, as every lookup calls it. */
export const markLookedUp = async (): Promise<void> => {
  const { [KEYS.lookedUp]: lookedUp } = await browser.storage.local.get(KEYS.lookedUp)
  if (lookedUp !== true) {
    await setOnboarding({ lookedUp: true })
  }
}

/**
 * Closes the list for someone who set up a server before it existed, so an update does not greet them with it.
 * Leaves alone a list that was started on install, and anyone without a server yet, who still has it to do.
 */
export const closeOnboardingIfSetUp = async (hasServer: boolean): Promise<void> => {
  const { [KEYS.closed]: closed } = await browser.storage.local.get(KEYS.closed)
  if (closed === undefined && hasServer) {
    await setOnboarding({ closed: true })
  }
}
