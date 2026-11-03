import { boundLanguages, lookupWord } from '$lib/dict';
import {
  isLookupRequestMessage,
  type LookupReply,
  type LookupRequestMessage,
  type OpenLookupMessage,
} from '$lib/messages';
import { getLookupEnabled, getServerByLang } from '$lib/storage';

const MENU_ITEM_ID = 'dict-look-up';

// Firefox MV2 only has `browserAction`.
const action = browser.action ?? browser.browserAction;

const isUnbound = async () => Object.keys(await getServerByLang()).length === 0;

const openSetup = async () => {
  await browser.tabs.create({ url: browser.runtime.getURL('/setup.html') });
};

const openSetupIfUnbound = async () => {
  if (await isUnbound()) {
    await openSetup();
  }
};

// `onClicked` only fires while the action has no popup.
const syncAction = async () => {
  await action.setPopup({ popup: (await isUnbound()) ? '' : '/popup.html' });
};

const createMenuItem = async () => {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: MENU_ITEM_ID,
    title: 'Look up',
    contexts: ['page', 'frame', 'selection', 'link', 'editable'],
    visible: await getLookupEnabled(),
  });
};

const setUp = () => {
  void syncAction();
  void createMenuItem();
};

const answer = async ({ word, hints }: LookupRequestMessage): Promise<LookupReply> => {
  const languages = await boundLanguages().unwrapOr([]);
  return lookupWord(word, hints).match(
    (outcome): LookupReply => ({ ok: true, languages, ...outcome }),
    (error): LookupReply => ({ ok: false, languages, error }),
  );
};

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    setUp();
    if (reason === 'install') {
      void openSetup();
    }
  });
  // A persistent Firefox background page does not keep its menu items across restarts.
  browser.runtime.onStartup.addListener(() => {
    setUp();
    void openSetupIfUnbound();
  });

  browser.storage.onChanged.addListener((changes) => {
    if ('serverByLang' in changes) {
      void syncAction();
    }
    if ('lookupEnabled' in changes) {
      void browser.contextMenus.update(MENU_ITEM_ID, {
        visible: changes.lookupEnabled?.newValue === true,
      });
    }
  });

  action.onClicked.addListener(() => {
    void openSetup();
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ITEM_ID || tab?.id === undefined) {
      return;
    }
    const message: OpenLookupMessage = {
      type: 'lookup:open',
      selectionText: info.selectionText,
    };
    // Fails on pages without the content script: browser pages, and tabs opened before install.
    browser.tabs
      .sendMessage(tab.id, message, { frameId: info.frameId })
      .catch((error: unknown) => console.warn('Could not open the lookup popover', error));
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isLookupRequestMessage(message)) {
      return;
    }
    void answer(message).then(sendResponse);
    // Chrome only keeps the channel open for `sendResponse` when the listener returns true.
    return true;
  });
});
