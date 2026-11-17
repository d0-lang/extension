<script lang="ts">
  import Keycap from "$lib/components/Keycap.svelte"
  import { KbdGroup } from "$lib/components/ui/kbd"

  /** `combo` keys are pressed together. Otherwise each key is one direction, like W for up and S for down. */
  const hotkeys = [
    { keys: ["Alt"], action: "Hold to look up the word under the cursor" },
    { keys: ["Alt", "Wheel"], action: "Scroll the popover wherever the cursor is", combo: true },
    { keys: ["W", "S"], action: "Scroll the popover" },
    { keys: ["A", "D"], action: "Switch the popover language" },
    { keys: ["E"], action: "Play the pronunciation" },
    { keys: ["Esc"], action: "Close the popover" },
  ]
</script>

<section class="flex flex-col gap-4">
  <h2 class="text-lg font-semibold">Hotkeys</h2>
  <dl class="flex flex-col divide-y rounded-lg border">
    {#each hotkeys as hotkey (hotkey.action)}
      <div class="flex items-center justify-between gap-4 px-4 py-2.5">
        <dt class="text-sm">{hotkey.action}</dt>
        <dd>
          <KbdGroup>
            {#each hotkey.keys as key, index (key)}
              {#if index > 0}
                <span class="text-muted-foreground text-xs">{hotkey.combo ? "+" : "/"}</span>
              {/if}
              <Keycap>{key}</Keycap>
            {/each}
          </KbdGroup>
        </dd>
      </div>
    {/each}
  </dl>
</section>
