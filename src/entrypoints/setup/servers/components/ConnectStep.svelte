<script lang="ts">
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle"
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert"
  import { Button } from "$lib/components/ui/button"
  import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog"
  import { Input } from "$lib/components/ui/input"
  import { Label } from "$lib/components/ui/label"
  import { HandshakeSession } from "../HandshakeSession.svelte"
  import { ServerSetup } from "../ServerSetup.svelte"

  let {
    setup,
    session,
    url = $bindable(),
    onConnect,
  }: {
    setup: ServerSetup
    session: HandshakeSession
    url: string
    onConnect: () => void
  } = $props()

  const editName = $derived(setup.editUrl === undefined ? undefined : setup.servers[setup.editUrl]?.name)
</script>

{#snippet failure()}
  {#if session.brokenUrls !== null}
    <Alert variant="destructive">
      <AlertTitle>Can't verify this server</AlertTitle>
      <AlertDescription>
        <p>
          Its answer failed the signature check, so it can't be trusted. The server may be misconfigured, or
          someone may be tampering with the connection.
        </p>
        {#if session.brokenUrls.length > 0}
          <p class="mt-2">Check the maintainers' pages for news:</p>
          <ul class="mt-1 list-disc pl-4">
            {#each session.brokenUrls as href (href)}
              <li>
                <a class="underline" {href} target="_blank" rel="noreferrer">{href}</a>
              </li>
            {/each}
          </ul>
        {/if}
      </AlertDescription>
    </Alert>
  {:else if session.failure !== null}
    <Alert variant="destructive">
      <AlertTitle>{session.failure.text}</AlertTitle>
      {#if session.failure.details !== undefined}
        <AlertDescription>
          <details>
            <summary class="cursor-pointer">Details</summary>
            <p class="mt-1 font-mono text-xs wrap-anywhere">
              {session.failure.details}
            </p>
          </details>
        </AlertDescription>
      {/if}
    </Alert>
  {/if}
{/snippet}

{#if setup.editUrl === undefined}
  <DialogHeader>
    <DialogTitle>Add server</DialogTitle>
    <DialogDescription>Enter the address of a dictionary server.</DialogDescription>
  </DialogHeader>
  <form
    class="flex flex-col gap-4"
    onsubmit={(event) => {
      event.preventDefault()
      onConnect()
    }}
  >
    <div class="flex flex-col gap-2">
      <Label for="server-url">Server address</Label>
      <!-- svelte-ignore a11y_autofocus -->
      <Input
        id="server-url"
        type="text"
        inputmode="url"
        placeholder="https://dict.example.org"
        autocomplete="off"
        spellcheck="false"
        autofocus
        bind:value={url}
        oninput={session.clearWarnings}
      />
    </div>
    {@render failure()}
    <DialogFooter>
      <Button type="submit" disabled={session.connecting || url.trim() === ""}>
        {session.connecting ? "Connecting…" : "Connect"}
      </Button>
    </DialogFooter>
  </form>
{:else}
  <DialogHeader>
    <DialogTitle>Edit server</DialogTitle>
    <DialogDescription>{editName ?? setup.editUrl}</DialogDescription>
  </DialogHeader>
  {#if session.connecting}
    <p class="text-muted-foreground flex items-center gap-2" role="status">
      <LoaderCircleIcon class="size-4 animate-spin" />
      Getting the languages this server offers…
    </p>
  {:else}
    {@render failure()}
    <DialogFooter>
      <Button onclick={onConnect}>Try again</Button>
    </DialogFooter>
  {/if}
{/if}
