<script lang="ts">
  import { untrack } from "svelte"
  import Logo from "$lib/components/Logo.svelte"

  /** The logo beside the lookup switch: it dozes while lookup is off, and hops up when it comes back on. */
  let { awake }: { awake: boolean } = $props()

  let hop = $state(false)
  let wasAwake = untrack(() => awake)

  $effect(() => {
    if (awake && !wasAwake) {
      hop = false
      // A frame off, so a second hop restarts.
      requestAnimationFrame(() => (hop = true))
    }
    wasAwake = awake
  })
</script>

<!-- A pixel in, as the buttons' rounded corners make their edge read further in than the logo's square one. -->
<span class="sleepy relative ml-px inline-flex">
  <Logo class={["sleepy-logo h-7 w-6", !awake && "asleep", hop && "hop"]} />
  {#if !awake}
    <span class="zs text-muted-foreground" aria-hidden="true"><span>z</span><span>z</span><span>z</span></span
    >
  {/if}
</span>

<style>
  .sleepy :global(.sleepy-logo) {
    color: var(--foreground);
    transform-origin: 50% 100%;
    transition:
      opacity 0.4s,
      transform 0.5s cubic-bezier(0.3, 1.5, 0.5, 1);
  }

  .sleepy :global(.sleepy-logo.asleep) {
    opacity: 0.4;
    transform: rotate(-12deg) translateY(2px);
  }

  .sleepy :global(.sleepy-logo.hop) {
    animation: hop 0.5s cubic-bezier(0.3, 1.6, 0.5, 1);
  }

  @keyframes hop {
    0% {
      transform: rotate(-12deg);
    }
    50% {
      transform: rotate(6deg) translateY(-4px);
    }
    100% {
      transform: none;
    }
  }

  .zs {
    position: absolute;
    left: 22px;
    top: -2px;
    font-size: 11px;
    font-weight: 700;
    pointer-events: none;
  }

  .zs span {
    position: absolute;
    opacity: 0;
    animation: drift 2.4s ease-in-out infinite;
  }

  .zs span:nth-child(2) {
    animation-delay: 0.8s;
    font-size: 9px;
  }

  .zs span:nth-child(3) {
    animation-delay: 1.6s;
    font-size: 7px;
  }

  @keyframes drift {
    0% {
      opacity: 0;
      transform: translate(0, 6px);
    }
    30% {
      opacity: 0.9;
    }
    100% {
      opacity: 0;
      transform: translate(10px, -10px);
    }
  }

  /* Still faded and tipped over, which says it is off, but without the motion. */
  @media (prefers-reduced-motion: reduce) {
    .sleepy :global(.sleepy-logo) {
      transition: none;
    }

    .sleepy :global(.sleepy-logo.hop) {
      animation: none;
    }

    .zs {
      display: none;
    }
  }
</style>
