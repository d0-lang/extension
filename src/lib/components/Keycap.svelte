<script lang="ts">
  import type { ComponentProps } from "svelte"
  import { Kbd } from "$lib/components/ui/kbd"
  import { cn } from "$lib/utils"

  /** A key, outlined like a keycap so it doesn't read as a button or a tag. */
  let { class: className, children, ...rest }: ComponentProps<typeof Kbd> = $props()
</script>

<Kbd class={cn("border-foreground/20 border border-b-2 bg-transparent", className)} {...rest}>
  {@render children?.()}
</Kbd>
