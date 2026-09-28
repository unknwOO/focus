import removeProtocol from "./remove-protocol";

export type ContextMenuBlockHandler = (blockedUrl: string, tabId: number, url: string) => void;

const blockOneId = "block_one";
const blockAllId = "block_all";
let currentHandler: ContextMenuBlockHandler | undefined;
let listenerRegistered = false;
let recreateQueue = Promise.resolve();

const handleClick = (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
  const tabId = tab?.id;
  if (!currentHandler || !tabId || ![blockOneId, blockAllId].includes(String(info.menuItemId))) {
    return;
  }

  const url = info.pageUrl;
  const blockedUrl = info.menuItemId === blockOneId ? removeProtocol(url) : new URL(url).host;

  currentHandler(blockedUrl, tabId, url);
};

const createContextMenu = () => {
  const parentId = chrome.contextMenus.create({
    id: "block_site",
    title: "Focus",
    documentUrlPatterns: ["https://*/*", "http://*/*"],
  });

  chrome.contextMenus.create({
    parentId,
    id: blockAllId,
    title: "Block entire website",
  });

  chrome.contextMenus.create({
    parentId,
    id: blockOneId,
    title: "Block this page only",
  });

  if (!listenerRegistered) {
    chrome.contextMenus.onClicked.addListener(handleClick);
    listenerRegistered = true;
  }
};

export default (meetsCreateCondition: boolean, onBlock: ContextMenuBlockHandler) => {
  currentHandler = meetsCreateCondition ? onBlock : undefined;
  recreateQueue = recreateQueue.then(
    () =>
      new Promise<void>((resolve) => {
        chrome.contextMenus.removeAll(() => {
          if (meetsCreateCondition) {
            createContextMenu();
          }
          resolve();
        });
      }),
  );
};
