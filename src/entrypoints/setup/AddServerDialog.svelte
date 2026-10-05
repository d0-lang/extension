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
  import {
    DEFAULT_BASE_URL,
    handshake,
    type DictError,
    type ServerMeta,
  } from "$lib/dict";
  import { normalizeServerUrl } from "$lib/storage";

  let {
    open,
    onsuccess,
    onclose,
  }: {
    open: boolean;
    onsuccess: (result: { url: string; key: string; meta: ServerMeta }) => void;
    onclose: () => void;
  } = $props();

  let url = $state(DEFAULT_BASE_URL);
  let connecting = $state(false);
  let genericError = $state("");
  let identityUrls = $state.raw<Array<string> | null>(null);
  let brokenUrls = $state.raw<Array<string> | null>(null);
  let pendingKey = $state<string | undefined>(undefined);
  let identityLocked = $state(false);
  let identityLockTimer: ReturnType<typeof setTimeout> | undefined;

  const clearIdentityLock = () => {
    if (identityLockTimer !== undefined) {
      clearTimeout(identityLockTimer);
      identityLockTimer = undefined;
    }
    identityLocked = false;
  };

  const startIdentityLock = () => {
    clearIdentityLock();
    identityLocked = true;
    identityLockTimer = setTimeout(() => {
      identityLocked = false;
      identityLockTimer = undefined;
    }, 5000);
  };

  const failHandshake = (cause: DictError) => {
    if (!connecting) {
      return;
    }
    connecting = false;
    if (cause.kind === "identity") {
      identityUrls = cause.verificationUrls;
      pendingKey = cause.newKey;
      brokenUrls = null;
      startIdentityLock();
      return;
    }
    if (cause.kind === "broken") {
      brokenUrls = cause.verificationUrls;
      identityUrls = null;
      pendingKey = undefined;
      clearIdentityLock();
      return;
    }
    identityUrls = null;
    pendingKey = undefined;
    clearIdentityLock();
    brokenUrls = null;
    genericError =
      cause.kind === "failed" ? "Handshake failed." : cause.message;
  };

  const runConnect = async (newKey?: string) => {
    connecting = true;
    genericError = "";
    identityUrls = null;
    brokenUrls = null;
    await handshake(url, newKey).match(
      ({ key, meta }) => {
        if (!connecting) {
          return;
        }
        onsuccess({ url: normalizeServerUrl(url), key, meta });
        connecting = false;
      },
      failHandshake,
    );
  };
</script>

<Dialog
  {open}
  onOpenChange={(next) => {
    if (!next) {
      connecting = false;
      clearIdentityLock();
      onclose();
    }
  }}
>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Add server</DialogTitle>
      <DialogDescription
        >Paste a dictionary server URL and connect.</DialogDescription
      >
    </DialogHeader>
    <form
      class="flex flex-col gap-3"
      onsubmit={(event) => {
        event.preventDefault();
        void runConnect();
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
      <Button type="submit" disabled={connecting}>
        {connecting ? "Connecting…" : "Connect"}
      </Button>
    </form>

    {#if genericError}
      <Alert variant="destructive">
        <AlertTitle>Handshake failed</AlertTitle>
        <AlertDescription>{genericError}</AlertDescription>
      </Alert>
    {/if}

    {#if brokenUrls !== null}
      <Alert variant="destructive">
        <AlertTitle>Do not trust this response</AlertTitle>
        <AlertDescription>
          <p>
            The public key matches, but the metadata signature did not verify.
            This response is broken or has been tampered with, indicating a
            security risk.
          </p>
          {#if brokenUrls.length > 0}
            <p class="mt-2">
              Check a verification page from the last successful bind:
            </p>
            <ul class="mt-2 list-disc pl-4">
              {#each brokenUrls as href (href)}
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

    {#if identityUrls !== null}
      <Alert variant="destructive">
        <AlertTitle>Server identity may have changed</AlertTitle>
        <AlertDescription>
          <p>
            Do not trust this response. Check a verification page from the last
            successful bind:
          </p>
          {#if identityUrls.length === 0}
            <p class="text-muted-foreground mt-2 text-sm">None</p>
          {:else}
            <ul class="mt-2 list-disc pl-4">
              {#each identityUrls as href (href)}
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
        disabled={identityLocked || connecting}
        onclick={() => void runConnect(pendingKey)}
      >
        {identityLocked ? "Wait…" : "Continue"}
      </Button>
    {/if}
  </DialogContent>
</Dialog>
