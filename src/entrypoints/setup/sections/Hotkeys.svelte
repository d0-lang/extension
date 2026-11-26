<script lang="ts">
  import Keycap from "$lib/components/Keycap.svelte"
  import { KbdGroup } from "$lib/components/ui/kbd"
  import SectionTitle from "../layout/SectionTitle.svelte"

  /**
   * Each of `keys` is one direction, like W for up and S for down.
   * `hold` keys are held down, and `text` is said in words instead of keys.
   * `modifier` is held with any of `keys`, and `after` is said after them, like "twice".
   */
  type Hotkey = {
    action: string
    keys?: Array<string>
    hold?: boolean
    text?: string
    modifier?: string
    after?: string
  }

  const groups: Array<{ name: string; hotkeys: Array<Hotkey> }> = [
    {
      name: "Look up",
      hotkeys: [
        { action: "Look up the word under the cursor", keys: ["Alt"], hold: true },
        { action: "Look up a selected word or phrase", text: "Right-click, Look up" },
      ],
    },
    {
      name: "In subtitles",
      hotkeys: [
        { action: "Look up a word", text: "Click" },
        { action: "Copy a word, its line, or a prompt to explain it", text: "Right-click" },
        { action: "Move the subtitles", text: "Drag" },
      ],
    },
    {
      name: "In the popover",
      hotkeys: [
        { action: "Scroll the popover", keys: ["W", "S"] },
        { action: "Move between the parts of a word", keys: ["A", "D"] },
        { action: "Play the pronunciation", keys: ["E"] },
        { action: "Keep the word for Anki, when Anki is on", keys: ["Q"] },
        { action: "Close the popover", keys: ["Esc"] },
      ],
    },
    {
      name: "On the kept words page",
      hotkeys: [
        { action: "Up and down, from the sentence to the buttons", keys: ["W", "S"] },
        { action: "Another entry of the word, like its noun or verb", keys: ["A", "D"] },
        { action: "Pick a meaning, or press the button", keys: ["Space"] },
        { action: "Edit the sentence or a meaning, Enter to keep it", keys: ["E"] },
        { action: "Previous or next word", modifier: "Shift", keys: ["W", "S"] },
        { action: "Send to Anki", modifier: "Ctrl", keys: ["Enter"] },
        { action: "Drop the word", keys: ["X"], after: "twice" },
      ],
    },
  ]
</script>

<section class="flex max-w-2xl flex-col gap-5">
  <SectionTitle title="Hotkeys" />
  {#each groups as group (group.name)}
    <div class="flex flex-col gap-2">
      <h2 class="text-muted-foreground text-sm font-medium">{group.name}</h2>
      <dl class="flex flex-col divide-y rounded-lg border">
        {#each group.hotkeys as hotkey (hotkey.action)}
          <div class="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt class="text-sm">{hotkey.action}</dt>
            <dd class="text-muted-foreground shrink-0 text-sm">
              {#if hotkey.text !== undefined}
                {hotkey.text}
              {:else}
                {#if hotkey.hold}<span class="mr-1">Hold</span>{/if}
                <KbdGroup>
                  {#if hotkey.modifier !== undefined}
                    <Keycap>{hotkey.modifier}</Keycap>
                    <span class="text-xs">+</span>
                  {/if}
                  {#each hotkey.keys ?? [] as key, index (key)}
                    {#if index > 0}
                      <span class="text-xs">/</span>
                    {/if}
                    <Keycap>{key}</Keycap>
                  {/each}
                </KbdGroup>
                {#if hotkey.after !== undefined}<span class="ml-1">{hotkey.after}</span>{/if}
              {/if}
            </dd>
          </div>
        {/each}
      </dl>
    </div>
  {/each}
</section>
