/*
 * Bound language rows plus the add → review → save dialog.
 * `openAdd` / `acceptDraft` / `save` are the three steps; `closeAdd` / `closeReview` abort.
 * `openEdit` runs the same steps against a bound server.
 */
import { ResultAsync } from "neverthrow";
import type { HandshakeOk } from "$lib/dict";
import {
  bindServer,
  getServerByLang,
  getServers,
  removeServer,
  type ServerByLang,
  type Servers,
} from "$lib/storage";
import type { DialogState, ServerRow } from "./types";

export class ServerSetup {
  rows = $state.raw<Array<ServerRow>>([]);
  servers = $state.raw<Servers>({});
  serverByLang = $state.raw<ServerByLang>({});
  dialogState = $state<DialogState>("closed");
  draft = $state.raw<HandshakeOk | null>(null);
  selected = $state<Record<string, boolean>>({});
  genericError = $state("");
  removeTarget = $state.raw<ServerRow | null>(null);
  removing = $state(false);
  removeError = $state("");
  /** Set while the add dialog reconnects to a bound server to change its languages. */
  editUrl = $state<string | undefined>(undefined);

  addOpen =$derived(this.dialogState === "add-open");
  reviewOpen = $derived(
    this.dialogState === "review-open" || this.dialogState === "saving",
  );
  saving = $derived(this.dialogState === "saving");

  selectedLanguages = $derived(
    Object.entries(this.selected)
      .filter(([, on]) => on)
      .map(([lang]) => lang),
  );
  /** A bound server may keep no languages, so accepting its new key never forces a choice. */
  canSave = $derived(
    this.selectedLanguages.length > 0 ||
      (this.draft !== null &&
        (this.draft.url in this.servers ||
          (this.draft.movedFrom !== undefined &&
            this.draft.movedFrom in this.servers))),
  );
  /** Languages mapped to this server that it no longer lists. Saving unmaps them. */
  droppedLanguages = $derived.by(() => {
    const draft = this.draft;
    if (draft === null) {
      return [];
    }
    return Object.entries(this.serverByLang)
      .filter(
        ([lang, url]) =>
          this.#belongsToDraft(url, draft) && !draft.meta.languages.includes(lang),
      )
      .map(([lang]) => lang);
  });

  #belongsToDraft = (url: string, draft: HandshakeOk): boolean =>
    url === draft.url || url === draft.movedFrom;

  load = async () => {
    const [servers, nextServerByLang] = await Promise.all([
      getServers(),
      getServerByLang(),
    ]);
    this.servers = servers;
    this.serverByLang = nextServerByLang;
    const languages = Object.entries(nextServerByLang);
    this.rows = Object.values(servers).map(({ url, name }) => ({
      url,
      name,
      languages: languages
        .filter(([, mapped]) => mapped === url)
        .map(([lang]) => lang),
    }));
  };

  askRemove = (row: ServerRow) => {
    this.removeError = "";
    this.removeTarget = row;
  };

  cancelRemove = () => {
    if (!this.removing) {
      this.removeTarget = null;
    }
  };

  confirmRemove = async () => {
    if (this.removeTarget === null) {
      return;
    }
    this.removing = true;
    this.removeError = "";
    const result = await removeServer(this.removeTarget.url).andThen(() =>
      ResultAsync.fromPromise(this.load(), (cause) =>
        cause instanceof Error ? cause : new Error(String(cause)),
      ),
    );
    this.removing = false;
    if (result.isErr()) {
      this.removeError = result.error.message;
      return;
    }
    this.removeTarget = null;
  };

  resetDialog = () => {
    this.editUrl = undefined;
    this.draft = null;
    this.selected = {};
    this.genericError = "";
    this.dialogState = "closed";
  };

  openAdd = () => {
    this.editUrl = undefined;
    this.draft = null;
    this.selected = {};
    this.genericError = "";
    this.dialogState = "add-open";
  };

  /** Reconnect first, so the review lists what the server offers now. */
  openEdit = (row: ServerRow) => {
    this.openAdd();
    this.editUrl = row.url;
  };

  acceptDraft = (result: HandshakeOk) => {
    if (this.dialogState !== "add-open") {
      return;
    }
    this.draft = result;
    this.selected = Object.fromEntries(
      result.meta.languages.map((lang) => {
        const mapped = this.serverByLang[lang];
        return [lang, mapped !== undefined && this.#belongsToDraft(mapped, result)];
      }),
    );
    this.dialogState = "review-open";
  };

  closeAdd = () => {
    if (this.dialogState === "add-open") {
      this.resetDialog();
    }
  };

  closeReview = () => {
    if (this.dialogState === "review-open" || this.dialogState === "saving") {
      this.resetDialog();
    }
  };

  save = async () => {
    if (this.draft === null || !this.canSave) {
      return;
    }
    this.dialogState = "saving";
    this.genericError = "";
    const result = await bindServer(
      {
        url: this.draft.url,
        key: this.draft.key,
        name: this.draft.meta.name,
        languages: this.draft.meta.languages,
        verificationUrls: this.draft.meta.verification_urls,
      },
      this.selectedLanguages,
      this.draft.movedFrom,
    ).andThen(() =>
      ResultAsync.fromPromise(this.load(), (cause) =>
        cause instanceof Error ? cause : new Error(String(cause)),
      ),
    );
    if (this.dialogState !== "saving") {
      return;
    }
    if (result.isErr()) {
      this.dialogState = "review-open";
      this.genericError = result.error.message;
      return;
    }
    this.resetDialog();
  };
}
