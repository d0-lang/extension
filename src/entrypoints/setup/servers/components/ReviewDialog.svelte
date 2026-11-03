<script lang="ts">
  import {
    Alert,
    AlertDescription,
    AlertTitle,
  } from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "$lib/components/ui/dialog";
  import { Label } from "$lib/components/ui/label";
  import { pairName } from "$lib/languages";
  import { ServerSetup } from "../ServerSetup.svelte";

  let { setup }: { setup: ServerSetup } = $props();

  const draft = $derived(setup.draft);
</script>

{#if draft}
  <Dialog
    open={setup.reviewOpen}
    onOpenChange={(next) => {
      if (!next) {
        setup.closeReview();
      }
    }}
  >
    <DialogContent class="max-h-[90svh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Server</DialogTitle>
        <DialogDescription>
          At {draft.url}
        </DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-3">
        {#if draft.movedFrom !== undefined}
          <Alert>
            <AlertTitle>Server seemingly moved</AlertTitle>
            <AlertDescription>
              From {draft.movedFrom} to {draft.url}.
            </AlertDescription>
          </Alert>
        {/if}
        {#if setup.droppedLanguages.length > 0}
          <Alert>
            <AlertTitle>Languages no longer offered</AlertTitle>
            <AlertDescription>
              Saving removes {setup.droppedLanguages.map(pairName).join(", ")}.
            </AlertDescription>
          </Alert>
        {/if}
        <div>
          <p class="text-sm font-medium">Name</p>
          <p>{draft.meta.name}</p>
        </div>
        <div>
          <p class="text-sm font-medium">Languages</p>
          {#if draft.meta.languages.length === 0}
            <p class="text-muted-foreground text-sm">None advertised</p>
          {:else}
            <ul class="mt-2 flex flex-col gap-2">
              {#each draft.meta.languages as lang (lang)}
                <li class="flex items-center gap-2">
                  <Checkbox
                    id={`lang-${lang}`}
                    bind:checked={setup.selected[lang]}
                  />
                  <Label for={`lang-${lang}`}>
                    {pairName(lang)} ({lang in setup.serverByLang
                      ? "in use"
                      : "not in use"})
                  </Label>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
        <div>
          <p class="text-sm font-medium">URLs</p>
          {#if draft.meta.verification_urls.length === 0}
            <p class="text-muted-foreground text-sm">None</p>
          {:else}
            <ul class="mt-1 list-disc pl-4">
              {#each draft.meta.verification_urls as href (href)}
                <li>
                  <a class="underline" {href} target="_blank" rel="noreferrer"
                    >{href}</a
                  >
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
      {#if setup.genericError}
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{setup.genericError}</AlertDescription>
        </Alert>
      {/if}
      <DialogFooter>
        <Button
          onclick={() => void setup.save()}
          disabled={setup.saving || !setup.canSave}
        >
          {setup.saving ? "Saving…" : "OK"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}
