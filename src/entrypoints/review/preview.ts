/** Anki's card template syntax, enough of it for the DaDict note type, to preview a card as Anki shows it. */

/** `{{#Field}}…{{/Field}}` shows while the field has text, `{{^Field}}…{{/Field}}` while it has none. */
const SECTION = /\{\{([#^])([^}]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g
const FIELD = /\{\{([^}#^/]+)\}\}/g

/** `template` with `fields` put in. Their values are HTML already, as Anki takes them. */
export const renderTemplate = (template: string, fields: Readonly<Record<string, string>>): string => {
  const value = (name: string) => (Object.hasOwn(fields, name) ? fields[name]! : "")
  return template
    .replace(SECTION, (_, kind: string, name: string, inner: string) =>
      (value(name) !== "") === (kind === "#") ? inner : "",
    )
    .replace(FIELD, (_, name: string) => value(name))
}
