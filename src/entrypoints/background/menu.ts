/** The "Look up" item in the right-click menu. */
import type { OpenLookupMessage } from "$lib/messages"
import { getLookupEnabled } from "$lib/storage"

const MENU_ITEM_ID = "dict-look-up"

/** Replace the item, which is hidden while lookup is off. */
export const createMenuItem = async () => {
  await browser.contextMenus.removeAll()
  browser.contextMenus.create({
    id: MENU_ITEM_ID,
    title: "Look up",
    contexts: ["page", "frame", "selection", "link", "editable"],
    visible: await getLookupEnabled(),
  })
}

export const showMenuItem = (visible: boolean) => {
  void browser.contextMenus.update(MENU_ITEM_ID, { visible })
}

/** Ask the content script in the clicked frame to open the popover. */
export const openFromMenu = (info: Browser.contextMenus.OnClickData, tab: Browser.tabs.Tab | undefined) => {
  if (info.menuItemId !== MENU_ITEM_ID || tab?.id === undefined) {
    return
  }
  const message: OpenLookupMessage = {
    type: "lookup:open",
    selectionText: info.selectionText,
  }
  // Fails on pages without the content script: browser pages, and tabs opened before install.
  browser.tabs
    .sendMessage(tab.id, message, { frameId: info.frameId })
    .catch((error: unknown) => console.warn("Could not open the lookup popover", error))
}
