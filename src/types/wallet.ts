//钱包账户
export interface WalletAccount {
  address: string;
  privateKey: string;//私钥
  name: string;//账户名称
  index: number;//账户索引
  type: 'HD' | 'Imported_PrivateKey'; //账户类型
  keyringId?: string;//密钥环ID，HD:主密钥环 ID；Imported_PrivateKey:独立私钥账户 ID
}

export interface Keyring {
  id: string;//密钥环ID
  name: string;//密钥环名称
  encryptedMnemonic: string;//加密后的助记词
  isPrimary: boolean; // 核心区分：是否是自己钱包最初创建的  true:是  false:否
  accounts: WalletAccount[];//账户列表
}
//钱包状态
export interface WalletState {
  isLocked: boolean;
  isConnected: boolean;
  currentAccount: WalletAccount | null;//当前账户
  keyrings: Keyring[];//密钥环列表
  importedAccounts: WalletAccount[];//独立的私钥账户列表
  mnemonic: string | null;//助记词
  password: string | null;//钱包密码
  currentNetwork: Network;
  networks: Network[];
  tokens: Token[];//代币列表
}
//网络
export interface Network {
  id: string;
  name: string;
  rpcUrl: string;
  chainId: number;
  symbol: string;
  blockExplorerUrl?: string;
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  type: 'ERC20' | 'ERC721' | 'ERC1155';
  balance?: string;
  tokenId?: string;
  image?: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasLimit: string;
  gasPrice: string;
  data?: string;
  type: 'send' | 'receive';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  tokenAddress?: string;
  tokenSymbol?: string;
}

export interface DappRequest {
  id: string;
  method: string;
  params: any[];
  origin: string;
  timestamp: number;
}

// EIP-1102 types
export interface EthRequestAccountsParams {
  method: 'eth_requestAccounts';
  params: [];
}

// EIP-747 types
export interface WatchAssetParams {
  method: 'wallet_watchAsset';
  params: {
    type: 'ERC20' | 'ERC721' | 'ERC1155';
    options: {
      address: string;
      symbol: string;
      decimals?: number;
      image?: string;
      tokenId?: string;
    };
  };
}

export const DEFAULT_NETWORKS: Network[] = [
  {
    id: 'sepolia',
    name: 'Ethereum Sepolia Testnet',
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/Hqd_61uGu4Xbq16eZ2j5N',
    chainId: 11155111,
    symbol: 'ETH',
    blockExplorerUrl: 'https://sepolia.etherscan.io'
  },
  {
    id: 'ethereum',
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/Hqd_61uGu4Xbq16eZ2j5N',
    chainId: 1,
    symbol: 'ETH',
    blockExplorerUrl: 'https://etherscan.io'
  },
  {
    id: 'polygon',
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/Hqd_61uGu4Xbq16eZ2j5N',
    chainId: 137,
    symbol: 'POL',
    blockExplorerUrl: 'https://polygonscan.com'
  },
  {
    id: 'polygon-amoy',
    name: 'Polygon Amoy Testnet',
    rpcUrl: 'https://polygon-amoy.g.alchemy.com/v2/Hqd_61uGu4Xbq16eZ2j5N',
    chainId: 80002,
    symbol: 'POL',
    blockExplorerUrl: 'https://www.oklink.com/amoy'
  }
];