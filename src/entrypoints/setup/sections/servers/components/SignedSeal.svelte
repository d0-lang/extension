<script lang="ts">
  // What the handshake checked, for a server being added. The shield draws itself once, then gives one pulse.
</script>

<div class="bg-link/10 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm">
  <span class="seal relative inline-flex size-7 shrink-0">
    <span class="pulse" aria-hidden="true"></span>
    <svg viewBox="0 0 24 24" class="size-7" aria-hidden="true">
      <path
        class="shade"
        d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
      />
      <!-- From the top, so both sides close at the bottom together. -->
      <path
        class="edge"
        pathLength="1"
        d="M12 2c-.27 0-.54.09-.76.28C9.5 3.8 7 5 5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01C16.5 20.5 20 18 20 13V6a1 1 0 0 0-1-1c-2 0-4.49-1.19-6.24-2.72A1.17 1.17 0 0 0 12 2z"
      />
      <path class="check" pathLength="1" d="m9 12 2 2 4-4" />
    </svg>
  </span>
  <p class="text">
    <span class="font-medium">Signed by this server.</span>
    <span class="text-muted-foreground"
      >Once added, its key is kept, and you are asked if it ever changes.</span
    >
  </p>
</div>

<style>
  .seal {
    color: var(--link);
  }

  .edge,
  .check {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
  }

  .edge {
    animation: draw 0.7s cubic-bezier(0.5, 0, 0.3, 1) both;
  }

  .shade {
    fill: currentColor;
    animation: shade 0.9s ease-out both;
  }

  /* Hidden until it starts to draw: a round cap on a dash of no length still paints a dot. */
  .check {
    animation: draw-tick 0.9s both;
  }

  .pulse {
    position: absolute;
    inset: -2px;
    border: 2px solid currentColor;
    border-radius: 9999px;
    opacity: 0;
    animation: pulse 0.6s 0.85s ease-out;
  }

  .text {
    animation: rise 0.35s 0.55s ease-out both;
  }

  @keyframes draw {
    from {
      stroke-dashoffset: 1;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes shade {
    0%,
    60% {
      opacity: 0;
    }
    80% {
      opacity: 0.22;
    }
    100% {
      opacity: 0.14;
    }
  }

  @keyframes draw-tick {
    0%,
    62% {
      stroke-dashoffset: 1;
      opacity: 0;
      animation-timing-function: ease-out;
    }
    63% {
      opacity: 1;
    }
    90%,
    100% {
      stroke-dashoffset: 0;
      opacity: 1;
    }
  }

  @keyframes pulse {
    from {
      opacity: 0.6;
      transform: scale(0.8);
    }
    to {
      opacity: 0;
      transform: scale(1.6);
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .edge,
    .shade,
    .check,
    .text {
      animation-duration: 1ms;
      animation-delay: 0ms;
    }

    .pulse {
      animation: none;
    }
  }
</style>
