/**
 * 钱包状态管理 Store
 * 
 * 基于 Zustand 实现的以太坊钱包状态管理，提供完整的钱包生命周期管理功能。
 * 使用 Chrome Extension 的 storage.local API 进行数据持久化存储。
 * 
 * 主要功能模块：
 * 1. 钱包管理：创建钱包、导入钱包（助记词/私钥）、解锁/锁定钱包
 * 2. 账户管理：创建账户、切换账户、更新账户名称
 * 3. 网络管理：添加自定义网络、切换网络
 * 4. 代币管理：添加/删除代币、更新代币余额
 * 5. DApp 集成：连接钱包、签名消息、断开连接
 * 
 * 安全特性：
 * - 使用 AES 加密存储助记词和私钥
 * - 使用 SHA256 哈希存储密码
 * - 所有敏感数据在存储前均经过加密处理
 * 
 * 技术实现：
 * - 使用 BIP39 标准生成和验证助记词
 * - 使用 BIP44 路径 (m/44'/60'/0'/0/0) 派生账户
 * - 使用 ethers.js 进行钱包操作和 RPC 交互
 */

import { type Network, type Token, type WalletAccount, type WalletState, DEFAULT_NETWORKS } from '@/types/wallet';
import * as bip39 from 'bip39';
import { AES, SHA256, enc } from 'crypto-js';
import { ethers } from 'ethers';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

//WalletStore继承WalletState
interface WalletStore extends WalletState {
  // Wallet management
  createWallet: (password: string) => Promise<{ mnemonic: string; account: WalletAccount }>;
  importWallet: (mnemonic: string, password: string) => Promise<WalletAccount>;
  importPrivateKey: (privateKey: string, password: string, name?: string) => Promise<WalletAccount>;
  unlockWallet: (password: string) => boolean;
  lockWallet: () => void;

  // Account management
  createAccount: (name?: string,password?: string) => WalletAccount;
  switchAccount: (address: string) => void;
  updateAccountName: (address: string, name: string) => void;

  // Network management
  addNetwork: (network: Network) => void;
  switchNetwork: (networkId: string) => void;

  // Token management
  addToken: (token: Token) => void;
  removeToken: (address: string) => void;
  updateTokenBalance: (address: string, balance: string) => void;

  // Utility
  getProvider: () => ethers.JsonRpcProvider | null;
  isValidPassword: (password: string) => boolean;

  // 拓展
  connect: () => Promise<WalletAccount>;
  signMessage: (message: string) => Promise<string>;
  disconnect: () => void;
}
//钱包初始状态
const initialState: WalletState = {
  isLocked: false,//钱包是否锁定
  isConnected: false,//钱包是否连接
  accounts: [],//钱包账户列表
  currentAccount: null,//当前钱包账户
  mnemonic: null,//助记词
  password: null,//钱包密码
  currentNetwork: DEFAULT_NETWORKS[0],//当前网络
  networks: DEFAULT_NETWORKS,//网络列表
  tokens: []//代币列表
};

export const useWalletStore = create<WalletStore>()(
  // 使用 persist 让状态持久化
  persist(
    (set, get) => ({
      ...initialState,
      // 创建钱包
      createWallet: async (password: string) => {
        // 1、生成助记词；bip39.generateMnemonic(256); // 24 个单词
        const mnemonic = bip39.generateMnemonic();
        // 2、生成种子
        const seedBuffer = await bip39.mnemonicToSeed(mnemonic);
        // 3、把二进制种子转成 Uint8Array
        const seed = new Uint8Array(seedBuffer);
        // 4、创建 HD 钱包的根节点
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        // 5、根节点派生出指定索引的账户
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        // 6、构造账户对象，初始账户索引为 0
        const account: WalletAccount = {
          address: wallet.address,
          privateKey: wallet.privateKey,
          name: 'Account 1',
          index: 0
        };

        // 7、加密助记词和私钥
        const encryptedMnemonic = AES.encrypt(mnemonic, password).toString();
        const encryptedPrivateKey = AES.encrypt(wallet.privateKey, password).toString();

        // 8、更新 store
        set({
          isLocked: false,
          accounts: [{ ...account, privateKey: encryptedPrivateKey }],
          currentAccount: account,
          mnemonic: encryptedMnemonic,
          password: SHA256(password).toString()
        });
        // 9、返回助记词和账户
        return { mnemonic, account };
      },

      // 通过助记词导入钱包
      importWallet: async (mnemonic: string, password: string) => {
        if (!bip39.validateMnemonic(mnemonic)) {
          throw new Error('Invalid mnemonic phrase');
        }

        const seedBuffer = await bip39.mnemonicToSeed(mnemonic);
        const seed = new Uint8Array(seedBuffer);
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");

        const account: WalletAccount = {
          address: wallet.address,
          privateKey: wallet.privateKey,
          name: 'Account 1',
          index: 0
        };

        const encryptedMnemonic = AES.encrypt(mnemonic, password).toString();
        const encryptedPrivateKey = AES.encrypt(wallet.privateKey, password).toString();

        set({
          isLocked: false,
          accounts: [{ ...account, privateKey: encryptedPrivateKey }],
          currentAccount: account,
          mnemonic: encryptedMnemonic,
          password: SHA256(password).toString()
        });

        return account;
      },
      // 通过私钥导入钱包
      importPrivateKey: async (privateKey: string, password: string, name = 'Imported Account') => {
        try {
          const wallet = new ethers.Wallet(privateKey);
          const existingAccounts = get().accounts;

          const account: WalletAccount = {
            address: wallet.address,
            privateKey: wallet.privateKey,
            name,
            index: existingAccounts.length
          };

          const encryptedPrivateKey = AES.encrypt(wallet.privateKey, password).toString();

          set(state => ({
            accounts: [...state.accounts, { ...account, privateKey: encryptedPrivateKey }],
            currentAccount: account,
            password: state.password || SHA256(password).toString()
          }));

          return account;
        } catch (error) {
          throw new Error('Invalid private key');
        }
      },
      // 解锁钱包
      unlockWallet: (password: string) => {
        const state = get();
        //把加密密码转成明文
        const hashedPassword = SHA256(password).toString();
        //比较明文密码和加密密码
        if (state.password === hashedPassword) {
          //解锁钱包
          set({ isLocked: false });
          return true;
        }
        return false;
      },
      // 锁定钱包
      lockWallet: () => {
        set({ isLocked: true });
      },
      // 创建账户
      createAccount: (name?: string,password?: string) => {
        const state = get();
        //1 、检查助记词和密码是否存在
        if (!state.mnemonic || !state.password) {
          throw new Error('No wallet found');
        }
        //2、解密助记词，密码是创建账户时输入的密码,state.password是加密过后的，解不开
        const decryptedMnemonic = AES.decrypt(state.mnemonic, password).toString(enc.Utf8);
        //3、助记词 → 种子；把人类可读的助记词（12/24 个单词）转成 64 字节的二进制种子
        const seedBuffer = bip39.mnemonicToSeedSync(decryptedMnemonic);
        //4、把二进制种子转成 Uint8Array
        const seed = new Uint8Array(seedBuffer);
        //5、种子 → 根节点；种子创建 HD 钱包的根节点
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        //6、账户索引 = 最大索引+1
        const accountIndex = state.accounts.length
          ? Math.max(...state.accounts.map(a => a.index)) + 1
          : 0;
        //7、根节点 → 账户；根节点派生出指定索引的账户
        const wallet = hdNode.derivePath(`m/44'/60'/0'/0/${accountIndex}`);
       
        //8、加密私钥
        const encryptedPrivateKey = AES.encrypt(wallet.privateKey, password).toString();

        //9、构造账户对象
        const account: WalletAccount = {
          address: wallet.address,
          privateKey: encryptedPrivateKey,//wallet.privateKey是明文，加密后存进 store
          name: name || `Account ${accountIndex + 1}`,
          index: accountIndex
        };

        //10、存进 store 的是密文，不是明文；把新账户追加到 accounts；currentAccount 设为新账户
        set(state => ({
          accounts: [...state.accounts, account],
          currentAccount: {...account}
        }));
        //11、返回的 account 里私钥是明文，调用方拿到后要小心处理
        return account;
      },

      // 切换账户，账户列表中切换
      switchAccount: (address: string) => {
        const state = get();
        const account = state.accounts.find(acc => acc.address === address);
        if (account) {
          set({ currentAccount: account });
        }
      },
      // 更新账户名称
      updateAccountName: (address: string, name: string) => {
        set(state => ({
          accounts: state.accounts.map(acc =>
            acc.address === address ? { ...acc, name } : acc
          ),
          currentAccount: state.currentAccount?.address === address
            ? { ...state.currentAccount, name }
            : state.currentAccount
        }));
      },
      // 添加网络
      addNetwork: (network: Network) => {
        set(state => ({
          networks: [...state.networks, network]
        }));
      },
      // 切换网络
      switchNetwork: (networkId: string) => {
        const state = get();
        const network = state.networks.find(net => net.id === networkId);
        if (network) {
          set({ currentNetwork: network });
        }
      },
      // 添加代币
      addToken: (token: Token) => {
        set(state => ({
          tokens: [...state.tokens.filter(t => t.address !== token.address), token]
        }));
      },
      // 删除代币
      removeToken: (address: string) => {
        set(state => ({
          tokens: state.tokens.filter(token => token.address !== address)
        }));
      },
      // 更新代币余额
      updateTokenBalance: (address: string, balance: string) => {
        set(state => ({
          tokens: state.tokens.map(token =>
            token.address === address ? { ...token, balance } : token
          )
        }));
      },
      // 获取提供者
      getProvider: () => {
        const state = get();
        try {
          return new ethers.JsonRpcProvider(state.currentNetwork.rpcUrl);
        } catch (error) {
          console.error('Failed to create provider:', error);
          return null;
        }
      },
      // 验证密码
      isValidPassword: (password: string) => {
        const state = get();
        const hashedPassword = SHA256(password).toString();
        return state.password === hashedPassword;
      },
      // 拓展
      isConnected: false,
      // connect: async () => {
      //   const { state } = JSON.parse(localStorage.getItem("wallet-store"))
      //   console.log('钱包信息:', state);

      //   const account = state.currentAccount as WalletAccount
      //   if (!account ) {
      //     throw new Error('请先在插件中导入账户')
      //   }
      //   set({
      //     currentAccount: account,
      //     isConnected: true
      //   })
      //   return account
      // },
      connect: async (): Promise<WalletAccount> => {
        const state = await new Promise<WalletState | null>((resolve) => {
          chrome.storage.local.get('wallet-store', (result) => {
            console.log('钱包信息:', result['wallet-store']);
            resolve(result['wallet-store']?.state || null);
          });
        });

        if (!state || !state.currentAccount) {

          throw new Error('请先在插件中导入账户');
        }
        console.log(state);
        console.log(state.currentAccount);

        const account = state.currentAccount as WalletAccount;
        set({
          currentAccount: account,
          isConnected: true
        });

        return account;
      },
      signMessage: async (message) => {
        const { state } = JSON.parse(localStorage.getItem("wallet-store"))
        console.log('钱包信息:', state);
        const account = state.currentAccount
        if (!account) {
          throw new Error('未连接钱包')
        }
        const bytes = AES.decrypt(account.privateKey, state.password);
        const privateKey = bytes.toString(enc.Utf8)

        const wallet = new ethers.Wallet(privateKey)
        return wallet.signMessage(message)
      },
      disconnect: () => {
        set({ currentAccount: null, isConnected: false })
      }
    }),
    {
      name: 'wallet-store',
      // 自定义存储：使用 chrome.storage.local
      storage: {
        getItem: async (name: string) => {
          const result = await chrome.storage.local.get(name);
          return result[name] || null;
        },
        setItem: async (name: string, value: any) => {
          await chrome.storage.local.set({ [name]: value });
        },
        removeItem: async (name: string) => {
          await chrome.storage.local.remove(name);
        }
      },
      partialize: (state) => ({
        accounts: state.accounts,
        mnemonic: state.mnemonic,
        password: state.password,
        networks: state.networks,
        tokens: state.tokens,
        currentNetwork: state.currentNetwork,
        currentAccount: state.currentAccount,
        isConnected: state.isConnected
      })
    }
  )
);