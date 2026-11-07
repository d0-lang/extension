<script lang="ts">
  import { Button } from "$lib/components/ui/button"
  import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog"
  import { HandshakeSession } from "../HandshakeSession.svelte"

  let {
    session,
    onTrust,
    onCancel,
  }: {
    session: HandshakeSession
    onTrust: () => void
    onCancel: () => void
  } = $props()

  const urls = $derived(session.identityUrls ?? [])

  // The dialog is often open already, so its own focus on open never reaches this step.
  let cancel = $state<HTMLElement | null>(null)
  $effect(() => {
    cancel?.focus()
  })
</script>

<DialogHeader>
  <DialogTitle>This server's identity has changed</DialogTitle>
  <DialogDescription>
    Its signing key is not the one saved when you added it. Maintainers do this when they replace their key,
    but it also happens when someone impersonates the server.
  </DialogDescription>
</DialogHeader>
{#if urls.length > 0}
  <div class="flex flex-col gap-1">
    <p>Before trusting it, check whether the maintainers announced a new key:</p>
    <ul class="list-disc pl-4">
      {#each urls as href (href)}
        <li>
          <a class="underline wrap-anywhere" {href} target="_blank" rel="noreferrer">{href}</a>
        </li>
      {/each}
    </ul>
  </div>
{:else}
  <p>
    The server listed no pages to check this on. Only trust the new key if you know the change is expected.
  </p>
{/if}
<DialogFooter>
  <Button variant="destructive" disabled={session.identityLocked || session.connecting} onclick={onTrust}>
    {#if session.identityLocked}
      Trust new key ({session.lockSeconds})
    {:else}
      {session.connecting ? "Connecting…" : "Trust new key"}
    {/if}
  </Button>
  <Button bind:ref={cancel} onclick={onCancel}>Cancel</Button>
</DialogFooter>
