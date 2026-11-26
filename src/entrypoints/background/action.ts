/**
 * The toolbar button: the setup page until a language is bound, the popup after, and a badge while a server has an issue
 * or words wait to become Anki cards.
 */
import { getAnkiEnabled, getSeeds, getServerByLang, getServerIssues } from "$lib/storage"

// `--destructive` from tokens.css. The badge API takes a plain color, not a CSS variable.
const ISSUE_BADGE_COLOR = "#e7000b"
// Grey, so a count of kept words does not read as a problem.
const KEPT_BADGE_COLOR = "#52525b"

// Firefox MV2 only has `browserAction`.
export const action = browser.action ?? browser.browserAction

const isUnbound = async () => Object.keys(await getServerByLang()).length === 0

export const openSetup = async () => {
  await browser.tabs.create({ url: browser.runtime.getURL("/setup.html") })
}

export const openSetupIfUnbound = async () => {
  if (await isUnbound()) {
    await openSetup()
  }
}

/** Show the popup once a language is bound. Until then, a click opens the setup page. */
export const syncAction = async () => {
  // `onClicked` only fires while the action has no popup.
  await action.setPopup({ popup: (await isUnbound()) ? "" : "/popup.html" })
}

/** `!` on the button while any server has an issue, which comes first. Else how many words are kept for Anki. */
export const syncBadge = async () => {
  const [issues, ankiEnabled, seeds] = await Promise.all([getServerIssues(), getAnkiEnabled(), getSeeds()])
  if (Object.keys(issues).length > 0) {
    await action.setBadgeText({ text: "!" })
    await action.setBadgeBackgroundColor({ color: ISSUE_BADGE_COLOR })
    return
  }
  const kept = ankiEnabled ? seeds.length : 0
  await action.setBadgeText({ text: kept === 0 ? "" : String(kept) })
  if (kept > 0) {
    await action.setBadgeBackgroundColor({ color: KEPT_BADGE_COLOR })
  }
}
