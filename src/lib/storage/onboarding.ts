/** How far the Get started list in settings has come. */

/**
 * `tried` is the sample lookup on the list itself, `lookedUp` a first lookup on a real page. `closed` hides the list,
 * once it is done or skipped.
 */
export type Onboarding = { tried: boolean; lookedUp: boolean; closed: boolean }

export const ONBOARDING_KEY = "onboarding"

const empty: Onboarding = { tried: false, lookedUp: false, closed: false }

const isOnboarding = (value: unknown): value is Partial<Onboarding> =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((field) => typeof field === "boolean")

export const getOnboarding = async (): Promise<Onboarding> => {
  const { [ONBOARDING_KEY]: stored } = await browser.storage.local.get(ONBOARDING_KEY)
  return isOnboarding(stored) ? { ...empty, ...stored } : empty
}

export const setOnboarding = async (patch: Partial<Onboarding>): Promise<void> => {
  await browser.storage.local.set({ [ONBOARDING_KEY]: { ...(await getOnboarding()), ...patch } })
}

/** Ticks the real-page lookup, writing only the first time, as every lookup calls it. */
export const markLookedUp = async (): Promise<void> => {
  if (!(await getOnboarding()).lookedUp) {
    await setOnboarding({ lookedUp: true })
  }
}

/**
 * Closes the list for someone who set up a server before it existed, so an update does not greet them with it.
 * Leaves alone a list that has been started, and anyone without a server yet, who still has it to do.
 */
export const closeOnboardingIfSetUp = async (hasServer: boolean): Promise<void> => {
  const { [ONBOARDING_KEY]: stored } = await browser.storage.local.get(ONBOARDING_KEY)
  if (stored === undefined && hasServer) {
    await setOnboarding({ closed: true })
  }
}
