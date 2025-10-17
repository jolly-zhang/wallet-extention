// DApp Provider Service - 实现EIP-1102和EIP-747标准
import { ethers } from 'ethers';
import { useWalletStore } from '@/stores/walletStore';

interface DappRequest {
  id: string;
  method: string;
  params: any[];
  origin: string;
}

interface WalletProvider {
  isMyWallet: boolean;
  request: (request: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: Function) => void;
  removeListener: (event: string, handler: Function) => void;
  selectedAddress: string | null;
  chainId: string | null;
  networkVersion: string | null;
}

class MyWalletProvider implements WalletProvider {
  public isMyWallet = true;
  public selectedAddress: string | null = null;
  public chainId: string | null = null;
  public networkVersion: string | null = null;
  
  private eventListeners: Map<string, Function[]> = new Map();
  private connectedAccounts: string[] = [];

  constructor() {
    this.updateWalletState();
  }

  private updateWalletState() {
    const store = useWalletStore.getState();
    if (store.currentAccount && !store.isLocked) {
      this.selectedAddress = store.currentAccount.address;
      this.chainId = `0x${store.currentNetwork.chainId.toString(16)}`;
      this.networkVersion = store.currentNetwork.chainId.toString();
    } else {
      this.selectedAddress = null;
      this.chainId = null;
      this.networkVersion = null;
    }
  }

  async request(request: { method: string; params?: any[] }): Promise<any> {
    const { method, params = [] } = request;

    switch (method) {
      case 'eth_requestAccounts':
        return this.handleRequestAccounts();
      
      case 'eth_accounts':
        return this.connectedAccounts;
      
      case 'eth_chainId':
        this.updateWalletState();
        return this.chainId;
      
      case 'net_version':
        this.updateWalletState();
        return this.networkVersion;
      
      case 'wallet_watchAsset':
        return this.handleWatchAsset(params[0]);
      
      case 'wallet_addEthereumChain':
        return this.handleAddEthereumChain(params[0]);
      
      case 'wallet_switchEthereumChain':
        return this.handleSwitchEthereumChain(params[0]);
      
      case 'eth_sendTransaction':
        return this.handleSendTransaction(params[0]);
      
      case 'eth_sign':
      case 'personal_sign':
        return this.handleSign(method, params);
      
      case 'eth_signTypedData':
      case 'eth_signTypedData_v3':
      case 'eth_signTypedData_v4':
        return this.handleSignTypedData(method, params);
      
      default:
        // 对于其他方法，转发到实际的provider
        const store = useWalletStore.getState();
        const provider = store.getProvider();
        if (provider) {
          return provider.send(method, params);
        }
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  // EIP-1102: eth_requestAccounts
  private async handleRequestAccounts(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const store = useWalletStore.getState();
      
      if (store.isLocked) {
        reject(new Error('Wallet is locked'));
        return;
      }

      if (!store.currentAccount) {
        reject(new Error('No account available'));
        return;
      }

      // 在实际实现中，这里应该显示一个确认对话框让用户批准
      // 目前简化处理，直接返回当前账户
      const account = store.currentAccount.address;
      this.connectedAccounts = [account];
      this.selectedAddress = account;
      
      this.emit('accountsChanged', [account]);
      resolve([account]);
    });
  }

  // EIP-747: wallet_watchAsset
  private async handleWatchAsset(params: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        const { type, options } = params;
        const store = useWalletStore.getState();
        
        if (!['ERC20', 'ERC721', 'ERC1155'].includes(type)) {
          reject(new Error('Unsupported asset type'));
          return;
        }

        // 在实际实现中，这里应该显示一个确认对话框
        // 目前简化处理，直接添加代币
        const token = {
          address: options.address,
          symbol: options.symbol,
          name: options.symbol, // 简化处理
          decimals: options.decimals || 18,
          type: type as 'ERC20' | 'ERC721' | 'ERC1155',
          image: options.image
        };

        store.addToken(token);
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }

  private async handleAddEthereumChain(params: any): Promise<null> {
    return new Promise((resolve, reject) => {
      try {
        const store = useWalletStore.getState();
        const network = {
          id: params.chainName.toLowerCase().replace(/\s+/g, '-'),
          name: params.chainName,
          rpcUrl: params.rpcUrls[0],
          chainId: parseInt(params.chainId, 16),
          symbol: params.nativeCurrency.symbol,
          blockExplorerUrl: params.blockExplorerUrls?.[0]
        };

        store.addNetwork(network);
        resolve(null);
      } catch (error) {
        reject(error);
      }
    });
  }

  private async handleSwitchEthereumChain(params: any): Promise<null> {
    return new Promise((resolve, reject) => {
      try {
        const store = useWalletStore.getState();
        const chainId = parseInt(params.chainId, 16);
        const network = store.networks.find(net => net.chainId === chainId);
        
        if (!network) {
          reject(new Error('Network not found'));
          return;
        }

        store.switchNetwork(network.id);
        this.emit('chainChanged', params.chainId);
        resolve(null);
      } catch (error) {
        reject(error);
      }
    });
  }

  private async handleSendTransaction(params: any): Promise<string> {
    // 在实际实现中，这里应该打开发送交易的界面
    // 目前返回模拟的交易哈希
    throw new Error('Please use the wallet interface to send transactions');
  }

  private async handleSign(method: string, params: any[]): Promise<string> {
    // 在实际实现中，这里应该打开签名确认界面
    throw new Error('Signing not implemented');
  }

  private async handleSignTypedData(method: string, params: any[]): Promise<string> {
    // 在实际实现中，这里应该打开签名确认界面
    throw new Error('Typed data signing not implemented');
  }

  on(event: string, handler: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  }

  removeListener(event: string, handler: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(handler);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }
}

// 创建provider实例
export const myWalletProvider = new MyWalletProvider();

// 注入到window对象 (模拟content script)
export const injectProvider = () => {
  if (typeof window !== 'undefined') {
    // 注入到window.ethereum (兼容MetaMask)
    (window as any).ethereum = myWalletProvider;
    
    // 注入到window.mywallet
    (window as any).mywallet = myWalletProvider;

    // 触发ethereum注入事件
    window.dispatchEvent(new Event('ethereum#initialized'));
  }
};

// 在应用启动时自动注入
if (typeof window !== 'undefined') {
  injectProvider();
}