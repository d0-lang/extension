<script lang="ts">
  import { splitStress, stressedLetter } from "./stress"

  /** `text` with each stress mark drawn over its letter, since many fonts put U+0301 after it. */
  let { text }: { text: string } = $props()
</script>

{#each splitStress(text) as part, partIndex (partIndex)}{#if part.stressed}{@const letter = stressedLetter(
      part.text,
    )}<span class="dict-stress" data-lift={letter.lift}>{letter.text}</span>{:else}{part.text}{/if}{/each}
