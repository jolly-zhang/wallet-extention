import { useWalletStore } from '../stores/walletStore';
import { handleWalletConnect, handleWalletConnectDecision, handleWalletGetAccounts, handleWalletGetChainId, handleWalletSwitchChain, setupConnectPrompt } from './connect-prompt';
import { handleWalletSendTransaction, handleWalletSendTransactionDecision, handleWalletSendTransactionGet, setupSendPrompt } from './send-prompt';
import injectMyWallet from './injected-helper';
import * as constant from './type_constant';

console.log('background 脚本启动了');

// 初始化钱包状态
const initWallet = () => {
  const walletStore = useWalletStore.getState()
  // TODO 初始化逻辑
  console.log('🔄 初始化钱包状态完成'); 
}

// 注册消息监听器
const setupMessageListener = () => {
  console.log('🔄 监听来自 message-bridge 的消息');
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("background 收到消息:", message.type, "来自标签页：", sender.tab?.id);
    // 处理连接请求：先打开确认窗口，等用户点确认或拒绝后再回复网页
    if (message.type === constant.WALLET_CONNECT) {
      handleWalletConnect(message, sender, sendResponse)
      return true
    }

    if (message.type === constant.WALLET_CONNECT_DECISION) {
      handleWalletConnectDecision(message, sender, sendResponse)
      return true
    }

    if (message.type === constant.WALLET_GET_CHAIN_ID) {
      handleWalletGetChainId(sendResponse)
      return true
    }

    if (message.type === constant.WALLET_GET_ACCOUNTS) {
      handleWalletGetAccounts(sendResponse)
      return true
    }

    if (message.type === constant.WALLET_SWITCH_CHAIN) {
      handleWalletSwitchChain(message, sendResponse)
      return true
    }

    if (message.type === constant.WALLET_SEND_TRANSACTION) {
      handleWalletSendTransaction(message, sender, sendResponse)
      return true
    }

    if (message.type === constant.WALLET_SEND_TRANSACTION_GET) {
      handleWalletSendTransactionGet(message, sender, sendResponse)
      return true
    }

    if (message.type === constant.WALLET_SEND_TRANSACTION_DECISION) {
      handleWalletSendTransactionDecision(message, sender, sendResponse)
      return true
    }

    // 获取账号请求
    if (message.type === constant.WALLET_GET_ACCOUNT) {
      const walletStore = useWalletStore.getState()
      const account = walletStore.currentAccount
      sendResponse({
        data: { account }
      })
      return true
    }
    
    // 处理签名
    if (message.type === constant.WALLET_SIGN_MESSAGE) {
      if (!message.data || !message.data.message) {
        sendResponse({
          data: { error: '缺少签名信息' },
        })
        return true 
      }
      const walletStore = useWalletStore.getState()
      try {
        walletStore.signMessage(message.data.message)
        .then((signedMessage) => {
          sendResponse({
            data: { signedMessage }
          })
        })
        .catch((error) => {
          sendResponse({
            data: { error: error.message },
          })
        })
      } catch (error) {
        sendResponse({
          data: { error: error instanceof Error ? error.message : '签名失败' },
        })
      }
      return true
    }

    // 处理断开连接
    if (message.type === constant.WALLET_DISCONNECT) {
      const walletStore = useWalletStore.getState()
      walletStore.disconnect()
      sendResponse({
        data: { success: true }
      })
      return true
    }

    // 未知类型消息
    sendResponse({
      data: { error: '未知消息类型' },
    })
    return true
  })
}

// 注入钱包脚本到页面
const setupScriptInjection = () => {
  // 当页面加载完成时注入
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
      console.log("🔄 页面加载完成，开始注入 myWallet:", tab.url)
      chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: injectMyWallet
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("❌ Background script: 注入失败", chrome.runtime.lastError)
        } else {
          console.log("✅ Background script: myWallet 注入完成")
        }
      })
    }
  })

  const injectIntoTab = (tabId: number, url?: string) => {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: injectMyWallet
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("❌ Background script: 注入失败", chrome.runtime.lastError)
      }
    })
  }

  // 扩展重载后，给已经打开的网页补上最新的 provider
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) injectIntoTab(tab.id, tab.url)
    })
  })

  // 当标签页激活时也注入（备用机制）
  chrome.tabs.onActivated.addListener((e) => {
    chrome.tabs.get(e.tabId, (tab) => {
      if (tab.url && !tab.url.startsWith('chrome://')) {
        console.log("🔄 标签页激活，注入 myWallet:", tab.url)
        chrome.scripting.executeScript({
          target: { tabId: e.tabId },
          world: "MAIN",
          func: injectMyWallet
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("❌ Background script: 注入失败", chrome.runtime.lastError)
          } else {
            console.log("✅ Background script: myWallet 注入完成")
          }
        })  
      }
    })  
  })
}

// 初始化
initWallet()
setupMessageListener()
setupScriptInjection()
setupConnectPrompt()
setupSendPrompt()

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log('🔄 扩展安装事件:', details.reason);
  if (details.reason === 'install') {
    // 执行安装时的操作
    console.log('🔄 扩展安装完成');
  }
})