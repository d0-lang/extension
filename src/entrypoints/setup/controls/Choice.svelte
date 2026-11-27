<script lang="ts">
  import type { ComponentProps } from "svelte"
  import { ToggleGroup } from "$lib/components/ui/toggle-group"

  /** One of several, as a toggle group. Pressing the item already picked keeps it, where the plain group leaves none. */
  let {
    value,
    onPick,
    children,
    ...rest
  }: Omit<ComponentProps<typeof ToggleGroup>, "type" | "value" | "onValueChange"> & {
    value: string
    onPick: (value: string) => void
  } = $props()
</script>

<ToggleGroup
  type="single"
  bind:value={
    () => value,
    (next) => {
      if (next !== "") {
        onPick(next)
      }
    }
  }
  {...rest}
>
  {@render children?.()}
</ToggleGroup>
