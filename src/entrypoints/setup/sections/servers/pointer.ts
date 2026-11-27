/**
 * Whether a mouse is at hand, where a text field may take focus as a step opens. On a phone that would bring up the
 * keyboard, which covers most of the dialog.
 */
export const hasMouse = (): boolean => matchMedia("(pointer: fine)").matches
