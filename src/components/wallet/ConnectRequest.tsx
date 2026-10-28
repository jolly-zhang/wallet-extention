import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useWalletStore } from '@/stores/walletStore'
import logoImage from '@/static/logo.png'
import type { WalletAccount } from '@/types/wallet'
import { Globe, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CONNECT_PORT_NAME, WALLET_CONNECT_DECISION } from '../../background/type_constant'
import { WalletUnlock } from './WalletUnlock'

function readConnectParams() {
  const params = new URLSearchParams(window.location.search)
  return {
    requestId: params.get('requestId') || '',
    origin: params.get('origin') || '',
    title: params.get('title') || '',
    favicon: params.get('favicon') || ''
  }
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

function ConnectConfirm({
  requestId,
  origin,
  title,
  favicon,
  accounts,
  currentAccountAddress,
  networkName
}: {
  requestId: string
  origin: string
  title: string
  favicon: string
  accounts: WalletAccount[]
  currentAccountAddress?: string
  networkName: string
}) {
  const { toast } = useToast()
  const [selectedAddress, setSelectedAddress] = useState(currentAccountAddress || accounts[0]?.address || '')
  const [submitting, setSubmitting] = useState(false)
  const [showFavicon, setShowFavicon] = useState(Boolean(favicon))
  const host = displayHost(origin)
  const selectedAccount = accounts.find((account) => account.address === selectedAddress) || accounts[0]

  const respond = async (approved: boolean) => {
    if (submitting) return
    if (approved && !selectedAccount) {
      toast({ title: '请选择账户', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      if (approved && selectedAccount) {
        useWalletStore.setState({
          currentAccount: selectedAccount,
          isConnected: true
        })
      }

      const response = await chrome.runtime.sendMessage({
        type: WALLET_CONNECT_DECISION,
        requestId,
        approved,
        address: approved ? selectedAccount?.address : undefined,
        error: approved ? undefined : '用户拒绝连接'
      })

      if (!response?.ok) {
        toast({
          title: '操作失败',
          description: response?.error || '请重试',
          variant: 'destructive'
        })
        setSubmitting(false)
        return
      }
      window.close()
    } catch (error) {
      toast({
        title: '操作失败',
        description: error instanceof Error ? error.message : '请重试',
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
          <h1 className="text-lg font-bold bg-wallet-gradient bg-clip-text text-transparent">确认连接</h1>
          <p className="text-xs text-muted-foreground">确认后才会把地址交给该网站</p>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 flex items-center gap-3">
          {showFavicon ? (
            <img
              src={favicon}
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
            <div className="font-medium truncate">{title || host}</div>
            <div className="text-xs text-muted-foreground truncate">{origin || '未知来源'}</div>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground mb-4">
        该网站请求连接你的钱包，并查看你选择的账户地址。签名和交易仍需要再次确认。
      </p>

      <div className="space-y-2">
        <Label>连接账户</Label>
        {accounts.length > 1 ? (
          <Select value={selectedAccount?.address} onValueChange={setSelectedAddress}>
            <SelectTrigger>
              <SelectValue placeholder="选择账户" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.address} value={account.address}>
                  {account.name} · {formatAddress(account.address)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {selectedAccount ? (
          <div className="rounded-md border border-border bg-[rgb(45,46,55)] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{selectedAccount.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{formatAddress(selectedAccount.address)}</div>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">{networkName}</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
        <Button variant="secondary" disabled={submitting} onClick={() => respond(false)}>
          拒绝
        </Button>
        <Button
          className="bg-wallet-gradient text-[rgb(45,46,55)] hover:opacity-90"
          disabled={submitting || !selectedAccount}
          onClick={() => respond(true)}
        >
          {submitting ? '连接中...' : '确认连接'}
        </Button>
      </div>
    </div>
  )
}

export function ConnectRequest() {
  const { requestId, origin, title, favicon } = useMemo(() => readConnectParams(), [])
  const { keyrings, importedAccounts, isLocked, currentAccount, currentNetwork } = useWalletStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const port = chrome.runtime.connect({ name: CONNECT_PORT_NAME })
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

  const accounts = useMemo(
    () => [
      ...(keyrings ?? []).flatMap((keyring) => keyring.accounts),
      ...(importedAccounts ?? [])
    ],
    [keyrings, importedAccounts]
  )
  const hasAccount = accounts.length > 0

  const rejectAndClose = async (error: string) => {
    if (requestId) {
      try {
        await chrome.runtime.sendMessage({
          type: WALLET_CONNECT_DECISION,
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
        title="无效的连接请求"
        description="没有找到待确认的连接，请回到网页重新发起。"
        actionLabel="关闭"
        onAction={() => window.close()}
      />
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
        正在加载钱包...
      </div>
    )
  }

  if (!hasAccount) {
    return (
      <StatusScreen
        title="还没有钱包"
        description="请先打开扩展，创建或导入钱包后再连接。"
        actionLabel="关闭"
        onAction={() => rejectAndClose('请先在插件中导入账户')}
      />
    )
  }

  if (isLocked) {
    return <WalletUnlock description="解锁后将继续确认网站连接" />
  }

  return (
    <ConnectConfirm
      requestId={requestId}
      origin={origin}
      title={title}
      favicon={favicon}
      accounts={accounts}
      currentAccountAddress={currentAccount?.address}
      networkName={currentNetwork?.name || ''}
    />
  )
}
