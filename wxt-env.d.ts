/// <reference types="svelte" />

interface ImportMetaEnv {
  /** The commit the build is made from, set in `wxt.config.ts`. Empty when not known, unset in tests. */
  readonly BUILD_COMMIT?: string
}
