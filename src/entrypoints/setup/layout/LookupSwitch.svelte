<script lang="ts">
  import { onMount } from "svelte"
  import { Label } from "$lib/components/ui/label"
  import { Switch } from "$lib/components/ui/switch"
  import { getLookupEnabled, setLookupEnabled } from "$lib/storage"

  let enabled = $state(true)

  onMount(() => {
    const load = async () => {
      enabled = await getLookupEnabled()
    }
    void load()
    // The popup has the same switch.
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && "lookupEnabled" in changes) {
        void load()
      }
    }
    browser.storage.onChanged.addListener(onChanged)
    return () => browser.storage.onChanged.removeListener(onChanged)
  })

  const onToggle = async (checked: boolean) => {
    enabled = checked
    await setLookupEnabled(checked)
  }
</script>

<div class="flex items-center gap-2.5">
  <Label for="lookup-enabled">Word lookup</Label>
  <Switch id="lookup-enabled" checked={enabled} onCheckedChange={(checked) => void onToggle(checked)} />
</div>
