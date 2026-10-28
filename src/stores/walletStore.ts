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

import { type Network, type Token, type WalletAccount, type Keyring, type WalletState, DEFAULT_NETWORKS } from '@/types/wallet';
import * as bip39 from 'bip39';
import { AES, SHA256, enc } from 'crypto-js';
import { ethers } from 'ethers';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
//WalletStore继承WalletState
interface WalletStore extends WalletState {
  deriveHDAccount: (mnemonic: string, password: string) => Promise<{ newKeyring: Keyring; firstAccount: WalletAccount }>;
  // Wallet management
  createWallet: (password: string) => Promise<{ mnemonic: string; account: WalletAccount }>;
  importWallet: (mnemonic: string, password: string) => Promise<{ mnemonic: string; account: WalletAccount }>;
  importPrivateKey: (privateKey: string, password: string, name?: string) => Promise<WalletAccount>;
  unlockWallet: (password: string) => boolean;
  lockWallet: () => void;

  // Account management
  createAccount: (keyringId: string, name?: string, password?: string) => WalletAccount;
  switchAccount: (address: string) => void;
  updateAccountName: (address: string, name: string) => void;
  exportMnemonic: (account: WalletAccount, password: string) => string;
  // exportPrivateKey: (address: string, password: string) => string;

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
  currentAccount: null,//当前钱包账户
  keyrings: [],//钱包密钥环列表
  importedAccounts: [], // 独立的私钥账户
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

      deriveHDAccount: async (mnemonic: string, password: string) => {
        const isPrimary = get().keyrings.length === 0; // 如果这是第一组，就是主钱包
        const importedCount = get().keyrings.filter(k => !k.isPrimary).length;
        const keyringName = isPrimary ? '我的主钱包' : `导入的钱包 ${importedCount + 1}`;

        // 2、生成种子
        const seedBuffer = await bip39.mnemonicToSeed(mnemonic);
        // 3、把二进制种子转成 Uint8Array
        const seed = new Uint8Array(seedBuffer);
        // 4、创建 HD 钱包的根节点
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        // 5、根节点派生出指定索引的账户
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        // 6、加密助记词和私钥
        const encryptedMnemonic = AES.encrypt(mnemonic, password).toString();
        const encryptedPrivateKey = AES.encrypt(wallet.privateKey, password).toString();

        // 7、构造账户对象，初始账户索引为 0
        const keyringId = uuidv4();
        const firstAccount: WalletAccount = {
          address: wallet.address,
          privateKey: encryptedPrivateKey,//加密后的私钥
          name: 'Account 1',
          index: 0,
          type: 'HD',
          keyringId: keyringId
        };
        const newKeyring: Keyring = {
          id: keyringId,
          name: keyringName,
          encryptedMnemonic: encryptedMnemonic,//加密后的助记词
          isPrimary,
          accounts: [firstAccount]
        };
        return { newKeyring, firstAccount };
      },
      // 一、创建钱包
      createWallet: async (password: string) => {
        //判断是否有助记词；some找到第一个满足条件的元素就停止遍历
        if (get().keyrings.some(k => k.isPrimary)) {
          throw new Error("主钱包已存在，请使用导入功能");
        }
        // 1、生成助记词；bip39.generateMnemonic(256); // 24 个单词
        const mnemonic = bip39.generateMnemonic();
        const { newKeyring, firstAccount } = await get().deriveHDAccount(mnemonic, password);

        // 8、更新 store
        set({
          isLocked: false,
          keyrings: [...get().keyrings, newKeyring],
          currentAccount: firstAccount,
          mnemonic: newKeyring.encryptedMnemonic,
          password: SHA256(password).toString()//加密后的密码
        });
        // 9、返回助记词和账户
        return { mnemonic, account: firstAccount };
      },

      // 二、通过助记词导入钱包
      importWallet: async (mnemonic: string, password: string) => {
        //1、验证助记词
        if (!bip39.validateMnemonic(mnemonic)) {
          throw new Error('Invalid mnemonic phrase');
        }

        //2、查看是否已经有账户在钱包里
        const testWallet = ethers.HDNodeWallet.fromSeed(new Uint8Array(bip39.mnemonicToSeedSync(mnemonic))).derivePath("m/44'/60'/0'/0/0");
        const allAddresses = [
          ...get().keyrings.flatMap(k => k.accounts.map(a => a.address.toLowerCase())),
          ...get().importedAccounts.map(a => a.address.toLowerCase())
        ];
        if (allAddresses.includes(testWallet.address.toLowerCase())) {
          throw new Error("该助记词对应的账户已存在于钱包中！");
        }
        const existingPassword = get().password;
        if (existingPassword && existingPassword !== SHA256(password).toString()) {
          throw new Error('密码错误');
        }
        const { newKeyring, firstAccount } = await get().deriveHDAccount(mnemonic, password);
        set({
          isLocked: false,
          keyrings: [...get().keyrings, newKeyring],
          currentAccount: firstAccount,
          mnemonic: get().mnemonic ?? newKeyring.encryptedMnemonic,
          password: existingPassword || SHA256(password).toString()
        });

        return { mnemonic, account: firstAccount };
      },

      // 三、通过私钥导入钱包
      importPrivateKey: async (privateKey: string, password: string, name?: string) => {
        const state = get();
        try {
          //1、验证私钥
          const pkClean = privateKey.trim().replace(/\s+/g, '');
          const reg = /^(0x)?[0-9a-fA-F]{64}$/;
          if (!reg.test(pkClean)) {
            throw new Error('私钥格式错误');
          }
          //2、创建钱包
          const wallet = new ethers.Wallet(pkClean);
          //查看是否已经有账户在钱包里
          const allAddresses = [
            ...get().keyrings.flatMap(k => k.accounts.map(a => a.address.toLowerCase())),
            ...get().importedAccounts.map(a => a.address.toLowerCase())
          ];
          if (allAddresses.includes(wallet.address.toLowerCase())) {
            throw new Error("该账户已存在于钱包中！");
          }
          //计算账户索引
          const accountIndex = state.importedAccounts.length
            ? Math.max(...state.importedAccounts.map(a => a.index)) + 1
            : 0;
          const encryptedPrivateKey = AES.encrypt(wallet.privateKey, password).toString();

          const account: WalletAccount = {
            address: wallet.address,
            privateKey: encryptedPrivateKey,
            name: name || `Account ${accountIndex + 1}`,
            index: accountIndex,
            type: 'Imported_PrivateKey',
          };
          set(state => ({
            importedAccounts: [...state.importedAccounts, account],
            currentAccount: state.currentAccount || account,
            password: state.password || SHA256(password).toString()
          }));
          return account;
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : "导入失败");
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
      createAccount: (keyringId: string, name?: string, password?: string) => {
        const state = get();
        // 根据 keyringId 找到对应的 keyring
        const keyring = state.keyrings.find(keyring => keyring.id === keyringId);
        if (!keyring?.encryptedMnemonic || !password) {
          throw new Error('No wallet found');
        }
        // 解密主钱包助记词
        const decryptedMnemonic = AES.decrypt(keyring.encryptedMnemonic, password).toString(enc.Utf8);
        if (!bip39.validateMnemonic(decryptedMnemonic)) {
          throw new Error('密码错误或助记词无法解密');
        }
        // 把助记词转成种子
        const seedBuffer = bip39.mnemonicToSeedSync(decryptedMnemonic);
        // 把种子转成 Uint8Array
        const seed = new Uint8Array(seedBuffer);
        // 创建 HD 钱包的根节点
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        // 计算账户索引
        const accountIndex = keyring.accounts.length
          ? Math.max(...keyring.accounts.map(account => account.index)) + 1
          : 0;
        // 根节点派生出指定索引的账户
        const wallet = hdNode.derivePath(`m/44'/60'/0'/0/${accountIndex}`);
        // 加密私钥
        const encryptedPrivateKey = AES.encrypt(wallet.privateKey, password).toString();
        // 构造账户对象
        const newAccount: WalletAccount = {
          address: wallet.address,
          privateKey: encryptedPrivateKey,
          name: name || `Account ${accountIndex + 1}`,
          index: accountIndex,
          type: 'HD',
          keyringId: keyring.id
        };

        // 更新 store
        set(state => ({
          keyrings: state.keyrings.map(k =>
            k.id === keyring.id
              ? { ...k, accounts: [...k.accounts, newAccount] }
              : k
          ),
          currentAccount: newAccount
        }));
        return newAccount;
      },
      // 导出指定账户的助记词
      exportMnemonic: (account: WalletAccount, password: string) => {
        if (account.type === 'Imported_PrivateKey') {
          throw new Error("此账户通过私钥导入，没有关联的助记词。请导出私钥进行备份。");
        }
        const keyring = get().keyrings.find(k => k.id === account.keyringId)
          ?? get().keyrings.find(k => k.accounts.some(item => item.address === account.address));
        if (!keyring) {
          throw new Error("找不到该账户对应的助记词信息");
        }
        // 3. 解密助记词
        const decryptedMnemonic = AES.decrypt(keyring.encryptedMnemonic, password).toString(enc.Utf8);
        if (!bip39.validateMnemonic(decryptedMnemonic)) {
          throw new Error('密码错误或助记词无法解密');
        }
        return decryptedMnemonic;
      },
      // 切换账户，账户列表中切换
      switchAccount: (address: string) => {
        const state = get();
        const account = [
          ...(state.keyrings ?? []).flatMap(keyring => keyring.accounts),
          ...(state.importedAccounts ?? [])
        ].find(item => item.address === address);
        if (account) {
          set({ currentAccount: account });
        }
      },


      // 导出指定账户的私钥，使用用户输入的明文密码解密
      // exportPrivateKey: (address: string, password: string) => {
      //   const state = get();
      //   const account = [
      //     ...(state.keyrings ?? []).flatMap(keyring => keyring.accounts),
      //     ...(state.importedAccounts ?? [])
      //   ].find(item => item.address === address);
      //   if (!account) {
      //     throw new Error('账户不存在');
      //   }
      //   if (/^0x[0-9a-fA-F]{64}$/.test(account.privateKey)) {
      //     return account.privateKey;
      //   }
      //   const privateKey = AES.decrypt(account.privateKey, password).toString(enc.Utf8);
      //   if (!privateKey) {
      //     throw new Error('密码错误或私钥无法解密');
      //   }
      //   return privateKey;
      // },
      // 更新账户名称
      updateAccountName: (address: string, name: string) => {
        set(state => ({
          keyrings: state.keyrings.map(keyring => ({
            ...keyring,
            accounts: keyring.accounts.map(acc =>
              acc.address === address ? { ...acc, name } : acc
            )
          })),
          importedAccounts: state.importedAccounts.map(acc =>
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
      // 连接钱包
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
      // 签名消息
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
        keyrings: state.keyrings,
        importedAccounts: state.importedAccounts,
        mnemonic: state.mnemonic,
        password: state.password,
        networks: state.networks,
        tokens: state.tokens,
        currentNetwork: state.currentNetwork,
        currentAccount: state.currentAccount,
        isConnected: state.isConnected,
        // 锁定状态要跨弹窗共享，确认连接窗口才能判断该进解锁页还是确认页
        isLocked: state.isLocked
      })
    }
  )
);