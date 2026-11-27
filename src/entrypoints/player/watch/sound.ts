/** The player's volume and mute, kept from one video to the next. */
export type Sound = { volume: number; muted: boolean }

const empty: Sound = { volume: 1, muted: false }

/** Falls back to full volume, unmuted, for a missing or malformed value. */
export const getSound = async (): Promise<Sound> => {
  const { playerVolume, playerMuted } = await browser.storage.local.get(["playerVolume", "playerMuted"])
  return {
    volume:
      typeof playerVolume === "number" && playerVolume >= 0 && playerVolume <= 1
        ? playerVolume
        : empty.volume,
    muted: typeof playerMuted === "boolean" ? playerMuted : empty.muted,
  }
}

export const setSound = async ({ volume, muted }: Sound): Promise<void> => {
  await browser.storage.local.set({ playerVolume: volume, playerMuted: muted })
}
