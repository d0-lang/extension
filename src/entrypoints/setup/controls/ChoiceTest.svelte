<script lang="ts">
  import { ToggleGroupItem } from "$lib/components/ui/toggle-group"
  import Choice from "./Choice.svelte"

  let { onPick }: { onPick: (value: string) => void } = $props()
  let value = $state("slow")
</script>

<Choice
  {value}
  onPick={(next) => {
    value = next
    onPick(next)
  }}
>
  <ToggleGroupItem value="slow">Slow</ToggleGroupItem>
  <ToggleGroupItem value="fast">Fast</ToggleGroupItem>
</Choice>
