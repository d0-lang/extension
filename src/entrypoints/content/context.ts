import { ResultAsync } from 'neverthrow';

/** Below this, detection is unreliable, so a wider ancestor is used. */
const MIN_CONTEXT_CHARS = 80;
const MAX_SAMPLE_CHARS = 2000;

/** Text of the nearest ancestor long enough to detect a language from. */
export const contextText = (element: Element | null): string => {
  if (element === null) {
    return '';
  }
  const text = (element instanceof HTMLElement ? element.innerText : element.textContent) ?? '';
  return text.trim().length >= MIN_CONTEXT_CHARS || element.parentElement === null
    ? text.trim().slice(0, MAX_SAMPLE_CHARS)
    : contextText(element.parentElement);
};

const detect = ResultAsync.fromThrowable((text: string) => browser.i18n.detectLanguage(text));

/** Detected language codes, best first. The text stays on this device. */
export const detectLanguages = (text: string): Promise<Array<string>> =>
  detect(text)
    .map(({ languages }) => languages.map(({ language }) => language))
    .unwrapOr([]);
