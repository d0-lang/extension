<script lang="ts">
  import { onMount, untrack } from "svelte"
  import { prefersReducedMotion } from "svelte/motion"
  import Keycap from "$lib/components/Keycap.svelte"

  /** Played once, when this page sent the last kept word. `from` is the Send button's card, which flies in first. */
  let { count, from }: { count: number; from?: DOMRect } = $props()

  const FLIGHT_MS = 500
  let art = $state<SVGSVGElement>()
  /** Read once, as the finale plays one way from the start. */
  const start = untrack(() => from)
  const flies = start !== undefined && !prefersReducedMotion.current

  onMount(() => {
    const card = art?.querySelector(".last")
    if (!flies || art === undefined || card === null || card === undefined) {
      return
    }
    const to = card.getBoundingClientRect()
    // The button shows one card, 9 of its 24 units wide. The finale's card is in the middle of its own drawing.
    const scale = (start.width * 9) / 24 / to.width
    const x = start.left + start.width / 2 - (to.left + to.width / 2)
    const y = start.top + start.height / 2 - (to.top + to.height / 2)
    art.animate([{ transform: `translate(${x}px, ${y}px) scale(${scale})` }, { transform: "none" }], {
      duration: FLIGHT_MS,
      easing: "cubic-bezier(0.3, 0, 0.2, 1)",
    })
  })

  const SPARKS = [20, 80, 145, 205, 265, 325]
</script>

<div
  class="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center"
  style:--wait="{flies ? FLIGHT_MS : 0}ms"
>
  <svg bind:this={art} viewBox="0 0 24 24" class="all-sent mb-2 size-24" aria-hidden="true">
    {#each SPARKS as angle, index (angle)}
      <circle class="spark" cx="12" cy="12" r={index % 2 === 0 ? 0.8 : 0.6} style:--angle="{angle}deg" />
    {/each}
    <circle class="ring" cx="12" cy="12" r="7" pathLength="1" transform="rotate(-90 12 12)" />
    <path class="tick" d="M8.8 12.2l2.2 2.3 4.3-4.6" pathLength="1" />
    <rect class="last" x="7.5" y="5" width="9" height="14" rx="2" />
  </svg>
  <h1 class="rise text-xl font-semibold">All sent</h1>
  <p class="rise later text-muted-foreground text-sm">
    {count === 1 ? "The card went" : `${count} cards went`} to Anki. Press <Keycap>Q</Keycap> in the popover to
    keep more.
  </p>
</div>

<style>
  .all-sent {
    overflow: visible;
    color: var(--foreground);
  }

  .all-sent * {
    transform-box: view-box;
  }

  /* The last card crouches and shoots up, as on the Send button, then a ring and a tick draw where it was. */
  .last {
    fill: var(--background);
    stroke: currentColor;
    stroke-width: 1.2;
    transform-origin: 12px 19px;
    animation: toss 1.8s var(--wait) forwards;
  }

  /* Hidden until each starts to draw: a round cap on a dash of no length still paints a dot. */
  .ring,
  .tick {
    fill: none;
    stroke: var(--link);
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    opacity: 0;
  }

  .ring {
    animation: draw-ring 1.8s var(--wait) forwards;
  }

  .tick {
    animation: draw-tick 1.8s var(--wait) forwards;
  }

  .spark {
    fill: var(--link);
    opacity: 0;
    transform-origin: 12px 12px;
    animation: spark 1.8s var(--wait) forwards;
  }

  /* The finale waits for the card to land, when it flies in. */
  .rise {
    animation: rise 1.8s var(--wait) both;
  }

  .rise.later {
    animation-name: rise-later;
  }

  @keyframes toss {
    0% {
      transform: none;
      opacity: 1;
      animation-timing-function: ease-out;
    }
    9% {
      transform: translateY(0.6px) scale(1.08, 0.88);
      animation-timing-function: cubic-bezier(0.3, 0, 0.6, 1);
    }
    16% {
      transform: translateY(-2px) scale(0.94, 1.1);
      animation-timing-function: cubic-bezier(0.2, 0.6, 0.5, 1);
    }
    32%,
    100% {
      transform: translateY(-20px) rotate(-6deg);
      opacity: 0;
    }
  }

  @keyframes draw-ring {
    0%,
    30% {
      stroke-dashoffset: 1;
      opacity: 0;
      animation-timing-function: cubic-bezier(0.5, 0, 0.3, 1);
    }
    31% {
      opacity: 1;
    }
    54%,
    100% {
      stroke-dashoffset: 0;
      opacity: 1;
    }
  }

  @keyframes draw-tick {
    0%,
    46% {
      stroke-dashoffset: 1;
      opacity: 0;
      animation-timing-function: cubic-bezier(0.5, 0, 0.3, 1);
    }
    47% {
      opacity: 1;
    }
    62%,
    100% {
      stroke-dashoffset: 0;
      opacity: 1;
    }
  }

  @keyframes spark {
    0%,
    52% {
      opacity: 0;
      transform: none;
    }
    58% {
      opacity: 1;
    }
    80%,
    100% {
      opacity: 0;
      transform: rotate(var(--angle)) translateY(-11px) scale(0.4);
    }
  }

  @keyframes rise {
    0%,
    60% {
      opacity: 0;
      transform: translateY(4px);
    }
    76%,
    100% {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes rise-later {
    0%,
    68% {
      opacity: 0;
      transform: translateY(4px);
    }
    84%,
    100% {
      opacity: 1;
      transform: none;
    }
  }

  /* Straight to the end: the ring and tick drawn, the text in place. */
  @media (prefers-reduced-motion: reduce) {
    .all-sent *,
    .rise {
      animation-duration: 1ms;
    }
  }
</style>
