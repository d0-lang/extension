<script lang="ts">
  import { onMount, type Snippet } from "svelte"
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis"
  import PencilIcon from "@lucide/svelte/icons/pencil"
  import PlusIcon from "@lucide/svelte/icons/plus"
  import ServerIcon from "@lucide/svelte/icons/server"
  import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert"
  import Trash2Icon from "@lucide/svelte/icons/trash-2"
  import { Button } from "$lib/components/ui/button"
  import Keycap from "$lib/components/Keycap.svelte"
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
  } from "$lib/components/ui/context-menu"
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "$lib/components/ui/dropdown-menu"
  import { pairName } from "$lib/languages"
  import { groupByTarget, sourceName } from "../languages"
  import { PUBLIC_SERVER } from "../public-server"
  import type { ContextSending, ServerIssue } from "$lib/storage"
  import { ServerSetup } from "../ServerSetup.svelte"
  import RemoveDialog from "./RemoveDialog.svelte"
  import SectionTitle from "../../../layout/SectionTitle.svelte"
  import SourceCredits from "./SourceCredits.svelte"
  import ServerDialog from "./ServerDialog.svelte"

  const servers = new ServerSetup()

  const issueText: Record<ServerIssue["kind"], { text: string; action: string }> = {
    identity: {
      text: "Its signing key changed. Lookups to it are paused until you review it.",
      action: "Review",
    },
    broken: {
      text: "Its answer failed the signature check at the last start. Lookups to it are paused.",
      action: "Check again",
    },
    legal: {
      text: "Its privacy policy or terms are new or changed. Lookups to it are paused until you review them.",
      action: "Review",
    },
  }

  const contextText: Record<ContextSending, string> = {
    all: "Gets sentences from all sites",
    unblocked: "Gets sentences, except from blocked sites",
    none: "Gets no sentences",
  }

  /** Languages a card shows before folding the rest away. */
  const FOLDED_LANGUAGES = 8
  /** Folding away fewer than this many would save less than the button takes. */
  const MIN_FOLDED_AWAY = 3

  /** Server URLs whose cards show every language. */
  let unfolded = $state<Record<string, boolean>>({})

  const folds = (languages: ReadonlyArray<string>): boolean =>
    languages.length - FOLDED_LANGUAGES >= MIN_FOLDED_AWAY

  /** The groups a card shows, cut after the first few languages while it is folded. */
  const shownGroups = (languages: ReadonlyArray<string>, folded: boolean) => {
    let left = folded ? FOLDED_LANGUAGES : languages.length
    return groupByTarget(languages)
      .map((group) => {
        const pairs = group.pairs.slice(0, left)
        left -= pairs.length
        return { ...group, pairs }
      })
      .filter((group) => group.pairs.length > 0)
  }

  onMount(() => {
    void servers.load()
    return servers.watch()
  })
</script>

<section class="flex max-w-2xl flex-col gap-5">
  <SectionTitle title="Servers">
    {#if servers.loaded && servers.rows.length > 0}
      <Button size="sm" onclick={servers.openAdd}>
        <PlusIcon />
        Add
      </Button>
    {/if}
  </SectionTitle>
  {#if !servers.loaded}
    <!-- Nothing until storage answers, so the screen for no servers does not flash. -->
  {:else if servers.rows.length === 0}
    <!-- One card across the section: what to do on the left, the steps it takes on the right. -->
    <div class="bg-card grid overflow-hidden rounded-xl border sm:grid-cols-[1.15fr_1fr]">
      <div class="bg-primary/5 flex flex-col items-start gap-5 p-6 sm:p-8">
        <div class="bg-primary/10 text-link flex size-11 items-center justify-center rounded-lg">
          <ServerIcon class="size-5" />
        </div>
        <div class="flex flex-col gap-1.5">
          <h2 class="text-xl font-semibold tracking-tight">Add a dictionary server to start</h2>
          <p class="text-muted-foreground text-sm">
            Words are looked up on servers you choose. Nothing is sent anywhere until you add one.
          </p>
        </div>
        <Button class="mt-auto" onclick={servers.openAdd}>
          <PlusIcon />
          Add server
        </Button>
      </div>
      {#snippet step(number: number, title: string, text: Snippet)}
        <li class="flex gap-3">
          <span
            class="text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums"
            >{number}</span
          >
          <span class="flex flex-col gap-0.5">
            <span class="text-sm font-medium">{title}</span>
            <span class="text-muted-foreground text-sm">{@render text()}</span>
          </span>
        </li>
      {/snippet}
      {#snippet connectText()}Pick {PUBLIC_SERVER.name}, or paste a server's address.{/snippet}
      {#snippet languagesText()}Choose which pairs this server answers.{/snippet}
      {#snippet lookUpText()}Hold <Keycap>Alt</Keycap> over a word, or right-click and choose Look up.{/snippet}
      <ol class="flex flex-col justify-center gap-5 border-t p-6 sm:border-t-0 sm:border-l sm:p-8">
        {@render step(1, "Connect", connectText)}
        {@render step(2, "Pick languages", languagesText)}
        {@render step(3, "Look up", lookUpText)}
      </ol>
    </div>
  {:else}
    <ul class="flex flex-col gap-3">
      {#each servers.rows as row (row.url)}
        <li>
          <ContextMenu>
            <ContextMenuTrigger
              class={[
                "flex flex-col gap-3 rounded-lg border p-4 select-text",
                row.issue !== undefined && "border-destructive/50",
              ]}
            >
              <div class="flex items-start gap-3">
                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p class="text-lg leading-snug font-semibold wrap-anywhere">{row.name}</p>
                  <p class="text-muted-foreground truncate font-mono text-xs">{row.url}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    {#snippet child({ props })}
                      <Button {...props} variant="ghost" size="icon-sm" aria-label="Actions for {row.name}">
                        <EllipsisIcon />
                      </Button>
                    {/snippet}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="min-w-40">
                    <DropdownMenuItem onSelect={() => servers.openEdit(row)}>
                      <PencilIcon />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => servers.askRemove(row)}>
                      <Trash2Icon />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {#if row.issue !== undefined}
                <div
                  class="bg-destructive/10 text-destructive flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-3 py-2 text-sm"
                >
                  <ShieldAlertIcon class="size-4 shrink-0" />
                  <p class="min-w-0 flex-1">{issueText[row.issue].text}</p>
                  <Button variant="outline" size="xs" onclick={() => servers.openEdit(row)}>
                    {issueText[row.issue].action}
                  </Button>
                </div>
              {/if}
              {#if row.languages.length === 0}
                <p class="text-muted-foreground text-sm">No languages selected</p>
              {:else}
                {@const folded = folds(row.languages) && unfolded[row.url] !== true}
                {@const groups = shownGroups(row.languages, folded)}
                <div class="flex flex-col gap-2">
                  {#each groups as group, groupIndex (group.into)}
                    <div class="flex flex-col gap-1.5">
                      <p class="text-muted-foreground text-xs">Into {group.into}</p>
                      <ul class="flex flex-wrap gap-1.5">
                        {#each group.pairs as lang (lang)}
                          {@const unoffered = row.unoffered.includes(lang)}
                          <li
                            class={[
                              "bg-muted rounded-full px-2.5 py-0.5 text-xs",
                              unoffered && "text-muted-foreground line-through",
                            ]}
                            title={unoffered
                              ? `${pairName(lang)}: no longer offered by this server`
                              : pairName(lang)}
                          >
                            {sourceName(lang)}
                          </li>
                        {/each}
                        {#if groupIndex === groups.length - 1 && folds(row.languages)}
                          <li>
                            <button
                              type="button"
                              class="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-full border px-2.5 py-0.5 text-xs"
                              onclick={() => (unfolded[row.url] = folded)}
                            >
                              {folded ? `+${row.languages.length - FOLDED_LANGUAGES} more` : "Show less"}
                            </button>
                          </li>
                        {/if}
                      </ul>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if row.context !== undefined}
                <p class="text-muted-foreground text-sm">{contextText[row.context]}</p>
              {/if}
              {#if row.sources.length > 0}
                <div class="text-sm">
                  <SourceCredits sources={row.sources} />
                </div>
              {/if}
            </ContextMenuTrigger>
            <ContextMenuContent class="min-w-40">
              <ContextMenuItem onSelect={() => servers.openEdit(row)}>
                <PencilIcon />
                Edit
              </ContextMenuItem>
              <ContextMenuItem variant="destructive" onSelect={() => servers.askRemove(row)}>
                <Trash2Icon />
                Remove
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </li>
      {/each}
    </ul>
  {/if}
</section>

{#if servers.dialogState !== "closed"}
  <ServerDialog setup={servers} />
{/if}

<RemoveDialog setup={servers} />
