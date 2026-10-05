<script lang="ts">
  import {
    Alert,
    AlertDescription,
    AlertTitle,
  } from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
  } from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { DEFAULT_BASE_URL, type HandshakeOk } from "$lib/dict";
  import { normalizeServerUrl } from "$lib/storage";
  import { HandshakeSession } from "../HandshakeSession.svelte";
  import { ServerSetup } from "../ServerSetup.svelte";

  let { setup }: { setup: ServerSetup } = $props();

  const session = new HandshakeSession();
  let url = $state(DEFAULT_BASE_URL);

  const finish = async (run: () => Promise<HandshakeOk | undefined>) => {
    const result = await run();
    if (result === undefined) {
      return;
    }
    setup.acceptDraft({
      url: normalizeServerUrl(url),
      key: result.key,
      meta: result.meta,
    });
  };
</script>

<Dialog
  open={setup.addOpen}
  onOpenChange={(next) => {
    if (!next) {
      session.cancel();
      setup.closeAdd();
    }
  }}
>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Add server</DialogTitle>
      <DialogDescription>
        Paste a dictionary server URL and connect.
      </DialogDescription>
    </DialogHeader>
    <form
      class="flex flex-col gap-3"
      onsubmit={(event) => {
        event.preventDefault();
        void finish(() => session.run(url));
      }}
    >
      <div class="flex flex-col gap-2">
        <Label for="server-url">Server URL</Label>
        <Input
          id="server-url"
          type="url"
          autocomplete="off"
          spellcheck="false"
          bind:value={url}
        />
      </div>
      <Button type="submit" disabled={session.connecting}>
        {session.connecting ? "Connecting…" : "Connect"}
      </Button>
    </form>

    {#if session.genericError}
      <Alert variant="destructive">
        <AlertTitle>Handshake failed</AlertTitle>
        <AlertDescription>{session.genericError}</AlertDescription>
      </Alert>
    {/if}

    {#if session.brokenUrls !== null}
      <Alert variant="destructive">
        <AlertTitle>Do not trust this response</AlertTitle>
        <AlertDescription>
          <p>
            The public key matches, but the metadata signature did not verify.
            This response is broken or has been tampered with, indicating a
            security risk.
          </p>
          {#if session.brokenUrls.length > 0}
            <p class="mt-2">
              Check a verification page from the last successful connection:
            </p>
            <ul class="mt-2 list-disc pl-4">
              {#each session.brokenUrls as href (href)}
                <li>
                  <a class="underline" {href} target="_blank" rel="noreferrer"
                    >{href}</a
                  >
                </li>
              {/each}
            </ul>
          {/if}
        </AlertDescription>
      </Alert>
    {/if}

    {#if session.identityUrls !== null}
      <Alert variant="destructive">
        <AlertTitle>Server identity may have changed</AlertTitle>
        <AlertDescription>
          <p>
            Do not trust this response. Check a verification page from the last
            successful connection for information:
          </p>
          {#if session.identityUrls.length === 0}
            <p class="text-muted-foreground mt-2 text-sm">None</p>
          {:else}
            <ul class="mt-2 list-disc pl-4">
              {#each session.identityUrls as href (href)}
                <li>
                  <a class="underline" {href} target="_blank" rel="noreferrer"
                    >{href}</a
                  >
                </li>
              {/each}
            </ul>
          {/if}
        </AlertDescription>
      </Alert>
      <Button
        type="button"
        disabled={session.identityLocked || session.connecting}
        onclick={() => void finish(() => session.continue(url))}
      >
        {session.identityLocked ? "Wait…" : "Continue"}
      </Button>
    {/if}
  </DialogContent>
</Dialog>
