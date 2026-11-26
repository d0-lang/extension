<script lang="ts">
  import { fieldAction } from "./keys"

  let {
    value,
    label,
    keep,
    cancel,
    send,
    class: className,
  }: {
    /** The text it starts with. */
    value: string
    label: string
    keep: (text: string) => void
    cancel: () => void
    /** Keeps the text, then sends the card. */
    send: (text: string) => void
    class?: string
  } = $props()

  // Starts from `value` once, as the user's typing is what changes it from then on.
  // svelte-ignore state_referenced_locally
  let text = $state(value)
  /** Set once the edit is kept or cancelled, so the blur as the field goes does not keep it again. */
  let done = false

  const finish = (then: () => void) => {
    if (!done) {
      done = true
      then()
    }
  }

  /** Grows with the text, since a sentence can wrap over several lines. */
  const grow = (field: HTMLTextAreaElement) => {
    field.style.height = "auto"
    field.style.height = `${field.scrollHeight}px`
  }

  const start = (field: HTMLTextAreaElement) => {
    grow(field)
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const action = fieldAction(event)
    if (action === undefined) {
      return
    }
    // The page's own keys would act on these too.
    event.preventDefault()
    event.stopPropagation()
    if (action === "keep") {
      finish(() => keep(text))
    } else if (action === "cancel") {
      finish(cancel)
    } else {
      finish(() => send(text))
    }
  }
</script>

<textarea
  {@attach start}
  bind:value={text}
  rows="1"
  aria-label={label}
  class={[
    "border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-md border bg-transparent px-2 py-1 outline-none focus-visible:ring-3 dark:bg-input/30",
    className,
  ]}
  oninput={(event) => grow(event.currentTarget)}
  onkeydown={onKeyDown}
  onblur={() => finish(() => keep(text))}></textarea>
