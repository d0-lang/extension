/*
 * Bound language rows plus the add → review → save dialog.
 * `openAdd` / `acceptDraft` / `save` are the three steps; `closeAdd` / `closeReview` abort.
 */
import { ResultAsync } from "neverthrow";
import type { ServerMeta } from "$lib/dict";
import {
  bindServer,
  getServerByLang,
  getServers,
  type ServerByLang,
} from "$lib/storage";
import type { DialogState, ServerRow } from "./types";

export type HandshakeDraft = {
  url: string;
  key: string;
  meta: ServerMeta;
};

export class ServerSetup {
  rows = $state.raw<Array<ServerRow>>([]);
  serverByLang = $state.raw<ServerByLang>({});
  dialogState = $state<DialogState>("closed");
  draft = $state.raw<HandshakeDraft | null>(null);
  selected = $state<Record<string, boolean>>({});
  genericError = $state("");

  addOpen = $derived(this.dialogState === "add-open");
  reviewOpen = $derived(
    this.dialogState === "review-open" || this.dialogState === "saving",
  );
  saving = $derived(this.dialogState === "saving");

  load = async () => {
    const [servers, nextServerByLang] = await Promise.all([
      getServers(),
      getServerByLang(),
    ]);
    this.serverByLang = nextServerByLang;
    this.rows = Object.entries(nextServerByLang).map(([lang, serverUrl]) => ({
      lang,
      url: serverUrl,
      name: servers[serverUrl]?.name ?? serverUrl,
    }));
  };

  resetDialog = () => {
    this.draft = null;
    this.selected = {};
    this.genericError = "";
    this.dialogState = "closed";
  };

  openAdd = () => {
    this.draft = null;
    this.selected = {};
    this.genericError = "";
    this.dialogState = "add-open";
  };

  acceptDraft = (result: HandshakeDraft) => {
    if (this.dialogState !== "add-open") {
      return;
    }
    this.draft = result;
    this.selected = Object.fromEntries(
      result.meta.languages.map((lang) => [lang, false]),
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
    if (this.draft === null) {
      return;
    }
    const selectedLanguages = Object.entries(this.selected)
      .filter(([, on]) => on)
      .map(([lang]) => lang);
    if (selectedLanguages.length === 0) {
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
      selectedLanguages,
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
