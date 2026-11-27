<script lang="ts">
  import { onMount } from "svelte"
  import { MediaQuery } from "svelte/reactivity"
  import ArrowDownToLineIcon from "@lucide/svelte/icons/arrow-down-to-line"
  import ArrowUpToLineIcon from "@lucide/svelte/icons/arrow-up-to-line"
  import { Label } from "$lib/components/ui/label"
  import { Switch } from "$lib/components/ui/switch"
  import { ToggleGroupItem } from "$lib/components/ui/toggle-group"
  import {
    DEFAULT_SUBTITLE_SETTINGS,
    getSubtitleSettings,
    setSubtitleStyles,
    setSubtitlePosition,
    setSubtitlePrevious,
    setSubtitleCalm,
    setSubtitleSlide,
    type SubtitlePosition,
    type SubtitleSettings,
  } from "$lib/storage"
  import Choice from "../../controls/Choice.svelte"
  import SectionTitle from "../../layout/SectionTitle.svelte"
  import SubtitlePreview from "./SubtitlePreview.svelte"

  const positions = [
    { value: "bottom", label: "Bottom", icon: ArrowDownToLineIcon },
    { value: "top", label: "Top", icon: ArrowUpToLineIcon },
  ] satisfies Array<{ value: SubtitlePosition; label: string; icon: typeof ArrowDownToLineIcon }>

  let settings = $state<SubtitleSettings>(DEFAULT_SUBTITLE_SETTINGS)
  /** The slide stays out while this matches, whatever its switch says. */
  const reducedMotion = new MediaQuery("prefers-reduced-motion: reduce")
  /** Set once the settings are read, so the defaults do not show first and then change. */
  let loaded = $state(false)

  onMount(async () => {
    settings = await getSubtitleSettings()
    loaded = true
  })

  const onPrevious = async (checked: boolean) => {
    settings = { ...settings, previous: checked }
    await setSubtitlePrevious(checked)
  }

  const onStyles = async (checked: boolean) => {
    settings = { ...settings, styles: checked }
    await setSubtitleStyles(checked)
  }

  const onCalm = async (checked: boolean) => {
    settings = { ...settings, calm: checked }
    await setSubtitleCalm(checked)
  }

  const onSlide = async (checked: boolean) => {
    settings = { ...settings, slide: checked }
    await setSubtitleSlide(checked)
  }

  const onPosition = async (next: string) => {
    const picked = positions.find((option) => option.value === next)
    if (picked === undefined) {
      return
    }
    settings = { ...settings, position: picked.value }
    await setSubtitlePosition(picked.value)
  }
</script>

<section class="flex flex-col gap-5">
  <SectionTitle title="Subtitles" />
  <!-- The preview's column is as wide as the popover preview's, so the settings get the rest. -->
  <div class="grid items-start gap-5 @min-[48rem]:grid-cols-[minmax(0,1fr)_minmax(0,21.25rem)]">
    <div class={["flex flex-col divide-y rounded-lg border", !loaded && "invisible"]}>
      <div class="flex items-center justify-between gap-4 p-4">
        <div class="flex flex-col gap-0.5">
          <Label for="subtitle-previous">Line before</Label>
          <p class="text-muted-foreground text-sm">
            The last row of a subtitle that ended stays above the next one, so its words can still be looked
            up.
          </p>
        </div>
        <Switch
          id="subtitle-previous"
          checked={settings.previous}
          onCheckedChange={(checked) => void onPrevious(checked)}
        />
      </div>
      <div class="flex items-center justify-between gap-4 p-4">
        <div class="flex flex-col gap-0.5">
          <Label for="subtitle-slide">Slide up</Label>
          <p class="text-muted-foreground text-sm">
            {reducedMotion.current
              ? "Off while your system asks for less motion."
              : "The line before slides into place when the next subtitle starts."}
          </p>
        </div>
        <Switch
          id="subtitle-slide"
          checked={settings.slide && !reducedMotion.current}
          disabled={!settings.previous || reducedMotion.current}
          onCheckedChange={(checked) => void onSlide(checked)}
        />
      </div>
      <div class="flex items-center justify-between gap-4 p-4">
        <div class="flex flex-col gap-0.5">
          <Label for="subtitle-calm">Calm fast subtitles</Label>
          <p class="text-muted-foreground text-sm">
            Turns the slide off on videos where lines change rapidly.
          </p>
        </div>
        <Switch
          id="subtitle-calm"
          checked={settings.calm}
          disabled={!settings.previous || !settings.slide || reducedMotion.current}
          onCheckedChange={(checked) => void onCalm(checked)}
        />
      </div>
      <div class="flex items-center justify-between gap-4 p-4">
        <div class="flex flex-col gap-0.5">
          <Label for="subtitle-styles">Subtitle styles</Label>
          <p class="text-muted-foreground text-sm">
            Shows colors, italics, bold and places when the subtitles have them, like a color for each
            speaker.
          </p>
        </div>
        <Switch
          id="subtitle-styles"
          checked={settings.styles}
          onCheckedChange={(checked) => void onStyles(checked)}
        />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-4 p-4">
        <div class="flex flex-col gap-0.5">
          <p class="text-sm font-medium">Position</p>
          <p class="text-muted-foreground text-sm">
            Where subtitles start in the player. Dragging them moves them for one video.
          </p>
        </div>
        <Choice
          variant="outline"
          size="sm"
          value={settings.position}
          onPick={(next) => void onPosition(next)}
        >
          {#each positions as option (option.value)}
            <ToggleGroupItem value={option.value}>
              <option.icon />
              {option.label}
            </ToggleGroupItem>
          {/each}
        </Choice>
      </div>
    </div>
    <SubtitlePreview class={[!loaded && "invisible"]} {settings} />
  </div>
</section>
