/*
 * Bound language rows plus the connect → review → save dialog.
 * `openAdd` / `acceptDraft` / `save` are the three steps; `closeDialog` aborts.
 * `openEdit` runs the same steps against a bound server.
 */
import { ResultAsync } from "neverthrow"
import { acceptedLegal, changedDocuments, creditSources, refreshLabels, type HandshakeOk } from "$lib/dict"
import {
  bindServer,
  contextSending,
  getServerByLang,
  getServerIssues,
  getServers,
  removeServer,
  type AcceptedLegal,
  type ContextSending,
  type ServerByLang,
  type Servers,
} from "$lib/storage"
import { Countdown } from "./countdown.svelte"
import type { DialogState, ServerRow } from "./types"

export class ServerSetup {
  rows = $state.raw<Array<ServerRow>>([])
  servers = $state.raw<Servers>({})
  serverByLang = $state.raw<ServerByLang>({})
  dialogState = $state<DialogState>("closed")
  draft = $state.raw<HandshakeOk | null>(null)
  selected = $state<Record<string, boolean>>({})
  /** Asked only when the draft lists the `context` feature. */
  context = $state<ContextSending>("unblocked")
  genericError = $state("")
  removeTarget = $state.raw<ServerRow | null>(null)
  removing = $state(false)
  removeError = $state("")
  /** Set while the add dialog reconnects to a bound server to change its languages. */
  editUrl = $state<string | undefined>(undefined)
  /** The policies the user last accepted for the draft's server. Unset when it is not bound yet. */
  accepted = $state.raw<AcceptedLegal | null | undefined>(undefined)
  /** Holds back saving a server without policies. */
  legalLock = new Countdown()

  saving = $derived(this.dialogState === "saving")
  /** The draft has no privacy policy or terms, so it is for testing only. */
  testingOnly = $derived(this.draft !== null && this.draft.meta.legal === undefined)
  /** Policies the draft changed since the user accepted them. Saving accepts them. */
  changedDocuments = $derived(
    this.draft === null ? [] : changedDocuments(this.accepted, this.draft.meta.legal),
  )
  isEditing = $derived(this.editUrl !== undefined)
  /** Saving binds a server that is not stored yet, rather than updating one. */
  isNew = $derived(
    this.draft !== null &&
      !(this.draft.url in this.servers) &&
      !(this.draft.movedFrom !== undefined && this.draft.movedFrom in this.servers),
  )

  selectedLanguages = $derived(
    Object.entries(this.selected)
      .filter(([, on]) => on)
      .map(([lang]) => lang),
  )
  /** A bound server may keep no languages, so accepting its new key never forces a choice. */
  canSave = $derived(
    this.selectedLanguages.length > 0 ||
      (this.draft !== null &&
        (this.draft.url in this.servers ||
          (this.draft.movedFrom !== undefined && this.draft.movedFrom in this.servers))),
  )
  allSelected = $derived(
    this.draft !== null &&
      this.draft.meta.languages.length > 0 &&
      this.draft.meta.languages.every((lang) => this.selected[lang]),
  )
  /** Languages mapped to this server that it no longer lists. Saving unmaps them. */
  droppedLanguages = $derived.by(() => {
    const draft = this.draft
    if (draft === null) {
      return []
    }
    return Object.entries(this.serverByLang)
      .filter(([lang, url]) => this.#belongsToDraft(url, draft) && !draft.meta.languages.includes(lang))
      .map(([lang]) => lang)
  })

  #belongsToDraft = (url: string, draft: HandshakeOk): boolean => url === draft.url || url === draft.movedFrom

  /** Name of the other server `lang` is mapped to. Saving it ticked moves it to the draft. */
  ownerElsewhere = (lang: string): string | undefined => {
    const url = this.serverByLang[lang]
    if (url === undefined || this.draft === null || this.#belongsToDraft(url, this.draft)) {
      return undefined
    }
    return this.servers[url]?.name ?? url
  }

  selectAll = (on: boolean) => {
    this.selected = Object.fromEntries((this.draft?.meta.languages ?? []).map((lang) => [lang, on]))
  }

  load = async () => {
    const [servers, nextServerByLang, issues] = await Promise.all([
      getServers(),
      getServerByLang(),
      getServerIssues(),
    ])
    this.servers = servers
    this.serverByLang = nextServerByLang
    const mapped = Object.entries(nextServerByLang)
    this.rows = Object.values(servers).map((server) => {
      const languages = mapped.filter(([, url]) => url === server.url).map(([lang]) => lang)
      return {
        url: server.url,
        name: server.name,
        languages,
        unoffered: languages.filter((lang) => !server.languages.includes(lang)),
        issue: issues[server.url]?.kind,
        context: server.features?.includes("context") === true ? contextSending(server) : undefined,
        sources: server.sources ?? [],
      }
    })
  }

  /** Reload when the startup check or another tab changes servers. Returns the unsubscribe. */
  watch = (): (() => void) => {
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (
        area === "local" &&
        ("servers" in changes || "serverByLang" in changes || "serverIssues" in changes)
      ) {
        void this.load()
      }
    }
    browser.storage.onChanged.addListener(onChanged)
    return () => browser.storage.onChanged.removeListener(onChanged)
  }

  askRemove = (row: ServerRow) => {
    this.removeError = ""
    this.removeTarget = row
  }

  cancelRemove = () => {
    if (!this.removing) {
      this.removeTarget = null
    }
  }

  confirmRemove = async () => {
    if (this.removeTarget === null) {
      return
    }
    this.removing = true
    this.removeError = ""
    const result = await removeServer(this.removeTarget.url).andThen(() =>
      ResultAsync.fromPromise(this.load(), (cause) =>
        cause instanceof Error ? cause : new Error(String(cause)),
      ),
    )
    this.removing = false
    if (result.isErr()) {
      this.removeError = result.error.message
      return
    }
    this.removeTarget = null
  }

  resetDialog = () => {
    this.legalLock.stop()
    this.accepted = undefined
    this.editUrl = undefined
    this.draft = null
    this.selected = {}
    this.genericError = ""
    this.dialogState = "closed"
  }

  openAdd = () => {
    this.editUrl = undefined
    this.draft = null
    this.selected = {}
    this.genericError = ""
    this.dialogState = "add-open"
  }

  /** Reconnect first, so the review lists what the server offers now. */
  openEdit = (row: ServerRow) => {
    this.openAdd()
    this.editUrl = row.url
  }

  acceptDraft = (result: HandshakeOk) => {
    if (this.dialogState !== "add-open") {
      return
    }
    this.draft = result
    const bound = this.servers[result.url] ?? this.servers[result.movedFrom ?? ""]
    this.context = bound === undefined ? "unblocked" : contextSending(bound)
    this.accepted = bound?.legal
    // A testing server the user already accepted does not warn again.
    if (result.meta.legal === undefined && bound?.legal !== null) {
      this.legalLock.start()
      // Without policies, sentences go only once the user turns them on in this warning.
      this.context = "none"
    }
    this.selected = Object.fromEntries(
      result.meta.languages.map((lang) => {
        const mapped = this.serverByLang[lang]
        return [lang, mapped !== undefined && this.#belongsToDraft(mapped, result)]
      }),
    )
    this.dialogState = "review-open"
  }

  /** Back from review to the connect step, keeping the typed address. */
  backToConnect = () => {
    if (this.dialogState === "review-open") {
      this.legalLock.stop()
      this.accepted = undefined
      this.draft = null
      this.selected = {}
      this.genericError = ""
      this.dialogState = "add-open"
    }
  }

  closeDialog = () => {
    if (this.dialogState !== "closed") {
      this.resetDialog()
    }
  }

  save = async () => {
    if (this.draft === null || !this.canSave || this.legalLock.locked) {
      return
    }
    this.dialogState = "saving"
    this.genericError = ""
    const result = await bindServer(
      {
        url: this.draft.url,
        key: this.draft.key,
        name: this.draft.meta.name,
        languages: this.draft.meta.languages,
        verificationUrls: this.draft.meta.verification_urls,
        features: this.draft.meta.features,
        context: this.context,
        legal: acceptedLegal(this.draft.meta.legal),
        sources: creditSources(this.draft.meta.sources),
      },
      this.selectedLanguages,
      this.draft.movedFrom,
    ).andThen(() =>
      ResultAsync.fromPromise(this.load(), (cause) =>
        cause instanceof Error ? cause : new Error(String(cause)),
      ),
    )
    if (this.dialogState !== "saving") {
      return
    }
    if (result.isErr()) {
      this.dialogState = "review-open"
      this.genericError = result.error.message
      return
    }
    // Saving can start a new pair, which needs its explanations. Lookups do not wait for them.
    const url = this.draft.url
    void refreshLabels(url).mapErr((error) => console.warn("Could not fetch label explanations", url, error))
    this.resetDialog()
  }
}
