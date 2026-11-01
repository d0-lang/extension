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
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "$lib/components/ui/dialog";
  import { ServerSetup } from "../ServerSetup.svelte";

  let { setup }: { setup: ServerSetup } = $props();

  const target = $derived(setup.removeTarget);
</script>

{#if target}
  <Dialog
    open
    onOpenChange={(next) => {
      if (!next) {
        setup.cancelRemove();
      }
    }}
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Remove {target.name}?</DialogTitle>
        <DialogDescription>{target.url}</DialogDescription>
      </DialogHeader>
      <p class="text-sm">
        {#if target.languages.length > 0}
          Lookups for {target.languages.join(", ")} will stop working.
        {/if}
        The stored key is deleted too, so adding this server again trusts whatever
        key it sends then.
      </p>
      {#if setup.removeError}
        <Alert variant="destructive">
          <AlertTitle>Could not remove</AlertTitle>
          <AlertDescription>{setup.removeError}</AlertDescription>
        </Alert>
      {/if}
      <DialogFooter>
        <Button
          variant="outline"
          disabled={setup.removing}
          onclick={setup.cancelRemove}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={setup.removing}
          onclick={() => void setup.confirmRemove()}
        >
          {setup.removing ? "Removing…" : "Remove"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}
