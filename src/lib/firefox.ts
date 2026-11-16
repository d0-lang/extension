/** Firefox's name and version, from `runtime.getBrowserInfo`. Unset in Chrome, which does not have it. */
export const firefoxInfo = async (): Promise<{ name: string; version: string } | undefined> => {
  const runtime = browser.runtime as { getBrowserInfo?: () => Promise<{ name: string; version: string }> }
  if (runtime.getBrowserInfo === undefined) {
    return undefined
  }
  const { name, version } = await runtime.getBrowserInfo()
  return { name, version }
}
