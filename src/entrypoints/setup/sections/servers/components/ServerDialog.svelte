<script lang="ts">
  import { onMount } from "svelte"
  import { Dialog, DialogContent } from "$lib/components/ui/dialog"
  import type { HandshakeOk } from "$lib/dict"
  import { HandshakeSession } from "../HandshakeSession.svelte"
  import { hasMouse } from "../pointer"
  import { ServerSetup } from "../ServerSetup.svelte"
  import ConnectStep from "./ConnectStep.svelte"
  import IdentityStep from "./IdentityStep.svelte"
  import ReviewStep from "./ReviewStep.svelte"

  let { setup }: { setup: ServerSetup } = $props()

  const session = new HandshakeSession()
  let content = $state<HTMLElement | null>(null)
  let url = $state("")

  const finish = async (run: () => Promise<HandshakeOk | undefined>) => {
    const result = await run()
    if (result !== undefined) {
      setup.acceptDraft(result)
    }
  }

  const connect = () => finish(() => session.run(setup.editUrl ?? url))

  const close = () => {
    session.cancel()
    setup.closeDialog()
  }

  onMount(() => {
    if (setup.editUrl !== undefined) {
      void connect()
    }
  })
</script>

<Dialog
  open
  onOpenChange={(next) => {
    if (!next) {
      close()
    }
  }}
>
  <!-- On a phone the dialog takes the focus itself, not its first field, whose keyboard would cover it. -->
  <DialogContent
    bind:ref={content}
    class="flex max-h-[85svh] flex-col sm:max-w-md"
    onOpenAutoFocus={(event) => {
      if (!hasMouse()) {
        event.preventDefault()
        content?.focus()
      }
    }}
  >
    {#if setup.draft !== null}
      <ReviewStep {setup} />
    {:else if session.identityUrls !== null}
      <IdentityStep {session} onTrust={() => void finish(session.continue)} onCancel={close} />
    {:else}
      <ConnectStep {setup} {session} bind:url onConnect={() => void connect()} />
    {/if}
  </DialogContent>
</Dialog>
