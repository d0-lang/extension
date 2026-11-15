<script lang="ts">
  import { onMount } from "svelte"
  import BugIcon from "@lucide/svelte/icons/bug"
  import SettingsIcon from "@lucide/svelte/icons/settings"
  import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert"
  import { Button } from "$lib/components/ui/button"
  import { Label } from "$lib/components/ui/label"
  import { Switch } from "$lib/components/ui/switch"
  import { getLookupEnabled, getServerIssues, setLookupEnabled } from "$lib/storage"
  import ReportMenu from "./report/ReportMenu.svelte"

  let lookupEnabled = $state(false)
  let issueCount = $state(0)
  let reporting = $state(false)

  onMount(async () => {
    const [enabled, issues] = await Promise.all([getLookupEnabled(), getServerIssues()])
    lookupEnabled = enabled
    issueCount = Object.keys(issues).length
  })

  const onToggle = async (checked: boolean) => {
    lookupEnabled = checked
    await setLookupEnabled(checked)
  }

  const openSetup = () => {
    void browser.tabs.create({ url: browser.runtime.getURL("/setup.html") })
    window.close()
  }
</script>

<main class="flex w-60 flex-col gap-4 p-4">
  <div class="flex items-center justify-between gap-4">
    <Label for="lookup-enabled" class="text-lg">Word lookup</Label>
    <Switch
      id="lookup-enabled"
      checked={lookupEnabled}
      onCheckedChange={(checked) => void onToggle(checked)}
    />
  </div>
  {#if issueCount > 0}
    <button
      type="button"
      class="bg-destructive/10 text-destructive hover:bg-destructive/20 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm"
      onclick={openSetup}
    >
      <ShieldAlertIcon class="size-4 shrink-0" />
      {issueCount === 1 ? "A server needs" : `${issueCount} servers need`} your attention.
    </button>
  {/if}
  <div class="flex flex-col gap-2">
    <div class="flex gap-2">
      <Button variant="outline" size="lg" class="flex-1 text-base" onclick={openSetup}>
        <SettingsIcon />
        Settings
      </Button>
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Report a problem"
        title="Report a problem"
        aria-expanded={reporting}
        aria-controls="report-menu"
        onclick={() => (reporting = !reporting)}
      >
        <BugIcon />
      </Button>
    </div>
    <ReportMenu id="report-menu" shown={reporting} />
  </div>
</main>
