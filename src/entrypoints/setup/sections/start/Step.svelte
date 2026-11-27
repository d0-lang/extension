<script lang="ts">
  import type { Snippet } from "svelte"

  /** One step of Get started. Its body shows only while it is the `current` one; a `done` one gets a tick. */
  let {
    title,
    done,
    current,
    children,
  }: { title: string; done: boolean; current: boolean; children: Snippet } = $props()
</script>

<li class={["flex gap-3 rounded-lg p-3 transition-colors", current && "bg-muted/60"]}>
  <svg viewBox="0 0 22 22" class={["check size-5.5 shrink-0", done && "done"]} aria-hidden="true">
    <circle cx="11" cy="11" r="9.5" />
    <path d="M6.8 11.3l2.8 2.8 5.6-5.8" pathLength="1" />
  </svg>
  <div class="flex min-w-0 flex-1 flex-col gap-2">
    <p class={["text-sm font-medium", done && !current && "text-muted-foreground"]}>
      {title}<span class="sr-only">{done ? ", done" : ""}</span>
    </p>
    {#if current}
      {@render children()}
    {/if}
  </div>
</li>

<style>
  .check {
    overflow: visible;
  }

  circle {
    fill: none;
    stroke: color-mix(in oklch, var(--muted-foreground) 60%, transparent);
    stroke-width: 1.6;
    transform-origin: 11px 11px;
  }

  /* Hidden until ticked: a round cap on a dash of no length still paints a dot. */
  path {
    fill: none;
    stroke: var(--primary-foreground);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    opacity: 0;
  }

  .done circle {
    fill: var(--primary);
    stroke: var(--primary);
    animation: pop 0.45s cubic-bezier(0.3, 1.6, 0.5, 1);
  }

  .done path {
    opacity: 1;
    animation: draw 0.35s 0.12s ease-out forwards;
  }

  @keyframes pop {
    0% {
      transform: scale(0.6);
    }
    60% {
      transform: scale(1.15);
    }
    100% {
      transform: none;
    }
  }

  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .done circle {
      animation: none;
    }

    .done path {
      animation-duration: 1ms;
      animation-delay: 0ms;
    }
  }
</style>
