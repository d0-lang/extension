<script lang="ts">
  import { onMount } from "svelte"
  import MonitorIcon from "@lucide/svelte/icons/monitor"
  import MoonIcon from "@lucide/svelte/icons/moon"
  import SunIcon from "@lucide/svelte/icons/sun"
  import { ToggleGroup, ToggleGroupItem } from "$lib/components/ui/toggle-group"
  import { Label } from "$lib/components/ui/label"
  import { Switch } from "$lib/components/ui/switch"
  import { getShowIpa, getTheme, setShowIpa, setTheme, type Theme } from "$lib/storage"

  const themes = [
    { value: "system", label: "System", icon: MonitorIcon },
    { value: "light", label: "Light", icon: SunIcon },
    { value: "dark", label: "Dark", icon: MoonIcon },
  ] satisfies Array<{ value: Theme; label: string; icon: typeof SunIcon }>

  let theme = $state<Theme>("system")
  let showIpa = $state(true)

  onMount(async () => {
    const [storedTheme, storedIpa] = await Promise.all([getTheme(), getShowIpa()])
    theme = storedTheme
    showIpa = storedIpa
  })

  const onTheme = async (next: string) => {
    // Pressing the active item deselects it, which leaves no theme.
    const picked = themes.find((option) => option.value === next)
    if (picked === undefined) {
      return
    }
    theme = picked.value
    await setTheme(picked.value)
  }

  const onIpa = async (checked: boolean) => {
    showIpa = checked
    await setShowIpa(checked)
  }
</script>

<section class="flex flex-col gap-4">
  <h2 class="text-lg font-semibold">Appearance</h2>
  <div class="flex flex-col divide-y rounded-lg border">
    <div class="flex flex-wrap items-center justify-between gap-4 p-4">
      <div class="flex flex-col gap-0.5">
        <p class="text-sm font-medium">Theme</p>
        <p class="text-muted-foreground text-sm">Applies to settings and the lookup popover.</p>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={theme}
        onValueChange={(next) => void onTheme(next)}
      >
        {#each themes as option (option.value)}
          <ToggleGroupItem value={option.value}>
            <option.icon />
            {option.label}
          </ToggleGroupItem>
        {/each}
      </ToggleGroup>
    </div>
    <div class="flex items-center justify-between gap-4 p-4">
      <div class="flex flex-col gap-0.5">
        <Label for="show-ipa">Show IPA</Label>
        <p class="text-muted-foreground text-sm">
          The phonetic spelling under each word, like <span class="text-foreground">/ˈhɛləʊ/</span> for hello.
        </p>
      </div>
      <Switch id="show-ipa" checked={showIpa} onCheckedChange={(checked) => void onIpa(checked)} />
    </div>
  </div>
</section>
