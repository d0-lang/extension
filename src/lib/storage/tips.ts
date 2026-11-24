/** Tips the extension gives until the viewer has done what they tell of. */

/** Whether the viewer has selected subtitle words with Shift, which the note on a copy tells of until then. */
export const getSubtitleSelectUsed = async (): Promise<boolean> => {
  const { subtitleSelectUsed } = await browser.storage.local.get("subtitleSelectUsed")
  return subtitleSelectUsed === true
}

export const setSubtitleSelectUsed = async (): Promise<void> => {
  await browser.storage.local.set({ subtitleSelectUsed: true })
}
