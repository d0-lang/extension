import { checkServers, type CheckResult } from '$lib/check';
import { boundLanguages, lookupWord } from '$lib/dict';
import {
  isLookupRequestMessage,
  type LookupReply,
  type LookupRequestMessage,
  type OpenLookupMessage,
} from '$lib/messages';
import { getLookupEnabled, getServerByLang, getServerIssues } from '$lib/storage';

const MENU_ITEM_ID = 'dict-look-up';
const NOTIFICATION_PREFIX = 'server:';
// `--destructive` from tokens.css. The badge API takes a plain color, not a CSS variable.
const ISSUE_BADGE_COLOR = '#e7000b';

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

const syncBadge = async () => {
  const count = Object.keys(await getServerIssues()).length;
  await action.setBadgeText({ text: count === 0 ? '' : '!' });
  if (count > 0) {
    await action.setBadgeBackgroundColor({ color: ISSUE_BADGE_COLOR });
  }
};

const setUp = () => {
  void syncAction();
  void syncBadge();
  void createMenuItem();
};

const notificationText = (result: CheckResult): { title: string; message: string } | undefined => {
  switch (result.kind) {
    case 'moved':
      return {
        title: `${result.name} moved`,
        message: `It now answers at ${result.url}. dadict updated its address.`,
      };
    case 'identity':
      return {
        title: `${result.name} changed its identity`,
        message: 'Its signing key is different. Review it in dadict settings before you trust it.',
      };
    case 'broken':
      return {
        title: `Can't verify ${result.name}`,
        message: 'Its answer failed the signature check, so dadict kept the last verified data.',
      };
    default:
      return undefined;
  }
};

const notify = (results: Array<CheckResult>) => {
  for (const result of results) {
    const text = notificationText(result);
    if (text !== undefined) {
      void browser.notifications.create(`${NOTIFICATION_PREFIX}${result.url}`, {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.png'),
        ...text,
      });
    }
  }
};

const check = () =>
  checkServers().match(notify, (error) => console.warn('Could not check servers', error));

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
    // An update restarts the client too, and a dev reload counts as one.
    if (reason === 'update') {
      void check();
    }
  });
  // A persistent Firefox background page does not keep its menu items across restarts.
  browser.runtime.onStartup.addListener(() => {
    setUp();
    void openSetupIfUnbound();
    void check();
  });

  browser.notifications.onClicked.addListener((notificationId) => {
    if (notificationId.startsWith(NOTIFICATION_PREFIX)) {
      void browser.notifications.clear(notificationId);
      void openSetup();
    }
  });

  browser.storage.onChanged.addListener((changes) => {
    if ('serverByLang' in changes) {
      void syncAction();
    }
    if ('serverIssues' in changes) {
      void syncBadge();
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
