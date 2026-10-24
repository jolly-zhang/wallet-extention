import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWalletStore } from '@/stores/walletStore';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useToast } from '@/hooks/use-toast';
import { ethers } from 'ethers';
import { Send, AlertTriangle, CheckCircle } from 'lucide-react';
import { AES, enc } from 'crypto-js';

interface SendForm {
  to: string;
  amount: string;
  tokenAddress?: string;
  tokenId?: string;
  gasLimit?: string;
  gasPrice?: string;
}
//
export const SendTransaction = () => {
  const [form, setForm] = useState<SendForm>({
    to: '',
    amount: '',
    tokenAddress: '',
    tokenId: '',
    gasLimit: '21000',
    gasPrice: '20'
  });
  const [selectedAsset, setSelectedAsset] = useState<'ETH' | 'TOKEN'>('ETH');
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { 
    currentAccount, 
    currentNetwork,
    networks,
    keyrings,
    importedAccounts,
    tokens, 
    getProvider, 
    isValidPassword,
    switchNetwork
  } = useWalletStore();
  const { ethBalance } = useWalletBalance();
  const { toast } = useToast();

  const selectedToken = tokens.find(token => token.address === form.tokenAddress);
  const ownAccounts = [
    ...(keyrings ?? []).flatMap(keyring => keyring.accounts),
    ...(importedAccounts ?? [])
  ].filter(account => account.address !== currentAccount?.address);
  const ownAccountSelected = ownAccounts.some(account => account.address === form.to) ? form.to : undefined;
  // 解密私钥
  const resolvePrivateKey = (plainPassword: string) => {
    const stored = [
      ...(keyrings ?? []).flatMap(keyring => keyring.accounts),
      ...(importedAccounts ?? [])
    ].find(account => account.address === currentAccount?.address);
    const cipher = stored?.privateKey || currentAccount?.privateKey || '';
    if (/^0x[0-9a-fA-F]{64}$/.test(cipher)) {
      return cipher;
    }
    // 解密私钥
    const privateKey = AES.decrypt(cipher, plainPassword).toString(enc.Utf8);
    if (!privateKey) {
      throw new Error('密码错误或私钥无法解密');
    }
    return privateKey;
  };
  // 填充最大金额
  const fillMaxAmount = async () => {
    if (!currentAccount) return;
    const provider = getProvider();
    if (!provider) return;
    try {
      const balance = await provider.getBalance(currentAccount.address);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
      const fee = 21000n * gasPrice;
      const maxValue = balance > fee ? balance - fee : 0n;
      setForm(current => ({ ...current, amount: ethers.formatEther(maxValue) }));
    } catch (error) {
      console.error('Failed to calculate max amount:', error);
      setForm(current => ({ ...current, amount: ethBalance }));
    }
  };
  // 转账页面表单验证
  const validateForm = () => {
    if (!ethers.isAddress(form.to)) {
      toast({
        title: "无效的接收地址",
        variant: "destructive"
      });
      return false;
    }

    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast({
        title: "请输入有效金额",
        variant: "destructive"
      });
      return false;
    }

    // 如果选择的是ETH，则判断余额是否足够
    if (selectedAsset === 'ETH') {
      if (parseFloat(form.amount) > parseFloat(ethBalance)) {
        toast({
          title: "余额不足",
          description: "ETH余额不足",
          variant: "destructive"
        });
        return false;
      }
    } else if (selectedToken) { // 如果选择的是代币，则判断代币余额是否足够
      const tokenBalance = parseFloat(selectedToken.balance || '0');
      if (selectedToken.type === 'ERC20' && parseFloat(form.amount) > tokenBalance) { // 如果选择的是ERC20代币，则判断代币余额是否足够
        toast({
          title: "余额不足",
          description: `${selectedToken.symbol}余额不足`,
          variant: "destructive"
        });
        return false;
      }
    }

    return true;
  };
  // 发送交易转账按钮点击事件
  const handleSend = async () => {
    if (!validateForm()) return;
    setIsConfirmDialogOpen(true);
  };
  // 确认执行交易转账事件
  const executeTransaction = async () => {
    if (!password) {
      toast({
        title: "请输入密码",
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
    // 如果当前账户不存在，则返回
    if (!currentAccount) return;
    // 设置发送中状态
    setIsSending(true);
    try {
      const provider = getProvider();
      if (!provider) {
        throw new Error('无法连接到网络');
      }
      // 解密私钥
      const decryptedPrivateKey = resolvePrivateKey(password);
      // 创建钱包实例
      const wallet = new ethers.Wallet(decryptedPrivateKey, provider);
      // 获取手续费数据
      const feeData = await provider.getFeeData();
      // 设置手续费字段
      const feeFields: ethers.TransactionRequest = {};
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        feeFields.maxFeePerGas = feeData.maxFeePerGas;
        feeFields.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
      } else if (feeData.gasPrice) {
        feeFields.gasPrice = feeData.gasPrice;
      }

      let tx;

      if (selectedAsset === 'ETH') {
        // 创建交易请求
        const txRequest: ethers.TransactionRequest = {
          to: form.to,
          value: ethers.parseEther(form.amount),
          ...feeFields
        };
        // 估算手续费
        txRequest.gasLimit = await wallet.estimateGas(txRequest);
        // 发送交易
        tx = await wallet.sendTransaction(txRequest);
      } else if (selectedToken) {
        if (selectedToken.type === 'ERC20') {
          // 发送ERC20代币
          const erc20Abi = [
            'function transfer(address to, uint256 amount) returns (bool)'
          ];
          const contract = new ethers.Contract(selectedToken.address, erc20Abi, wallet);
          const amount = ethers.parseUnits(form.amount, selectedToken.decimals);
          
          tx = await contract.transfer(form.to, amount, feeFields);
        } else if (selectedToken.type === 'ERC721') {
          // 发送NFT
          if (!form.tokenId) {
            throw new Error('请输入Token ID');
          }
          
          const erc721Abi = [
            'function safeTransferFrom(address from, address to, uint256 tokenId)'
          ];
          const contract = new ethers.Contract(selectedToken.address, erc721Abi, wallet);
          
          tx = await contract.safeTransferFrom(
            currentAccount.address,
            form.to,
            form.tokenId,
            feeFields
          );
        }
      }

      if (tx) {
        setTxHash(tx.hash);
        toast({
          title: "交易已发送",
          description: `交易哈希: ${tx.hash}`
        });

        // 等待交易确认
        await tx.wait();
        
        toast({
          title: "交易成功！",
          description: "交易已被确认"
        });
      }

    } catch (error: any) {
      console.error('Transaction error:', error);
      toast({
        title: "交易失败",
        description: error.message || "发送交易时出现错误",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
      setIsConfirmDialogOpen(false);
      setPassword('');
    }
  };

  const resetForm = () => {
    setForm({
      to: '',
      amount: '',
      tokenAddress: '',
      tokenId: '',
      gasLimit: '21000',
      gasPrice: '20'
    });
    setSelectedAsset('ETH');
    setTxHash(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">发送交易</h2>
        {txHash && (
          <Button variant="outline" size="sm" onClick={resetForm}>
            新建交易
          </Button>
        )}
      </div>

      {txHash ? (
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-medium mb-2">交易已发送</h3>
            <p className="text-muted-foreground mb-4">
              您的交易正在被处理中
            </p>
            <div className="bg-muted p-3 rounded-lg font-mono text-sm break-all">
              {txHash}
            </div>
            {currentNetwork.blockExplorerUrl && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => window.open(`${currentNetwork.blockExplorerUrl}/tx/${txHash}`, '_blank')}
              >
                在区块浏览器中查看
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              发送 {selectedAsset === 'ETH' ? currentNetwork.symbol : selectedToken?.symbol}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>当前网络</Label>
              <Select value={currentNetwork.id} onValueChange={switchNetwork}>
                <SelectTrigger>
                  <SelectValue placeholder="选择网络" />
                </SelectTrigger>
                <SelectContent>
                  {networks.map(network => (
                    <SelectItem key={network.id} value={network.id}>
                      {network.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* 资产选择 */}
            <div className="space-y-2">
              <Label>选择资产</Label>
              <div className="flex gap-2">
                <Button
                  variant={selectedAsset === 'ETH' ? 'default' : 'outline'}
                  onClick={() => setSelectedAsset('ETH')}
                  className="flex-1"
                >
                  {currentNetwork.symbol}
                </Button>
                {tokens.length > 0 && (
                  <Select
                    value={selectedAsset === 'TOKEN' ? form.tokenAddress : ''}
                    onValueChange={(value) => {
                      setSelectedAsset('TOKEN');
                      setForm({ ...form, tokenAddress: value });
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="选择代币" />
                    </SelectTrigger>
                    <SelectContent>
                      {tokens.map((token) => (
                        <SelectItem key={token.address} value={token.address}>
                          {token.symbol} ({token.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {ownAccounts.length > 0 && (
              <div className="space-y-2">
                <Label>转到我的账户</Label>
                <Select
                  value={ownAccountSelected}
                  onValueChange={(address) => setForm({ ...form, to: address })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择钱包内账户" />
                  </SelectTrigger>
                  <SelectContent>
                    {ownAccounts.map(account => (
                      <SelectItem key={account.address} value={account.address}>
                        {account.name} ({account.address.slice(0, 6)}...{account.address.slice(-4)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 接收地址 */}
            <div className="space-y-2">
              <Label htmlFor="to">接收地址</Label>
              <Input
                id="to"
                value={form.to}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
                placeholder="0x..."
              />
            </div>

            {/* 金额 */}
            <div className="space-y-2">
              <Label htmlFor="amount">
                {selectedToken?.type === 'ERC721' ? 'Token ID' : '金额'}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  value={selectedToken?.type === 'ERC721' ? form.tokenId : form.amount}
                  onChange={(e) => {
                    if (selectedToken?.type === 'ERC721') {
                      setForm({ ...form, tokenId: e.target.value });
                    } else {
                      setForm({ ...form, amount: e.target.value });
                    }
                  }}
                  placeholder={selectedToken?.type === 'ERC721' ? '输入Token ID' : '0.0'}
                  type={selectedToken?.type === 'ERC721' ? 'text' : 'number'}
                  step="any"
                />
                {selectedAsset === 'ETH' ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={fillMaxAmount}
                  >
                    全部
                  </Button>
                ) : selectedToken && selectedToken.type === 'ERC20' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm({ ...form, amount: selectedToken.balance || '0' })}
                  >
                    全部
                  </Button>
                )}
              </div>
              {selectedAsset === 'ETH' && (
                <p className="text-sm text-muted-foreground">
                  余额: {parseFloat(ethBalance).toFixed(4)} {currentNetwork.symbol}
                </p>
              )}
              {selectedToken && (
                <p className="text-sm text-muted-foreground">
                  余额: {selectedToken.balance || '0'} {selectedToken.symbol}
                </p>
              )}
            </div>

            <Button 
              onClick={handleSend} 
              className="w-full bg-wallet-gradient hover:opacity-90"
              disabled={!form.to || (!form.amount && !form.tokenId)}
            >
              <Send className="w-4 h-4 mr-2" />
              发送交易
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 确认对话框 */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              确认交易
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-[rgb(45,46,55)] p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">从:</span>
                <span className="font-mono text-sm">
                  {currentAccount?.address.slice(0, 6)}...{currentAccount?.address.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">到:</span>
                <span className="font-mono text-sm">
                  {form.to.slice(0, 6)}...{form.to.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">金额:</span>
                <span className="font-medium">
                  {selectedToken?.type === 'ERC721' 
                    ? `Token #${form.tokenId}`
                    : `${form.amount} ${selectedAsset === 'ETH' ? currentNetwork.symbol : selectedToken?.symbol}`
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">手续费:</span>
                <span>按当前网络自动估算</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入钱包密码"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsConfirmDialogOpen(false);
                  setPassword('');
                }}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                onClick={executeTransaction}
                disabled={isSending || !password}
                className="flex-1"
              >
                {isSending ? "发送中..." : "确认发送"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};