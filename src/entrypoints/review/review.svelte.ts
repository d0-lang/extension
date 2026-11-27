import { ankiErrorText } from "$lib/anki/connect"
import { lemmasInAnki } from "$lib/anki/duplicates"
import {
  addSeed,
  getAnkiEnabled,
  getAnkiTarget,
  getSeeds,
  isSeedKey,
  removeSeed,
  type CardDraft,
  type CardSeed,
} from "$lib/storage"
import { firstDraft } from "./fields"
import { sendCard } from "./send"

/** The sentence, a meaning by its index, or one of the buttons under them. */
export type Focus = "sentence" | number | "send" | "drop"

/** What can be edited: the sentence or a meaning. */
export type Editable = "sentence" | number

/** The kept words, the one being reviewed, and where the keys are in it. Picks and edits are kept with each word. */
export class Review {
  seeds = $state.raw<Array<CardSeed>>([])
  loaded = $state(false)
  /** The id of the word being reviewed. */
  currentId = $state<string>()
  focus = $state<Focus>(0)
  /** What is being edited, if anything. */
  editing = $state<Editable>()
  /** Set by the first drop, so the second one drops. Anything else in between undoes it. */
  dropArmed = $state(false)
  sending = $state(false)
  /** How many cards this page has sent. */
  sent = $state(0)
  /** How many sends this page has started, which the Send button plays as they start. */
  sends = $state(0)
  error = $state<string>()
  /** Lemmas Anki has a DaDict note for, among those asked. */
  inAnki = $state<Record<string, boolean>>({})
  /** The picks left on another entry, by word id and entry, to come back to. Gone with the page. */
  private leftEntries: Record<string, CardDraft> = {}
  /** Counts this page's writes, so a read that started before one does not undo it. */
  private writes = 0

  current = $derived(this.seeds.find((seed) => seed.id === this.currentId) ?? this.seeds[0])
  draft = $derived(this.current === undefined ? undefined : (this.current.draft ?? firstDraft(this.current)))
  entry = $derived(
    this.current === undefined || this.draft === undefined
      ? undefined
      : this.current.entries[this.draft.entry],
  )

  /** Reads the kept words, and again whenever one is kept, edited or let go, in this tab or another. */
  watch = (): (() => void) => {
    void this.load()
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && Object.keys(changes).some(isSeedKey)) {
        void this.load()
      }
    }
    browser.storage.onChanged.addListener(onChanged)
    return () => browser.storage.onChanged.removeListener(onChanged)
  }

  private load = async () => {
    const writes = this.writes
    const seeds = await getSeeds()
    // The write's own change event reads again.
    if (writes !== this.writes) {
      return
    }
    this.seeds = seeds
    this.loaded = true
    void this.checkAnki()
  }

  /** Asks Anki about the lemma shown, once per lemma. */
  checkAnki = async () => {
    const lemma = this.entry?.lemma
    if (lemma === undefined || Object.hasOwn(this.inAnki, lemma)) {
      return
    }
    const found = await lemmasInAnki(await getAnkiTarget(), [lemma])
    if (found.isOk()) {
      this.inAnki = { ...this.inAnki, [lemma]: found.value.includes(lemma) }
    }
  }

  /** Shows `draft` at once and keeps it with the word. Nothing changes while the word is being sent. */
  private save = (draft: CardDraft) => {
    const current = this.current
    if (current === undefined || this.sending) {
      return
    }
    const next = { ...current, draft }
    this.writes++
    this.seeds = this.seeds.map((seed) => (seed.id === current.id ? next : seed))
    addSeed(next).catch(() => {
      this.error = "Could not keep this change. Make it again before leaving the page."
    })
  }

  /** Whether `target` shows as selected: it has the keys, and is not being edited. */
  selected = (target: Focus): boolean => this.focus === target && this.editing !== target

  /** From the top: the sentence, when the word has one, its meanings, then the buttons. */
  private focusOrder = (): Array<Focus> => [
    ...(this.current?.sentence === undefined ? [] : (["sentence"] as const)),
    ...(this.entry?.senses.map((_, index) => index) ?? []),
    "send",
    "drop",
  ]

  /** Stops at either end. */
  moveFocus = (step: 1 | -1) => {
    const order = this.focusOrder()
    const index = order.indexOf(this.focus)
    this.focus = order[Math.min(Math.max(index + step, 0), order.length - 1)] ?? this.focus
  }

  toggleSense = (index: number) => {
    const draft = this.draft
    if (draft === undefined || this.entry === undefined || index >= this.entry.senses.length) {
      return
    }
    this.focus = index
    const senses = draft.senses.includes(index)
      ? draft.senses.filter((sense) => sense !== index)
      : [...draft.senses, index].sort((a, b) => a - b)
    this.save({ ...draft, senses })
  }

  /**
   * Another entry gets the meanings picked for it before, or its own first ones. An edited sentence stays.
   * The selection stays on the sentence or a button, and goes to the first meaning from a meaning.
   */
  pickEntry = (entry: number) => {
    const { current, draft } = this
    if (current === undefined || draft === undefined || entry === draft.entry || !current.entries[entry]) {
      return
    }
    this.leftEntries[`${current.id}:${draft.entry}`] = draft
    const left = this.leftEntries[`${current.id}:${entry}`]
    if (typeof this.focus === "number") {
      this.focus = 0
    }
    this.editing = undefined
    this.save({ ...(left ?? firstDraft(current, entry)), sentence: draft.sentence })
    void this.checkAnki()
  }

  /** Stops at either end. */
  stepEntry = (step: 1 | -1) => {
    const { current, draft } = this
    if (current !== undefined && draft !== undefined) {
      this.pickEntry(Math.min(Math.max(draft.entry + step, 0), current.entries.length - 1))
    }
  }

  edit = (target: Focus = this.focus) => {
    if (
      this.sending ||
      target === "send" ||
      target === "drop" ||
      (target === "sentence" && this.current?.sentence === undefined)
    ) {
      return
    }
    this.focus = target
    this.editing = target
  }

  /** What Space and Enter do on the selection: edit the sentence, pick a meaning, or press the button. */
  activate = () => {
    const focus = this.focus
    if (focus === "send") {
      void this.send()
    } else if (focus === "drop") {
      void this.drop()
    } else if (focus === "sentence") {
      this.edit(focus)
    } else {
      this.toggleSense(focus)
    }
  }

  /** Keeps `text` for what was edited and leaves editing, then sends the card. */
  keepAndSend = (target: Editable, text: string) => {
    this.keepEdit(target, text)
    void this.send()
  }

  /** Keeps `text` for what was edited. An edited meaning is picked too, as editing it says it is wanted. */
  keepEdit = (target: Editable, text: string) => {
    const draft = this.draft
    this.editing = undefined
    if (draft === undefined) {
      return
    }
    if (target === "sentence") {
      this.save({ ...draft, sentence: text })
      return
    }
    const senses = draft.senses.includes(target)
      ? draft.senses
      : [...draft.senses, target].sort((a, b) => a - b)
    this.save({ ...draft, senses, glosses: { ...draft.glosses, [String(target)]: text } })
  }

  cancelEdit = () => {
    this.editing = undefined
  }

  show = (id: string) => {
    this.currentId = id
    this.focus = 0
    this.editing = undefined
    this.dropArmed = false
    this.error = undefined
    void this.checkAnki()
  }

  /** Wraps around. */
  step = (step: 1 | -1) => {
    const index = this.seeds.findIndex((seed) => seed.id === this.current?.id)
    const next = this.seeds[(index + step + this.seeds.length) % this.seeds.length]
    if (next !== undefined) {
      this.show(next.id)
    }
  }

  /** The word after the current one, which is shown once the current one is gone. */
  private following = (): string | undefined => {
    const index = this.seeds.findIndex((seed) => seed.id === this.current?.id)
    return (this.seeds[index + 1] ?? this.seeds[index - 1])?.id
  }

  send = async () => {
    const { current, draft } = this
    if (current === undefined || draft === undefined || draft.senses.length === 0 || this.sending) {
      return
    }
    this.sending = true
    this.sends++
    this.error = undefined
    this.dropArmed = false
    // A storage read can still throw, and "Sending…" must not stay for good.
    try {
      // Counted with the end of "Sending…", so the two never show as one card too many.
      if (await this.sendWord(current, draft)) {
        this.sent++
      }
    } catch {
      this.error = "Could not send the card. Try again."
    } finally {
      this.sending = false
    }
  }

  /** Whether the card went to Anki and the word off the list. */
  private sendWord = async (current: CardSeed, draft: CardDraft): Promise<boolean> => {
    // The switch may have been turned off since this page opened.
    if (!(await getAnkiEnabled())) {
      this.error = "Adding words to Anki is off in Settings."
      return false
    }
    const next = this.following()
    const sent = await sendCard(current, draft)
    if (sent.isErr()) {
      this.error = ankiErrorText(sent.error)
      return false
    }
    // The user may have moved to another word while this one was sent.
    const lemma = current.entries[draft.entry]?.lemma ?? current.word
    if (!sent.value.removed) {
      // Sending it again would add a second card.
      this.inAnki = { ...this.inAnki, [lemma]: true }
      this.error = `${lemma} is in Anki, but could not be taken off this list. Drop it instead of sending it again.`
      return false
    }
    const stayed = this.currentId === undefined || this.currentId === current.id
    if (stayed && next !== undefined) {
      this.show(next)
    }
    return true
  }

  /** The first call only arms it. */
  drop = async () => {
    const current = this.current
    if (current === undefined) {
      return
    }
    if (!this.dropArmed) {
      this.dropArmed = true
      return
    }
    const next = this.following()
    this.dropArmed = false
    const dropped = await removeSeed(current.id).then(
      () => true,
      () => false,
    )
    if (!dropped) {
      this.error = "Could not drop the word. Try again."
      return
    }
    if (next !== undefined) {
      this.show(next)
    }
  }
}
