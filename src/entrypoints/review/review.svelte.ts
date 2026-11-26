import { ankiErrorText } from "$lib/anki/connect"
import { lemmasInAnki } from "$lib/anki/duplicates"
import { getAnkiTarget, getSeeds, isSeedKey, removeSeed, type CardSeed } from "$lib/storage"
import type { Choice } from "./fields"
import { sendCard } from "./send"

/** The entry the popover kept, with its only sense picked when it has one. Several wait for the user. */
const firstChoice = (seed: CardSeed): Choice => ({
  entry: seed.entry,
  senses: seed.entries[seed.entry]?.senses.length === 1 ? [0] : [],
})

/** The kept words, the one being reviewed, and what the user picked for each. */
export class Review {
  seeds = $state.raw<Array<CardSeed>>([])
  loaded = $state(false)
  /** The id of the word being reviewed. */
  currentId = $state<string>()
  /** Picks by word id. A word not picked yet has its `firstChoice`. */
  choices = $state<Record<string, Choice>>({})
  /** The sense the keys move between, by index. */
  focus = $state(0)
  sending = $state(false)
  error = $state<string>()
  /** Lemmas Anki has a DaDict note for, among those asked. */
  inAnki = $state<Record<string, boolean>>({})

  choiceOf = (seed: CardSeed): Choice =>
    Object.hasOwn(this.choices, seed.id) ? this.choices[seed.id]! : firstChoice(seed)

  current = $derived(this.seeds.find((seed) => seed.id === this.currentId) ?? this.seeds[0])
  choice = $derived(this.current === undefined ? undefined : this.choiceOf(this.current))
  entry = $derived(
    this.current === undefined || this.choice === undefined
      ? undefined
      : this.current.entries[this.choice.entry],
  )

  /** Reads the kept words, and again whenever one is kept or let go, in this tab or another. */
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
    this.seeds = await getSeeds()
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

  private pick = (choice: Choice) => {
    if (this.current !== undefined) {
      this.choices = { ...this.choices, [this.current.id]: choice }
    }
  }

  toggleSense = (index: number) => {
    const choice = this.choice
    if (choice === undefined || this.entry === undefined || index >= this.entry.senses.length) {
      return
    }
    this.focus = index
    const senses = choice.senses.includes(index)
      ? choice.senses.filter((sense) => sense !== index)
      : [...choice.senses, index].sort((a, b) => a - b)
    this.pick({ ...choice, senses })
  }

  pickEntry = (entry: number) => {
    const current = this.current
    if (current === undefined) {
      return
    }
    this.focus = 0
    this.pick({ entry, senses: current.entries[entry]?.senses.length === 1 ? [0] : [] })
    void this.checkAnki()
  }

  moveFocus = (step: 1 | -1) => {
    const count = this.entry?.senses.length ?? 0
    if (count > 0) {
      this.focus = (this.focus + step + count) % count
    }
  }

  show = (id: string) => {
    this.currentId = id
    this.focus = 0
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
    const { current, choice } = this
    if (current === undefined || choice === undefined || choice.senses.length === 0 || this.sending) {
      return
    }
    this.sending = true
    this.error = undefined
    const next = this.following()
    const sent = await sendCard(current, choice)
    this.sending = false
    if (sent.isErr()) {
      this.error = ankiErrorText(sent.error)
      return
    }
    if (next !== undefined) {
      this.show(next)
    }
  }

  drop = async () => {
    const current = this.current
    if (current === undefined) {
      return
    }
    const next = this.following()
    await removeSeed(current.id)
    if (next !== undefined) {
      this.show(next)
    }
  }
}
