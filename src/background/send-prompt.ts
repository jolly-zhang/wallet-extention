import * as constant from './type_constant'

export type PendingTransaction = {
  from?: string
  to?: string
  value?: string
  data?: string
  gas?: string
  gasLimit?: string
  gasPrice?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  nonce?: string
  chainId?: string
}

type SendResponse = {
  data: {
    hash?: string
    error?: string
    code?: number
  }
}

type PendingSend = {
  requestId: string
  sendResponse: (response: SendResponse) => void
  settled: boolean
  origin: string
  title: string
  favicon: string
  transaction: PendingTransaction
}

let pendingSend: PendingSend | null = null
let sendWindowId: number | null = null

const TX_FIELDS = [
  'from',
  'to',
  'value',
  'data',
  'gas',
  'gasLimit',
  'gasPrice',
  'maxFeePerGas',
  'maxPriorityFeePerGas',
  'nonce',
  'chainId'
] as const

function isExtensionPage(sender: chrome.runtime.MessageSender) {
  return !!sender.url && sender.url.startsWith(chrome.runtime.getURL(''))
}

function normalizeTransaction(raw: any): PendingTransaction | null {
  if (!raw || typeof raw !== 'object') return null
  const transaction: PendingTransaction = {}
  for (const field of TX_FIELDS) {
    if (raw[field] != null && raw[field] !== '') {
      transaction[field] = String(raw[field])
    }
  }
  if (!transaction.to && !transaction.data) return null
  return transaction
}

function settlePending(payload: SendResponse) {
  const pending = pendingSend
  if (!pending || pending.settled) return
  pending.settled = true
  pendingSend = null
  try {
    pending.sendResponse(payload)
  } catch (error) {
    console.error('回复交易请求失败', error)
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

async function openSendWindow(requestId: string) {
  const url = new URL(chrome.runtime.getURL('popup.html'))
  url.searchParams.set('action', 'send')
  url.searchParams.set('requestId', requestId)
  const target = url.toString()

  if (sendWindowId != null) {
    try {
      const existing = await chrome.windows.get(sendWindowId, { populate: true })
      const tabId = existing.tabs?.[0]?.id
      if (tabId != null) {
        await chrome.tabs.update(tabId, { url: target, active: true })
        await chrome.windows.update(sendWindowId, { focused: true })
        return
      }
    } catch {
      sendWindowId = null
    }
  }

  const created = await chrome.windows.create({
    url: target,
    type: 'popup',
    width: 400,
    height: 720,
    focused: true
  })
  sendWindowId = created?.id ?? null
}

export function setupSendPrompt() {
  chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId !== sendWindowId) return
    sendWindowId = null
    settlePending({ data: { error: '用户拒绝交易', code: 4001 } })
  })

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== constant.SEND_PORT_NAME) return
    port.onDisconnect.addListener(() => {
      console.log('交易确认窗口端口断开')
    })
  })
}

export function handleWalletSendTransaction(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: SendResponse) => void
) {
  const requestId = message.requestId as string
  if (!requestId) {
    sendResponse({ data: { error: '缺少请求 ID' } })
    return
  }

  const transaction = normalizeTransaction(message.data?.transaction)
  if (!transaction) {
    sendResponse({ data: { error: '缺少交易参数' } })
    return
  }

  if (pendingSend && !pendingSend.settled) {
    settlePending({ data: { error: '交易请求已被新的请求取代' } })
  }

  const { origin, title, favicon } = pageInfoFrom(message, sender)
  pendingSend = {
    requestId,
    sendResponse,
    settled: false,
    origin,
    title,
    favicon,
    transaction
  }

  openSendWindow(requestId).catch((error) => {
    console.error('打开交易确认窗口失败', error)
    settlePending({ data: { error: '无法打开确认窗口' } })
  })
}

export function handleWalletSendTransactionGet(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) {
  if (!isExtensionPage(sender)) {
    sendResponse({ ok: false, error: '无权读取交易' })
    return
  }
  if (!pendingSend || pendingSend.requestId !== message.requestId || pendingSend.settled) {
    sendResponse({ ok: false, error: '交易请求已失效' })
    return
  }
  sendResponse({
    ok: true,
    origin: pendingSend.origin,
    title: pendingSend.title,
    favicon: pendingSend.favicon,
    transaction: pendingSend.transaction
  })
}

export function handleWalletSendTransactionDecision(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { ok: boolean; error?: string }) => void
) {
  if (!isExtensionPage(sender)) {
    sendResponse({ ok: false, error: '无权确认交易' })
    return
  }
  if (!pendingSend || pendingSend.requestId !== message.requestId || pendingSend.settled) {
    sendResponse({ ok: false, error: '交易请求已失效' })
    return
  }

  if (!message.approved) {
    settlePending({ data: { error: message.error || '用户拒绝交易', code: 4001 } })
    sendResponse({ ok: true })
    return
  }

  if (!message.hash) {
    sendResponse({ ok: false, error: '缺少交易哈希' })
    return
  }

  settlePending({ data: { hash: String(message.hash) } })
  sendResponse({ ok: true })
}
