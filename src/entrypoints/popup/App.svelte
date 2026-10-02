<script lang="ts">
  import { DEFAULT_BASE_URL, runLookup, type LookupResult } from '../../lib/dict'

  let baseUrl = $state(DEFAULT_BASE_URL)
  let word = $state('Mutter')
  let lang = $state('de_en')
  let running = $state(false)
  let error = $state('')
  let serverName = $state('')
  let result = $state<LookupResult | null>(null)

  const onRun = async () => {
    running = true
    error = ''
    serverName = ''
    result = null
    try {
      const run = await runLookup(baseUrl.trim(), word.trim(), lang.trim())
      serverName = run.meta.name
      result = run.result
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    } finally {
      running = false
    }
  }
</script>

<main>
  <h1>Lookup</h1>
  <form
    onsubmit={(event) => {
      event.preventDefault()
      void onRun()
    }}
  >
    <label>
      Server
      <input bind:value={baseUrl} type="url" autocomplete="off" spellcheck="false" />
    </label>
    <label>
      Word
      <input bind:value={word} autocomplete="off" />
    </label>
    <label>
      Language
      <input bind:value={lang} autocomplete="off" spellcheck="false" />
    </label>
    <button type="submit" disabled={running}>
      {running ? 'Running…' : 'Run'}
    </button>
  </form>

  {#if error}
    <p class="error">{error}</p>
  {/if}
  {#if serverName}
    <p>Server: {serverName}</p>
  {/if}
  {#if result}
    <p>{result.word} → {result.translation}</p>
  {/if}
</main>

<style>
  main {
    width: 320px;
    padding: 16px;
    text-align: left;
  }

  h1 {
    margin: 0 0 12px;
    font-size: 1.25rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.85rem;
  }

  input {
    font: inherit;
    padding: 6px 8px;
    border: 1px solid #555;
    border-radius: 6px;
    background: transparent;
    color: inherit;
  }

  .error {
    color: #f07178;
  }
</style>
