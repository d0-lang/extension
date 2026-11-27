<script lang="ts">
  import type { ComponentProps } from "svelte"
  import { Kbd } from "$lib/components/ui/kbd"
  import { cn } from "$lib/utils"

  /**
   * A key, outlined like a keycap so it doesn't read as a button or a tag.
   * One with a `title` takes the pointer, so the title shows, and sinks under it like a pressed key.
   */
  let { class: className, children, ...rest }: ComponentProps<typeof Kbd> = $props()
</script>

<Kbd
  class={cn(
    "border-foreground/20 border border-b-2 bg-transparent",
    rest.title !== undefined &&
      "pointer-events-auto cursor-help transition-[translate,border-bottom-width] duration-100 hover:translate-y-px hover:border-b",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</Kbd>
