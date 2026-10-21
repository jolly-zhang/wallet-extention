import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useWalletStore } from '@/stores/walletStore';
import { type WalletAccount } from '@/types/wallet';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Edit, Check, X, UserPlus, Key, Copy, Import, Eye } from 'lucide-react';
import { AES, enc } from 'crypto-js';

export const AccountManager = () => {
  const [createKeyringId, setCreateKeyringId] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportMnemonicOpen, setIsImportMnemonicOpen] = useState(false);
  const [importMnemonic, setImportMnemonic] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [importAccountName, setImportAccountName] = useState('');
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [password, setPassword] = useState('');
  const [exportAddress, setExportAddress] = useState<string | null>(null);
  const [exportPrivateKey, setExportPrivateKey] = useState('');
  const [exportPassword, setExportPassword] = useState('');
  const [exportedKey, setExportedKey] = useState('');
  const [exportMnemonicAccount, setExportMnemonicAccount] = useState<WalletAccount | null>(null);
  const [mnemonicPassword, setMnemonicPassword] = useState('');
  const [exportedMnemonic, setExportedMnemonic] = useState('');

  const {
    keyrings,
    currentAccount,
    importedAccounts,
    createAccount,
    switchAccount,
    updateAccountName,
    importPrivateKey,
    importWallet,
    exportMnemonic,
    isValidPassword
  } = useWalletStore();
  const { toast } = useToast();
  // 创建账户
  const handleCreateAccount = async (keyringId: string) => {
    if (!password) {
      toast({
        title: "请输入密码",
        description: "需要密码验证以创建新账户",
        variant: "destructive"
      });
      return;
    }

    if (!isValidPassword(password)) {
      toast({
        title: "密码错误",
        description: "请检查您的密码",
        variant: "destructive"
      });
      return;
    }

    try {
      await createAccount(keyringId, newAccountName || undefined, password);
      setCreateKeyringId(null);
      setNewAccountName('');
      setPassword('');
      toast({
        title: "账户创建成功！"
      });
    } catch (error) {
      toast({
        title: "创建失败",
        description: "无法创建新账户",
        variant: "destructive"
      });
    }
  };
  // 导入账户
  const handleImportAccount = async () => {
    if (!password) {
      toast({
        title: "请输入密码",
        description: "需要密码验证以导入账户",
        variant: "destructive"
      });
      return;
    }

    if (!isValidPassword(password)) {
      toast({
        title: "密码错误",
        description: "请检查您的密码",
        variant: "destructive"
      });
      return;
    }

    if (!privateKey.trim()) {
      toast({
        title: "请输入私钥",
        variant: "destructive"
      });
      return;
    }

    try {
      await importPrivateKey(privateKey.trim(), password, importAccountName || undefined);
      setIsImportDialogOpen(false);
      setPrivateKey('');
      setImportAccountName('');
      setPassword('');
      toast({
        title: "账户导入成功！"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败";
      toast({
        title: "导入失败",
        description: message,
        variant: "destructive"
      });
    }
  };
  //导入助记词
  const handleImportMnemonic = async () => {
    if (!importMnemonic.trim()) {
      toast({
        title: "请输入助记词",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "密码太短",
        description: "密码长度至少需要8位",
        variant: "destructive"
      });
      return;
    }

    try {
      await importWallet(importMnemonic.trim(), password);
      setIsImportMnemonicOpen(false);
      setImportMnemonic('');
      setPassword('');
      toast({
        title: "助记词导入成功！"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败";
      toast({
        title: "导入失败",
        description: message,
        variant: "destructive"
      });
    }
  };

  // 编辑账户名称
  const handleEditName = (address: string, currentName: string) => {
    setEditingAccount(address);
    setEditName(currentName);
  };

  // 保存编辑账户名称
  const handleSaveEdit = (address: string) => {
    if (editName.trim()) {
      updateAccountName(address, editName.trim());
      toast({
        title: "账户名称已更新"
      });
    }
    setEditingAccount(null);
    setEditName('');
  };

  // 取消编辑账户名称
  const handleCancelEdit = () => {
    setEditingAccount(null);
    setEditName('');
  };

  const resetExport = () => {
    setExportAddress(null);
    setExportPassword('');
    setExportedKey('');
  };
  // 导出私钥
  const handleExportPrivateKey = async () => {
    if (!exportAddress) {
      return;
    }
    if (!exportPassword) {
      toast({
        title: "请输入密码",
        description: "需要密码验证以导出私钥",
        variant: "destructive"
      });
      return;
    }
    if (!isValidPassword(exportPassword)) {
      toast({
        title: "密码错误",
        description: "请检查您的密码",
        variant: "destructive"
      });
      return;
    }

    try {
      // const key = exportPrivateKey(exportAddress, exportPassword);
      const key = /^0x[0-9a-fA-F]{64}$/.test(exportPrivateKey)
        ? exportPrivateKey
        : AES.decrypt(exportPrivateKey, exportPassword).toString(enc.Utf8);
      if (!key) {
        throw new Error('密码错误或私钥无法解密');
      }
      setExportedKey(key);
      await navigator.clipboard.writeText(key);
      toast({
        title: "私钥已复制",
        description: "请妥善保管，不要泄露给他人"
      });
    } catch {
      toast({
        title: "导出失败",
        description: "密码错误或私钥无法解密",
        variant: "destructive"
      });
    }
  };
  const resetMnemonicExport = () => {
    setExportMnemonicAccount(null);
    setMnemonicPassword('');
    setExportedMnemonic('');
  };

  const handleExportMnemonic = () => {
    if (!exportMnemonicAccount) {
      return;
    }
    if (!mnemonicPassword) {
      toast({
        title: "请输入密码",
        description: "需要密码验证以导出助记词",
        variant: "destructive"
      });
      return;
    }
    if (!isValidPassword(mnemonicPassword)) {
      toast({
        title: "密码错误",
        description: "请检查您的密码",
        variant: "destructive"
      });
      return;
    }

    try {
      const mnemonic = exportMnemonic(exportMnemonicAccount, mnemonicPassword);
      setExportedMnemonic(mnemonic);
      toast({
        title: "助记词已导出",
        description: "请妥善保管，不要泄露给他人"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "密码错误或助记词无法解密";
      toast({
        title: "导出失败",
        description: message,
        variant: "destructive"
      });
    }
  };

  const copyExportedMnemonic = async () => {
    if (!exportedMnemonic) {
      return;
    }
    await navigator.clipboard.writeText(exportedMnemonic);
    toast({
      title: "助记词已复制"
    });
  };

  //复制私钥
  const copyExportedKey = async () => {
    if (!exportedKey) {
      return;
    }
    await navigator.clipboard.writeText(exportedKey);
    toast({
      title: "私钥已复制"
    });
  };

  // 格式化地址
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const primaryKeyrings = (keyrings ?? []).filter(keyring => keyring.isPrimary);
  const importedKeyrings = (keyrings ?? []).filter(keyring => !keyring.isPrimary);
  const privateKeyAccounts = importedAccounts ?? [];
  // 渲染账户列表
  const renderAccount = (account: WalletAccount) => (
    <Card
      key={account.address}
      className={`cursor-pointer transition-all ${currentAccount?.address === account.address
        ? 'ring-2 ring-primary bg-card'
        : 'hover:bg-muted/50'
        }`}
      onClick={() => switchAccount(account.address)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {editingAccount === account.address ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveEdit(account.address);
                  }}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit();
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div>
                  <div className="font-medium">{account.name}</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {formatAddress(account.address)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditName(account.address, account.name);
                  }}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="导出私钥"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExportAddress(account.address);
                    setExportPrivateKey(account.privateKey);
                    setExportPassword('');
                    setExportedKey('');
                  }}
                >
                  <Key className="w-4 h-4" />
                </Button>

                {account.type === 'Imported_PrivateKey' ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" disabled title="导出助记词">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>此账户通过私钥导入，不支持导出助记词</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    title="导出助记词"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExportMnemonicAccount(account);
                      setMnemonicPassword('');
                      setExportedMnemonic('');
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
          {currentAccount?.address === account.address && (
            <span className="ml-4 text-xs bg-[rgb(184,247,3)] text-[rgb(45,46,55)] px-2 py-1 rounded">
              当前账户
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">账户管理</h2>
        <div className="flex flex-wrap justify-end gap-2">

          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Key className="w-4 h-4 mr-2" />
                导入私钥
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>导入私钥</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="privateKey">私钥</Label>
                  <Input
                    id="privateKey"
                    type="password"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="输入私钥"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="importAccountName">账户名称 (可选)</Label>
                  <Input
                    id="importAccountName"
                    value={importAccountName}
                    onChange={(e) => setImportAccountName(e.target.value)}
                    placeholder="输入账户名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="importPassword">确认密码</Label>
                  <Input
                    id="importPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入钱包密码"
                  />
                </div>
                <Button onClick={handleImportAccount} className="w-full">
                  <Key className="w-4 h-4 mr-2" />
                  导入账户
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isImportMnemonicOpen} onOpenChange={setIsImportMnemonicOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Import className="w-4 h-4 mr-2" />
                导入助记词
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>导入助记词</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="importMnemonic">助记词</Label>
                  <Textarea
                    id="importMnemonic"
                    value={importMnemonic}
                    onChange={(e) => setImportMnemonic(e.target.value)}
                    placeholder="输入12或24个助记词，用空格分隔"
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mnemonicPassword">设置密码</Label>
                  <Input
                    id="mnemonicPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入密码 (至少8位)"
                  />
                </div>
                <Button onClick={handleImportMnemonic} className="w-full">
                  <Import className="w-4 h-4 mr-2" />
                  导入钱包
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-6">
        {primaryKeyrings.map(keyring => (
          <section key={keyring.id} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              {keyring.name}
            </h3>

            {/* 我的钱包列表 */}
            {keyring.accounts.map(renderAccount)}
            <Button size="sm" variant="outline" onClick={() => setCreateKeyringId(keyring.id)} className="text-[#b8f703]">
              <Plus className="w-4 h-4 mr-2" />
              创建我的钱包账户
            </Button>
          </section>
        ))}

        {importedKeyrings.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">导入的钱包</h3>
            {importedKeyrings.map(keyring => (
              <div key={keyring.id} className="space-y-2">
                <div className="text-xs text-muted-foreground">{keyring.name}</div>
                {/* 导入的钱包列表 */}
                {keyring.accounts.map(renderAccount)}
                <Button size="sm" variant="outline" onClick={() => setCreateKeyringId(keyring.id)}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建账户
                </Button>
              </div>
            ))}
          </section>
        )}

        {privateKeyAccounts.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">通过私钥导入的账户</h3>
            {privateKeyAccounts.map(renderAccount)}
          </section>
        )}
      </div>

      <Dialog
        open={createKeyringId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateKeyringId(null);
            setNewAccountName('');
            setPassword('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新账户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountName">账户名称 (可选)</Label>
              <Input
                id="accountName"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="输入账户名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">确认密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入钱包密码"
              />
            </div>
            <Button
              onClick={() => createKeyringId && handleCreateAccount(createKeyringId)}
              className="w-full"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              确定
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exportMnemonicAccount !== null} onOpenChange={(open) => { if (!open) resetMnemonicExport(); }}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>导出助记词</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground font-mono">
              {exportMnemonicAccount ? formatAddress(exportMnemonicAccount.address) : ''}
            </div>
            {!exportedMnemonic ? (
              <div className="space-y-2">
                <Label htmlFor="mnemonicExportPassword">确认密码</Label>
                <Input
                  id="mnemonicExportPassword"
                  type="password"
                  value={mnemonicPassword}
                  onChange={(e) => setMnemonicPassword(e.target.value)}
                  placeholder="输入钱包密码"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => resetMnemonicExport()}>
                    <X className="w-4 h-4 mr-2" />
                    取消
                  </Button>
                  <Button onClick={handleExportMnemonic} className="flex-1">
                    确认
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>助记词</Label>
                <div className="break-all rounded-md border p-3 text-sm">
                  {exportedMnemonic}
                </div>
                <Button variant="outline" onClick={copyExportedMnemonic}>
                  <Copy className="w-4 h-4 mr-2" />
                  复制
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 导出私钥弹框 */}
      <Dialog open={exportAddress !== null} onOpenChange={(open) => { if (!open) resetExport(); }}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>导出私钥</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground font-mono">
              {exportAddress ? formatAddress(exportAddress) : ''}
            </div>
            {!exportedKey ?
              <div className="space-y-2">
                <Label htmlFor="exportPassword">确认密码</Label>
                <Input
                  id="exportPassword"
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="输入钱包密码"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => resetExport()}>
                    <X className="w-4 h-4 mr-2" />
                    取消
                  </Button>
                  <Button onClick={handleExportPrivateKey} className="flex-1">
                    确认
                  </Button>
                </div>
              </div> :
              <div className="space-y-2">
                <Label>私钥</Label>
                <div className="break-all rounded-md border p-3 font-mono text-xs">
                  {exportedKey}
                </div>
                <Button variant="outline" onClick={copyExportedKey}>
                  <Copy className="w-4 h-4 mr-2" />
                  复制
                </Button>
              </div>
            }
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};