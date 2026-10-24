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
  isMyWallet: boolean;//标识是哪个钱包
  request: (request: { method: string; params?: any[] }) => Promise<any>;// 核心通信方法,DApp 向钱包发指令的唯一入口
  on: (event: string, handler: Function) => void;// 事件监听器
  removeListener: (event: string, handler: Function) => void;// 移除事件监听器
  selectedAddress: string | null;// 当前选中的地址
  chainId: string | null;// 当前链ID
  networkVersion: string | null;// 当前网络版本
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

  /**
   * 更新钱包状态
   * 告诉 DApp 当前钱包所在链
   * 例如 0x1 表示以太坊主网，0x89 表示 Polygon 等
   */
  private updateWalletState() {
    const store = useWalletStore.getState();
    // 如果没锁定且有当前账户，把地址和链 ID 赋给 Provider
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
      case 'eth_requestAccounts':// 请求账户列表
        return this.handleRequestAccounts();
      
      case 'eth_accounts':// 获取账户列表
        return this.connectedAccounts;
      
      case 'eth_chainId':// 获取链ID
        this.updateWalletState();
        return this.chainId;
      
      case 'net_version':// 获取网络版本
        this.updateWalletState();
        return this.networkVersion;
      
      case 'wallet_watchAsset':// 添加代币,用户在 Uniswap 上点“添加代币到钱包”时,代币信息写进你的钱包列表里
        return this.handleWatchAsset(params[0]);
      
      case 'wallet_addEthereumChain':// 添加链
        return this.handleAddEthereumChain(params[0]);
      
      case 'wallet_switchEthereumChain':// 切换链
        return this.handleSwitchEthereumChain(params[0]);
      
      case 'eth_sendTransaction':// 发送交易
        return this.handleSendTransaction(params[0]);
      
      case 'eth_sign':
      case 'personal_sign':// 签名
        return this.handleSign(method, params);
      
      case 'eth_signTypedData':// 签名数据
      case 'eth_signTypedData_v3':// 签名数据
      case 'eth_signTypedData_v4':
        return this.handleSignTypedData(method, params);// 签名数据
      
      default:
        // 对于其他方法，转发到实际的provider,比如MetaMask    
        const store = useWalletStore.getState();
        const provider = store.getProvider();// 获取实际的provider,比如MetaMask
        if (provider) {
          return provider.send(method, params);// 转发到实际的provider,比如MetaMask
        }
        throw new Error(`Unsupported method: ${method}`);// 不支持的方法
    }
  }

  // EIP-1102: eth_requestAccounts
  /**
   * 
    DApp 请求“连接钱包”
    如果钱包未锁定且有当前账户，就返回当前地址
    并把它放进 connectedAccounts
    触发 accountsChanged 事件
   */
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
      this.connectedAccounts = [account];// 把当前账户放进 connectedAccounts
      this.selectedAddress = account;// 更新当前选中的地址
      
      this.emit('accountsChanged', [account]);// 触发账户变化事件
      resolve([account]);
    });
  }

  // EIP-747: wallet_watchAsset
  /**
   * 添加代币
   * 允许 DApp 请求“添加某个 ERC20 / ERC721 / ERC1155 资产到钱包”
   * 例如某个网站想让用户把代币显示在钱包里
   * 代码会读取参数 type 和 options，然后调用：store.addToken(token);
   */
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

  /**
   * 添加链
   * 允许 DApp 请求“添加某个链到钱包”
   * 例如某个网站想让用户把链显示在钱包里
   * 会把网络信息提取出来，再调用：store.addNetwork(network);
   */
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
/**
   * 切换链
   * 允许 DApp 请求“切换钱包的链”
   * 例如某个网站想让用户把链切换到某个链
   * 会把网络信息提取出来，再调用：store.switchNetwork(network.id);
   */
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
/**
   * 发送交易
   * 允许 DApp 请求“发送交易”
   * 例如某个网站想让用户发送交易
   * 会把交易参数提取出来，再调用：store.sendTransaction(transaction);
   */
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
  /**
   * 监听事件
   * 允许 DApp 监听某个事件
   * 例如某个网站想监听某个事件
   * 会把事件名称提取出来，再调用：store.on(event, handler);
   */
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
// 把钱包 provider 挂载到页面全局对象，DApp 就能直接访问window.ethereum.request(...)
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