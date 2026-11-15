/** Names the browser for the issue form, like `Firefox 158.0 on Linux`. */

/** A brand from `navigator.userAgentData`. */
type Brand = { brand: string; version: string }

const OS_NAMES: Record<string, string> = {
  android: "Android",
  cros: "ChromeOS",
  fuchsia: "Fuchsia",
  linux: "Linux",
  mac: "macOS",
  openbsd: "OpenBSD",
  win: "Windows",
}

/**
 * The brand to name a Chromium browser by: its own, like `Google Chrome` or `Microsoft Edge`, over `Chromium`.
 * Chromium also lists a made-up brand, like `Not_A Brand`, so sites cannot rely on the order.
 */
export const pickBrand = (brands: ReadonlyArray<Brand>): Brand | undefined => {
  const real = brands.filter(({ brand }) => !/not.a.brand/i.test(brand))
  return real.find(({ brand }) => brand !== "Chromium") ?? real[0]
}

/** Unset without a browser name, so the reporter fills it in. `os` is from `runtime.getPlatformInfo`. */
export const browserLabel = (
  browser: { name: string; version: string } | undefined,
  os: string | undefined,
): string | undefined => {
  if (browser === undefined) {
    return undefined
  }
  const osName = os === undefined ? undefined : (OS_NAMES[os] ?? os)
  return `${browser.name} ${browser.version}${osName === undefined ? "" : ` on ${osName}`}`
}

type UserAgentData = {
  brands: Array<Brand>
  getHighEntropyValues: (hints: Array<string>) => Promise<{ fullVersionList?: Array<Brand> }>
}

// Firefox only. Chrome tells through `navigator.userAgentData` instead.
type FirefoxRuntime = { getBrowserInfo?: () => Promise<{ name: string; version: string }> }

const browserInfo = async (): Promise<{ name: string; version: string } | undefined> => {
  const runtime = browser.runtime as FirefoxRuntime
  if (runtime.getBrowserInfo !== undefined) {
    const { name, version } = await runtime.getBrowserInfo()
    return { name, version }
  }
  const data = (navigator as { userAgentData?: UserAgentData }).userAgentData
  if (data === undefined) {
    return undefined
  }
  // `brands` has only the major version.
  const full = await data
    .getHighEntropyValues(["fullVersionList"])
    .then(({ fullVersionList }) => fullVersionList)
    .catch(() => undefined)
  const brand = pickBrand(full ?? data.brands)
  return brand === undefined ? undefined : { name: brand.brand, version: brand.version }
}

/** The browser, its version and the OS. Unset when the browser does not say which it is. */
export const describeBrowser = async (): Promise<string | undefined> => {
  const [info, platform] = await Promise.all([
    browserInfo().catch(() => undefined),
    browser.runtime.getPlatformInfo().catch(() => undefined),
  ])
  return browserLabel(info, platform?.os)
}
