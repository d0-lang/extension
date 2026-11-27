import {
  isAudioRequestMessage,
  isInAnkiMessage,
  isLookupRequestMessage,
  isShownLookupMessage,
} from "$lib/messages"
import {
  clearLastLookup,
  closeOnboardingIfSetUp,
  getServerByLang,
  isSeedKey,
  setOnboarding,
} from "$lib/storage"
import { action, openSetup, openSetupIfUnbound, syncAction, syncBadge } from "./action"
import { inAnki } from "./anki"
import { fetchAudio } from "./audio"
import { checkServers, isDailyCheck, scheduleDailyCheck } from "./check"
import { answer } from "./lookup"
import { createMenuItem, listenToMenu, showMenuItem } from "./menu"
import { isServerNotification, notify } from "./notifications"
import { rememberShown } from "./shown"

const setUp = () => {
  void syncAction()
  void syncBadge()
  void createMenuItem()
}

const check = () => checkServers().match(notify, (error) => console.warn("Could not check servers", error))

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    setUp()
    if (reason === "install") {
      // Stored at once, so a later update knows this one started with Get started.
      void setOnboarding({})
      void openSetup()
    }
    // An update restarts the client too, and a dev reload counts as one.
    if (reason === "update") {
      void check()
      void getServerByLang().then((bound) => closeOnboardingIfSetUp(Object.keys(bound).length > 0))
    }
  })
  // A persistent Firefox background page does not keep its menu items across restarts.
  browser.runtime.onStartup.addListener(() => {
    setUp()
    void openSetupIfUnbound()
    void check()
  })

  // Not every browser keeps alarms across a restart, and the background starts for other reasons too.
  void scheduleDailyCheck()
  browser.alarms.onAlarm.addListener((alarm) => {
    if (isDailyCheck(alarm)) {
      void check()
    }
  })

  browser.notifications.onClicked.addListener((notificationId) => {
    if (isServerNotification(notificationId)) {
      void browser.notifications.clear(notificationId)
      void openSetup()
    }
  })

  browser.storage.onChanged.addListener((changes) => {
    if ("serverByLang" in changes) {
      void syncAction()
    }
    if (
      ["serverIssues", "ankiEnabled"].some((key) => key in changes) ||
      Object.keys(changes).some(isSeedKey)
    ) {
      void syncBadge()
    }
    if ("lookupEnabled" in changes) {
      showMenuItem(changes.lookupEnabled?.newValue === true)
    }
  })

  action.onClicked.addListener(() => {
    void openSetup()
  })

  listenToMenu()

  browser.tabs.onRemoved.addListener((tabId) => {
    void clearLastLookup(tabId)
  })

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isAudioRequestMessage(message)) {
      void fetchAudio(message.url).then(sendResponse)
      return true
    }
    if (isInAnkiMessage(message)) {
      void inAnki(message.lemmas).then(sendResponse)
      return true
    }
    if (isShownLookupMessage(message)) {
      rememberShown(message, sender.tab?.id).catch((error) =>
        console.warn("Could not keep the last lookup", error),
      )
      return
    }
    if (!isLookupRequestMessage(message)) {
      return
    }
    void answer(message, sender.url).then(sendResponse)
    // Chrome only keeps the channel open for `sendResponse` when the listener returns true.
    return true
  })
})
