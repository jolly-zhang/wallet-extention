import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useWalletStore } from '@/stores/walletStore'
import logoImage from '@/static/logo.png'
import { AES, enc } from 'crypto-js'
import { ethers } from 'ethers'
import { Globe, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SEND_PORT_NAME, WALLET_SEND_TRANSACTION_DECISION, WALLET_SEND_TRANSACTION_GET } from '../../background/type_constant'
import type { PendingTransaction } from '../../background/send-prompt'
import { WalletUnlock } from './WalletUnlock'

type SendDetail = {
  origin: string
  title: string
  favicon: string
  transaction: PendingTransaction
}

function readRequestId() {
  return new URLSearchParams(window.location.search).get('requestId') || ''
}

function displayHost(origin: string) {
  try {
    return new URL(origin).host
  } catch {
    return origin || '未知网站'
  }
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatValue(value?: string) {
  if (!value) return '0 ETH'
  try {
    const amount = BigInt(value)
    if (amount === 0n) return '0 ETH'
    return `${ethers.formatEther(amount)} ETH`
  } catch {
    return value
  }
}

function toBigInt(value?: string) {
  if (value == null || value === '') return undefined
  return BigInt(value)
}

function StatusScreen({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col p-4">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-[rgb(44,46,55)] flex items-center justify-center mb-4">
          <Wallet className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      </div>
      <Button variant="secondary" className="w-full" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  )
}

function SendConfirm({
  requestId,
  detail
}: {
  requestId: string
  detail: SendDetail
}) {
  const { toast } = useToast()
  const { currentAccount, currentNetwork, keyrings, importedAccounts, isValidPassword } = useWalletStore()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showFavicon, setShowFavicon] = useState(Boolean(detail.favicon))
  const tx = detail.transaction
  const host = displayHost(detail.origin)
  const isContractCall = Boolean(tx.data && tx.data !== '0x')
  const requestedChainId = tx.chainId ? Number(BigInt(tx.chainId)) : currentNetwork.chainId
  const chainMismatch = requestedChainId !== currentNetwork.chainId

  const accounts = useMemo(
    () => [
      ...(keyrings ?? []).flatMap((keyring) => keyring.accounts),
      ...(importedAccounts ?? [])
    ],
    [keyrings, importedAccounts]
  )
  const fromAccount = accounts.find((account) => tx.from && account.address.toLowerCase() === tx.from.toLowerCase())
    || (!tx.from ? currentAccount : null)

  const reject = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await chrome.runtime.sendMessage({
        type: WALLET_SEND_TRANSACTION_DECISION,
        requestId,
        approved: false,
        error: '用户拒绝交易'
      })
    } catch {
      // 关闭窗口时后台会按拒绝处理
    }
    window.close()
  }

  const confirm = async () => {
    if (submitting) return
    if (!password) {
      toast({ title: '请输入密码', variant: 'destructive' })
      return
    }
    if (!isValidPassword(password)) {
      toast({ title: '密码错误', description: '请检查您的密码', variant: 'destructive' })
      return
    }
    if (!fromAccount) {
      toast({ title: '找不到付款账户', variant: 'destructive' })
      return
    }
    if (chainMismatch) {
      toast({ title: '交易网络与当前网络不一致', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const cipher = fromAccount.privateKey
      const privateKey = /^0x[0-9a-fA-F]{64}$/.test(cipher)
        ? cipher
        : AES.decrypt(cipher, password).toString(enc.Utf8)
      if (!privateKey) throw new Error('密码错误或私钥无法解密')

      const provider = useWalletStore.getState().getProvider()
      if (!provider) throw new Error('无法连接到网络')

      const wallet = new ethers.Wallet(privateKey, provider)
      const txRequest: ethers.TransactionRequest = {}
      if (tx.to) txRequest.to = tx.to
      const value = toBigInt(tx.value)
      if (value != null) txRequest.value = value
      if (tx.data && tx.data !== '0x') txRequest.data = tx.data
      const gasLimit = toBigInt(tx.gas ?? tx.gasLimit)
      if (gasLimit != null) txRequest.gasLimit = gasLimit
      const maxFeePerGas = toBigInt(tx.maxFeePerGas)
      const maxPriorityFeePerGas = toBigInt(tx.maxPriorityFeePerGas)
      if (maxFeePerGas != null) txRequest.maxFeePerGas = maxFeePerGas
      if (maxPriorityFeePerGas != null) txRequest.maxPriorityFeePerGas = maxPriorityFeePerGas
      if (maxFeePerGas == null) {
        const gasPrice = toBigInt(tx.gasPrice)
        if (gasPrice != null) txRequest.gasPrice = gasPrice
      }
      if (tx.nonce != null && tx.nonce !== '') txRequest.nonce = Number(BigInt(tx.nonce))

      const sent = await wallet.sendTransaction(txRequest)
      const response = await chrome.runtime.sendMessage({
        type: WALLET_SEND_TRANSACTION_DECISION,
        requestId,
        approved: true,
        hash: sent.hash
      })
      if (!response?.ok) {
        toast({
          title: '交易已广播',
          description: response?.error || sent.hash,
          variant: 'destructive'
        })
        setSubmitting(false)
        return
      }
      window.close()
    } catch (error) {
      toast({
        title: '交易失败',
        description: error instanceof Error ? error.message : '发送交易时出现错误',
        variant: 'destructive'
      })
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col p-4">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-[rgb(44,46,55)] rounded-full flex items-center justify-center">
          <img src={logoImage} alt="My Wallet" className="w-9 h-9" />
        </div>
        <div>
          <h1 className="text-lg font-bold bg-wallet-gradient bg-clip-text text-transparent">确认交易</h1>
          <p className="text-xs text-muted-foreground">{isContractCall ? '合约调用' : '转账'}</p>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 flex items-center gap-3">
          {showFavicon ? (
            <img
              src={detail.favicon}
              alt=""
              className="w-9 h-9 rounded-md bg-secondary object-cover"
              onError={() => setShowFavicon(false)}
            />
          ) : (
            <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center">
              <Globe className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium truncate">{detail.title || host}</div>
            <div className="text-xs text-muted-foreground truncate">{detail.origin || '未知来源'}</div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border border-border bg-[rgb(45,46,55)] px-3 py-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">付款账户</span>
          <span className="font-mono truncate">{fromAccount ? formatAddress(fromAccount.address) : '未找到'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">收款地址</span>
          <span className="font-mono truncate">{tx.to ? formatAddress(tx.to) : '创建合约'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">金额</span>
          <span>{formatValue(tx.value)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">网络</span>
          <span className="truncate">{currentNetwork.name}</span>
        </div>
        {isContractCall ? (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">数据</span>
            <span className="font-mono truncate">{tx.data!.slice(0, 18)}...</span>
          </div>
        ) : null}
      </div>

      {chainMismatch ? (
        <p className="text-sm text-destructive mt-3">交易指定的网络和当前钱包网络不一致。</p>
      ) : null}

      <div className="space-y-2 mt-4">
        <Label htmlFor="send-password">密码</Label>
        <Input
          id="send-password"
          type="password"
          value={password}
          placeholder="输入钱包密码以签名"
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') confirm()
          }}
        />
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
        <Button variant="secondary" disabled={submitting} onClick={reject}>
          拒绝
        </Button>
        <Button
          className="bg-wallet-gradient text-[rgb(45,46,55)] hover:opacity-90"
          disabled={submitting || !fromAccount || chainMismatch}
          onClick={confirm}
        >
          {submitting ? '发送中...' : '确认'}
        </Button>
      </div>
    </div>
  )
}

export function SendRequest() {
  const requestId = useMemo(() => readRequestId(), [])
  const { keyrings, importedAccounts, isLocked } = useWalletStore()
  const [ready, setReady] = useState(false)
  const [detail, setDetail] = useState<SendDetail | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const port = chrome.runtime.connect({ name: SEND_PORT_NAME })
    return () => port.disconnect()
  }, [])

  useEffect(() => {
    const unsub = useWalletStore.persist.onFinishHydration(() => setReady(true))
    if (useWalletStore.persist.hasHydrated()) setReady(true)
    const timer = window.setTimeout(() => setReady(true), 3000)
    return () => {
      if (typeof unsub === 'function') unsub()
      window.clearTimeout(timer)
    }
  }, [])

  const hasAccount = (keyrings ?? []).some((keyring) => keyring.accounts.length > 0) || (importedAccounts ?? []).length > 0

  useEffect(() => {
    if (!ready || isLocked || !hasAccount || !requestId) return
    let cancelled = false
    chrome.runtime.sendMessage({
      type: WALLET_SEND_TRANSACTION_GET,
      requestId
    }).then((response) => {
      if (cancelled) return
      if (!response?.ok) {
        setLoadError(response?.error || '交易请求已失效')
        return
      }
      setDetail({
        origin: response.origin || '',
        title: response.title || '',
        favicon: response.favicon || '',
        transaction: response.transaction
      })
    }).catch(() => {
      if (!cancelled) setLoadError('读取交易失败')
    })
    return () => {
      cancelled = true
    }
  }, [ready, isLocked, hasAccount, requestId])

  const rejectAndClose = async (error: string) => {
    if (requestId) {
      try {
        await chrome.runtime.sendMessage({
          type: WALLET_SEND_TRANSACTION_DECISION,
          requestId,
          approved: false,
          error
        })
      } catch {
        // 窗口关闭时后台也会按用户拒绝处理
      }
    }
    window.close()
  }

  if (!requestId) {
    return (
      <StatusScreen
        title="无效的交易请求"
        description="没有找到待确认的交易，请回到网页重新发起。"
        actionLabel="关闭"
        onAction={() => window.close()}
      />
    )
  }

  if (!ready || (hasAccount && !isLocked && !detail && !loadError)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
        正在加载交易...
      </div>
    )
  }

  if (!hasAccount) {
    return (
      <StatusScreen
        title="还没有钱包"
        description="请先打开扩展，创建或导入钱包后再转账。"
        actionLabel="关闭"
        onAction={() => rejectAndClose('请先在插件中导入账户')}
      />
    )
  }

  if (isLocked) {
    return <WalletUnlock description="解锁后将继续确认这笔交易" />
  }

  if (loadError || !detail) {
    return (
      <StatusScreen
        title="无法确认交易"
        description={loadError || '交易请求已失效'}
        actionLabel="关闭"
        onAction={() => rejectAndClose(loadError || '交易请求已失效')}
      />
    )
  }

  return <SendConfirm requestId={requestId} detail={detail} />
}
