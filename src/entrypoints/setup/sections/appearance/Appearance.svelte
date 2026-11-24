<script lang="ts">
  import { onMount } from "svelte"
  import HighlighterIcon from "@lucide/svelte/icons/highlighter"
  import MonitorIcon from "@lucide/svelte/icons/monitor"
  import MoonIcon from "@lucide/svelte/icons/moon"
  import SunIcon from "@lucide/svelte/icons/sun"
  import UnderlineIcon from "@lucide/svelte/icons/underline"
  import EyeIcon from "@lucide/svelte/icons/eye"
  import { Button } from "$lib/components/ui/button"
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from "$lib/components/ui/dialog"
  import { ToggleGroup, ToggleGroupItem } from "$lib/components/ui/toggle-group"
  import { Label } from "$lib/components/ui/label"
  import { Switch } from "$lib/components/ui/switch"
  import {
    getMarkStyle,
    getShowIpa,
    getTheme,
    setMarkStyle,
    setShowIpa,
    setTheme,
    type MarkStyle,
    type Theme,
  } from "$lib/storage"
  import SectionTitle from "../../layout/SectionTitle.svelte"
  import LanguageOrder from "./LanguageOrder.svelte"
  import PopoverPreview from "./PopoverPreview.svelte"
  import { canUnderline } from "./underline"

  const themes = [
    { value: "system", label: "System", icon: MonitorIcon },
    { value: "light", label: "Light", icon: SunIcon },
    { value: "dark", label: "Dark", icon: MoonIcon },
  ] satisfies Array<{ value: Theme; label: string; icon: typeof SunIcon }>

  const markStyles = [
    { value: "tint", label: "Tint", icon: HighlighterIcon },
    { value: "underline", label: "Underline", icon: UnderlineIcon },
  ] satisfies Array<{ value: MarkStyle; label: string; icon: typeof SunIcon }>

  let theme = $state<Theme>("system")
  /** The preview in a dialog, on screens without room for it beside the settings. */
  let previewOpen = $state(false)
  let showIpa = $state(true)
  let markStyle = $state<MarkStyle>("tint")
  /** Without the underline, tint is the only style left, so the choice is not shown. */
  let underlines = $state(false)
  /** Set once the settings are read, so the defaults do not show first and then change. */
  let loaded = $state(false)
  /** Set once the language order is read, so the list does not appear after the rest. */
  let orderLoaded = $state(false)

  onMount(async () => {
    const [storedTheme, storedIpa, storedMark, drawsUnderline] = await Promise.all([
      getTheme(),
      getShowIpa(),
      getMarkStyle(),
      canUnderline(),
    ])
    theme = storedTheme
    showIpa = storedIpa
    markStyle = storedMark
    underlines = drawsUnderline
    loaded = true
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

  const onMarkStyle = async (next: string) => {
    // Pressing the active item deselects it, which leaves no style.
    const picked = markStyles.find((option) => option.value === next)
    if (picked === undefined) {
      return
    }
    markStyle = picked.value
    await setMarkStyle(picked.value)
  }

  const onIpa = async (checked: boolean) => {
    showIpa = checked
    await setShowIpa(checked)
  }
</script>

<section class="flex flex-col gap-5">
  <SectionTitle title="Appearance">
    <!-- Where the preview does not fit beside the settings. -->
    <Button variant="outline" size="sm" class="@min-[48rem]:hidden" onclick={() => (previewOpen = true)}>
      <EyeIcon />
      Preview
    </Button>
  </SectionTitle>
  <!-- The preview only fits beside the settings on a wide screen. -->
  <!-- The preview's column is as wide as the preview, so the settings get the rest. -->
  <div class="grid items-start gap-5 @min-[48rem]:grid-cols-[minmax(0,1fr)_minmax(0,21.25rem)]">
    <div class={["flex flex-col divide-y rounded-lg border", !(loaded && orderLoaded) && "invisible"]}>
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
      {#if underlines}
        <div class="flex flex-wrap items-center justify-between gap-4 p-4">
          <div class="flex flex-col gap-0.5">
            <p class="text-sm font-medium">Looked-up word</p>
            <p class="text-muted-foreground text-sm">
              How the word is marked on the page while its popover is open.
            </p>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={markStyle}
            onValueChange={(next) => void onMarkStyle(next)}
          >
            {#each markStyles as option (option.value)}
              <ToggleGroupItem value={option.value}>
                <option.icon />
                {option.label}
              </ToggleGroupItem>
            {/each}
          </ToggleGroup>
        </div>
      {/if}
      <div class="flex items-center justify-between gap-4 p-4">
        <div class="flex flex-col gap-0.5">
          <Label for="show-ipa">Show IPA</Label>
          <p class="text-muted-foreground text-sm">
            The phonetic spelling under each word, like <span class="text-foreground">/ˈhɛləʊ/</span> for hello.
          </p>
        </div>
        <Switch id="show-ipa" checked={showIpa} onCheckedChange={(checked) => void onIpa(checked)} />
      </div>
      <LanguageOrder onload={() => (orderLoaded = true)} />
    </div>
    <!-- Stuck at the height it starts at, so scrolling never moves it: under the header, title and gaps while the
         window scrolls, and under the title and gaps once the section scrolls inside the page's card. -->
    <div class="self-stretch @max-[48rem]:hidden">
      <div class="sticky top-[8.25rem] xl:top-[4.75rem]">
        <PopoverPreview class={["mx-auto", !loaded && "invisible"]} {showIpa} {markStyle} />
      </div>
    </div>
  </div>
</section>

<Dialog bind:open={previewOpen}>
  <DialogContent class="grid-cols-[minmax(0,1fr)] p-4 sm:max-w-sm sm:p-6">
    <DialogHeader>
      <DialogTitle>Popover preview</DialogTitle>
    </DialogHeader>
    <PopoverPreview class="mx-auto" {showIpa} {markStyle} />
  </DialogContent>
</Dialog>
