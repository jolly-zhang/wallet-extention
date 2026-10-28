
 
export default function injectMyWallet() {
  console.log("injected-helper");
  // 注入版本
  const INJECTED_VERSION = 3
  // 如果已经注入，则返回
  if (window.myWalletInjectedVersion === INJECTED_VERSION) {
    return
  }
  // 设置注入版本
  window.myWalletInjectedVersion = INJECTED_VERSION
  // 钱包请求类型
  const WALLET_CONNECT = 'WALLET_CONNECT'
  const WALLET_GET_ACCOUNT = 'WALLET_GET_ACCOUNT'
  const WALLET_SIGN_MESSAGE = 'WALLET_SIGN_MESSAGE'
  const WALLET_DISCONNECT = 'WALLET_DISCONNECT'
  // 生成请求id
  const generateRequestId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  // 获取页面信息
  const getPageInfo = () => {
    const link = document.querySelector('link[rel~="icon"], link[rel="shortcut icon"]')
    let favicon = ''
    const href = link?.getAttribute('href')
    if (href) {
      try {
        favicon = new URL(href, window.location.href).href
      } catch {
        favicon = ''
      }
    }
    return {
      origin: window.location.origin,
      url: window.location.href,
      title: document.title,
      favicon
    }
  }
  const toRequestError = (message: string, code?: number) => {
    const error = new Error(message) as Error & { code?: number }
    if (code) error.code = code
    return error
  }
  const WALLET_GET_CHAIN_ID = 'WALLET_GET_CHAIN_ID'
  const WALLET_GET_ACCOUNTS = 'WALLET_GET_ACCOUNTS'
  const WALLET_SWITCH_CHAIN = 'WALLET_SWITCH_CHAIN'
  const WALLET_SEND_TRANSACTION = 'WALLET_SEND_TRANSACTION'

    // 发送钱包请求
  function sendWalletRequest(type: string, data?: unknown, timeout = 30000) {
    return new Promise<any>((resolve, reject) => {
      const requestId = generateRequestId()
      window.postMessage({
        type,
        requestId,
        from: 'injected-helper',
        data
      }, '*')

      let timer = 0
      const handleResponse = (event: MessageEvent) => {
        if (!_isValidResponse(event, requestId)) return
        window.clearTimeout(timer)
        window.removeEventListener('message', handleResponse)
        if (event.data.success) {
          resolve(event.data.data)
        } else {
          reject(toRequestError(event.data.error || '请求失败', event.data.code))
        }
      }
      window.addEventListener('message', handleResponse)
      timer = window.setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        reject(toRequestError('请求超时'))
      }, timeout)
    })
  }
  // 钱包对象 
  const myWallet = {
    // 连接钱包
    connect: async () => {
      console.log('connect');
      const data = await sendWalletRequest(WALLET_CONNECT, getPageInfo(), 180000)
      return data.account
    },
    // 获取当前账户信息
    getAccount: async () => {
      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()
        const message = {
          type: WALLET_GET_ACCOUNT,
          requestId,
          from : 'injected-helper'
        }
        window.postMessage(message, "*")

        const handleResponse = (event: MessageEvent) => {
          // if (
          //   event.source !== window || 
          //   !event.data || 
          //   event.data.from !== 'injected-helper' || 
          //   event.data.requestId !== requestId) {
          //   return
          // }
          if (!_isValidResponse(event, requestId)) return
          window.removeEventListener('message', handleResponse)

          if (event.data.success) {
            resolve(event.data.data.account)
          } else {
            reject(event.data.error || '获取账户信息失败')
          }
        }
        window.addEventListener('message', handleResponse)
      })
    },
    // 签名信息
    signMessage: async (message: string) => {
      console.log('signMessage:', message);
      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()
        const messageData = {
          type: WALLET_SIGN_MESSAGE,
          data: { message },
          requestId,
          from : 'injected-helper'
        }
        console.log(messageData);
        window.postMessage(messageData, window.location.origin)
        console.log('22');
        const handleResponse = (event: MessageEvent) => {
          console.log(event);
          
          if (!_isValidResponse(event, requestId)) return
          window.removeEventListener('message', handleResponse)

          if (event.data.success) {
            resolve(event.data.data.signedMessage)
          } else {
            reject(event.data.error || '签名失败')
          }
        }
        window.addEventListener('message', handleResponse)
        setTimeout(() => {
          window.removeEventListener('message', handleResponse)
          reject('签名超时')
        }, 30000)
      })
    },
    // 断开连接
    disconnect: async () => {
      return new Promise((resolve, reject) => {
        const requestId = generateRequestId()
        const message = {
          type: WALLET_DISCONNECT,
          requestId,
          from : 'injected-helper'
        }
        window.postMessage(message, "*")

        const handleResponse = (event: MessageEvent) => {
          if (!_isValidResponse(event, requestId)) return
          window.removeEventListener('message', handleResponse)
          resolve(true)
        }
        window.addEventListener('message', handleResponse)
      })
    }
  }
  function _isValidResponse(event: MessageEvent, requestId: string) {
    return event.source === window &&
            event.data &&
            event.data.from === 'message-bridge' &&
            event.data.requestId === requestId
  }

  // RainbowKit 走的是 window.mywallet.request，不是 myWallet.connect
  let selectedAddress: string | null = null
  const listeners: Record<string, Array<(...args: any[]) => void>> = {}
  const emit = (event: string, payload?: unknown) => {
    ;(listeners[event] || []).forEach((handler) => {
      try {
        handler(payload)
      } catch (error) {
        console.error(error)
      }
    })
  }
  const mywallet = {
    isMyWallet: true,
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      switch (method) {
        case 'eth_requestAccounts': {
          const account = await myWallet.connect()
          const address = account?.address
          if (!address) throw toRequestError('连接失败')
          selectedAddress = address
          emit('accountsChanged', [address])
          return [address]
        }
        case 'eth_accounts': {
          if (selectedAddress) return [selectedAddress]
          const data = await sendWalletRequest(WALLET_GET_ACCOUNTS)
          const accounts = data?.accounts || []
          selectedAddress = accounts[0] || null
          return accounts
        }
        case 'eth_chainId': {
          const data = await sendWalletRequest(WALLET_GET_CHAIN_ID)
          return data.chainId
        }
        case 'net_version': {
          const data = await sendWalletRequest(WALLET_GET_CHAIN_ID)
          return String(parseInt(data.chainId, 16))
        }
        case 'wallet_switchEthereumChain': {
          const chainId = params?.[0]?.chainId
          await sendWalletRequest(WALLET_SWITCH_CHAIN, { chainId })
          emit('chainChanged', chainId)
          return null
        }
        case 'eth_sendTransaction': {
          const transaction = params?.[0]
          if (!transaction || typeof transaction !== 'object') {
            throw toRequestError('缺少交易参数')
          }
          const data = await sendWalletRequest(WALLET_SEND_TRANSACTION, {
            ...getPageInfo(),
            transaction
          }, 180000)
          if (!data?.hash) throw toRequestError('交易失败')
          return data.hash
        }
        default:
          throw toRequestError(`不支持的方法: ${method}`)
      }
    },
    on(event: string, handler: (...args: any[]) => void) {
      listeners[event] = listeners[event] || []
      listeners[event].push(handler)
    },
    removeListener(event: string, handler: (...args: any[]) => void) {
      listeners[event] = (listeners[event] || []).filter((item) => item !== handler)
    },
    off(event: string, handler: (...args: any[]) => void) {
      this.removeListener(event, handler)
    },
    enable() {
      return this.request({ method: 'eth_requestAccounts' })
    }
  }

  window.myWallet = myWallet
  window.mywallet = mywallet
  window.myWalletInjected = true
  window.dispatchEvent(new Event('mywallet#initialized'))
  console.log("myWallet 已经注入到页面"); 
}  