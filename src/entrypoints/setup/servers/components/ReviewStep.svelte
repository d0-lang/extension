<script lang="ts">
  import {
    Alert,
    AlertDescription,
    AlertTitle,
  } from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import {
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "$lib/components/ui/dialog";
  import { Label } from "$lib/components/ui/label";
  import { pairName } from "$lib/languages";
  import { ServerSetup } from "../ServerSetup.svelte";

  /** Past this many languages, ticking them one by one gets tedious. */
  const SELECT_ALL_FROM = 6;

  let { setup }: { setup: ServerSetup } = $props();

  const draft = $derived(setup.draft);
  const languages = $derived(draft?.meta.languages ?? []);
</script>

{#if draft}
  <DialogHeader>
    <DialogTitle class="pr-6 wrap-anywhere">{draft.meta.name}</DialogTitle>
    <DialogDescription class="font-mono text-xs wrap-anywhere">
      {draft.url}
    </DialogDescription>
  </DialogHeader>

  <div class="-mx-4 flex min-h-0 flex-col gap-3 overflow-y-auto px-4">
    {#if draft.movedFrom !== undefined}
      <Alert>
        <AlertTitle>This server has moved</AlertTitle>
        <AlertDescription>
          From {draft.movedFrom}. Saving updates its address.
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

    {#if languages.length === 0}
      <p class="text-muted-foreground">This server doesn't offer any languages yet.</p>
    {:else}
      <div class="flex items-center justify-between gap-2">
        <p class="font-medium">Languages</p>
        {#if languages.length >= SELECT_ALL_FROM}
          <Button
            variant="link"
            size="xs"
            class="px-0"
            onclick={() => setup.selectAll(!setup.allSelected)}
          >
            {setup.allSelected ? "Clear all" : "Select all"}
          </Button>
        {/if}
      </div>
      <ul class="-mx-2 flex flex-col">
        {#each languages as lang (lang)}
          {@const owner = setup.ownerElsewhere(lang)}
          <li>
            <Label
              for={`lang-${lang}`}
              class="hover:bg-muted/50 cursor-pointer gap-3 rounded-md px-2 py-2 font-normal"
            >
              <Checkbox id={`lang-${lang}`} bind:checked={setup.selected[lang]} />
              <span class="flex min-w-0 flex-1 flex-col gap-1">
                <span title={lang}>{pairName(lang)}</span>
                {#if owner !== undefined}
                  <span
                    class={[
                      "text-xs wrap-anywhere",
                      setup.selected[lang]
                        ? "text-foreground font-medium"
                        : "text-muted-foreground",
                    ]}
                  >
                    {setup.selected[lang] ? `Moves from ${owner}` : `Used by ${owner}`}
                  </span>
                {/if}
              </span>
            </Label>
          </li>
        {/each}
      </ul>
    {/if}

    {#if setup.genericError}
      <Alert variant="destructive">
        <AlertTitle>Could not save</AlertTitle>
        <AlertDescription>{setup.genericError}</AlertDescription>
      </Alert>
    {/if}
  </div>

  <DialogFooter class="sm:items-center">
    {#if !setup.canSave && languages.length > 0}
      <p class="text-muted-foreground text-center sm:mr-auto sm:text-left">
        Pick at least one language.
      </p>
    {/if}
    {#if !setup.isEditing}
      <Button variant="outline" disabled={setup.saving} onclick={setup.backToConnect}>
        Back
      </Button>
    {/if}
    <Button onclick={() => void setup.save()} disabled={setup.saving || !setup.canSave}>
      {#if setup.saving}
        Saving…
      {:else}
        {setup.isNew ? "Add server" : "Save"}
      {/if}
    </Button>
  </DialogFooter>
{/if}
