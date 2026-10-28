import * as constant from './type_constant'

type PublicAccount = {
  address: string
  name: string
  index: number
  type: string
}

type ConnectResponse = {
  data: {
    account?: PublicAccount
    accounts?: string[]
    chainId?: string
    error?: string
    code?: number
  }
}

type PendingConnect = {
  requestId: string
  sendResponse: (response: ConnectResponse) => void
  settled: boolean
}

let pendingConnect: PendingConnect | null = null
let connectWindowId: number | null = null

function isExtensionPage(sender: chrome.runtime.MessageSender) {
  return !!sender.url && sender.url.startsWith(chrome.runtime.getURL(''))
}

async function readWalletState(): Promise<any | null> {
  const result = await chrome.storage.local.get('wallet-store')
  const raw = result['wallet-store']
  if (!raw) return null
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed?.state ?? null
  } catch {
    return null
  }
}

function findAccount(state: any, address: string) {
  const accounts = [
    ...(state?.keyrings ?? []).flatMap((keyring: any) => keyring.accounts ?? []),
    ...(state?.importedAccounts ?? [])
  ]
  return accounts.find((account: any) => account.address?.toLowerCase() === address.toLowerCase())
}

function toPublicAccount(account: any): PublicAccount {
  return {
    address: account.address,
    name: account.name,
    index: account.index,
    type: account.type
  }
}

function settlePending(payload: ConnectResponse) {
  const pending = pendingConnect
  if (!pending || pending.settled) return
  pending.settled = true
  pendingConnect = null
  try {
    pending.sendResponse(payload)
  } catch (error) {
    console.error('回复连接请求失败', error)
  }
}

function pageInfoFrom(message: any, sender: chrome.runtime.MessageSender) {
  const pageUrl = sender.tab?.url || ''
  let origin = ''
  try {
    origin = pageUrl ? new URL(pageUrl).origin : ''
  } catch {
    origin = ''
  }
  if (!origin) origin = message?.data?.origin || ''
  const title = String(message?.data?.title || origin || '未知网站').slice(0, 120)
  const favicon = typeof message?.data?.favicon === 'string' ? message.data.favicon : ''
  return { origin, title, favicon }
}

function buildConnectWindowUrl(requestId: string, origin: string, title: string, favicon: string) {
  const url = new URL(chrome.runtime.getURL('popup.html'))
  url.searchParams.set('action', 'connect')
  url.searchParams.set('requestId', requestId)
  url.searchParams.set('origin', origin)
  url.searchParams.set('title', title)
  if (favicon && favicon.length <= 500 && !favicon.startsWith('data:')) {
    url.searchParams.set('favicon', favicon)
  }
  return url.toString()
}

async function openConnectWindow(requestId: string, origin: string, title: string, favicon: string) {
  const url = buildConnectWindowUrl(requestId, origin, title, favicon)
  if (connectWindowId != null) {
    try {
      const existing = await chrome.windows.get(connectWindowId, { populate: true })
      const tabId = existing.tabs?.[0]?.id
      if (tabId != null) {
        await chrome.tabs.update(tabId, { url, active: true })
        await chrome.windows.update(connectWindowId, { focused: true })
        return
      }
    } catch {
      connectWindowId = null
    }
  }

  const created = await chrome.windows.create({
    url,
    type: 'popup',
    width: 400,
    height: 680,
    focused: true
  })
  connectWindowId = created?.id ?? null
}

export function setupConnectPrompt() {
  chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId !== connectWindowId) return
    connectWindowId = null
    settlePending({ data: { error: '用户拒绝连接', code: 4001 } })
  })

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== constant.CONNECT_PORT_NAME) return
    // 确认窗口存活期间保住 service worker，避免用户还没点确认通道就被回收
    port.onDisconnect.addListener(() => {
      console.log('连接确认窗口端口断开')
    })
  })
}

export function handleWalletConnect(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ConnectResponse) => void
) {
  const requestId = message.requestId as string
  if (!requestId) {
    sendResponse({ data: { error: '缺少请求 ID' } })
    return
  }

  if (pendingConnect && !pendingConnect.settled) {
    settlePending({ data: { error: '连接请求已被新的请求取代' } })
  }

  pendingConnect = {
    requestId,
    sendResponse,
    settled: false
  }

  const { origin, title, favicon } = pageInfoFrom(message, sender)
  openConnectWindow(requestId, origin, title, favicon).catch((error) => {
    console.error('打开连接确认窗口失败', error)
    settlePending({ data: { error: '无法打开确认窗口' } })
  })
}

export async function handleWalletGetChainId(sendResponse: (response: ConnectResponse) => void) {
  const state = await readWalletState()
  const chainId = Number(state?.currentNetwork?.chainId ?? 1)
  sendResponse({ data: { chainId: `0x${chainId.toString(16)}` } })
}

export async function handleWalletGetAccounts(sendResponse: (response: ConnectResponse) => void) {
  const state = await readWalletState()
  if (!state || state.isLocked || !state.isConnected || !state.currentAccount?.address) {
    sendResponse({ data: { accounts: [] } })
    return
  }
  sendResponse({ data: { accounts: [state.currentAccount.address] } })
}

export async function handleWalletSwitchChain(
  message: any,
  sendResponse: (response: ConnectResponse) => void
) {
  try {
    const chainIdHex = message?.data?.chainId
    const chainId = Number.parseInt(chainIdHex, 16)
    if (!chainIdHex || Number.isNaN(chainId)) {
      sendResponse({ data: { error: '无效的链 ID' } })
      return
    }

    const result = await chrome.storage.local.get('wallet-store')
    const raw = result['wallet-store']
    const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null
    const network = parsed?.state?.networks?.find((item: any) => item.chainId === chainId)
    if (!parsed?.state || !network) {
      sendResponse({ data: { error: '钱包里还没有这条链', code: 4902 } })
      return
    }

    parsed.state.currentNetwork = network
    await chrome.storage.local.set({ 'wallet-store': parsed })
    sendResponse({ data: { chainId: `0x${chainId.toString(16)}` } })
  } catch (error) {
    sendResponse({ data: { error: error instanceof Error ? error.message : '切换网络失败' } })
  }
}

export function handleWalletConnectDecision(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { ok: boolean; error?: string }) => void
) {
  if (!isExtensionPage(sender)) {
    sendResponse({ ok: false, error: '无权确认连接' })
    return
  }

  const requestId = message.requestId as string
  if (!pendingConnect || pendingConnect.requestId !== requestId || pendingConnect.settled) {
    sendResponse({ ok: false, error: '连接请求已失效' })
    return
  }

  if (!message.approved) {
    settlePending({ data: { error: message.error || '用户拒绝连接', code: 4001 } })
    sendResponse({ ok: true })
    return
  }

  const address = message.address as string
  if (!address) {
    sendResponse({ ok: false, error: '请选择账户' })
    return
  }

  readWalletState()
    .then((state) => {
      if (!pendingConnect || pendingConnect.requestId !== requestId || pendingConnect.settled) {
        sendResponse({ ok: false, error: '连接请求已失效' })
        return
      }
      const account = state ? findAccount(state, address) : null
      if (!account) {
        sendResponse({ ok: false, error: '账户不存在，请先在插件中导入账户' })
        return
      }
      settlePending({ data: { account: toPublicAccount(account) } })
      sendResponse({ ok: true })
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : '确认连接失败' })
    })
}
