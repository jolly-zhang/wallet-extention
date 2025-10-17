import { type Network, type Token, type WalletAccount, type WalletState, DEFAULT_NETWORKS } from '@/types/wallet';
import * as bip39 from 'bip39';
import { AES, SHA256, enc } from 'crypto-js';
import { ethers } from 'ethers';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WalletStore extends WalletState {
  // Wallet management
  createWallet: (password: string) => Promise<{ mnemonic: string; account: WalletAccount }>;
  importWallet: (mnemonic: string, password: string) => Promise<WalletAccount>;
  importPrivateKey: (privateKey: string, password: string, name?: string) => Promise<WalletAccount>;
  unlockWallet: (password: string) => boolean;
  lockWallet: () => void;
  
  // Account management
  createAccount: (name?: string) => WalletAccount;
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

const initialState: WalletState = {
  isLocked: false,
  isConnected: false,
  accounts: [],
  currentAccount: null,
  mnemonic: null,
  password: null,
  currentNetwork: DEFAULT_NETWORKS[0],
  networks: DEFAULT_NETWORKS,
  tokens: []
};

export const useWalletStore = create<WalletStore>()(
  // 使用 persist 让状态持久化
  persist(
    (set, get) => ({
      ...initialState,

      createWallet: async (password: string) => {
        // 生成助记词
        const mnemonic = bip39.generateMnemonic();
        // 生成种子
        const seedBuffer = await bip39.mnemonicToSeed(mnemonic);
        // 转成 Uint8Array
        const seed = new Uint8Array(seedBuffer);
        console.log(mnemonic);
        console.log(seedBuffer);
        console.log(seed);
        
        // 生成钱包
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        // 生成账户
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        
        const account: WalletAccount = {
          address: wallet.address,
          privateKey: wallet.privateKey,
          name: 'Account 1',
          index: 0
        };

        // Encrypt sensitive data
        const encryptedMnemonic = AES.encrypt(mnemonic, password).toString();
        const encryptedPrivateKey = AES.encrypt(wallet.privateKey, password).toString();

        set({
          isLocked: false,
          accounts: [{ ...account, privateKey: encryptedPrivateKey }],
          currentAccount: account,
          mnemonic: encryptedMnemonic,
          password: SHA256(password).toString()
        });

        return { mnemonic, account };
      },

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

      unlockWallet: (password: string) => {
        const state = get();
        const hashedPassword = SHA256(password).toString();
        
        if (state.password === hashedPassword) {
          set({ isLocked: false });
          return true;
        }
        return false;
      },

      lockWallet: () => {
        set({ isLocked: true });
      },

      createAccount: (name?: string) => {
        const state = get();
        if (!state.mnemonic || !state.password) {
          throw new Error('No wallet found');
        }

        // Decrypt mnemonic to create new account
        const decryptedMnemonic = AES.decrypt(state.mnemonic, state.password).toString(enc.Utf8);
        const seedBuffer = bip39.mnemonicToSeedSync(decryptedMnemonic);
        const seed = new Uint8Array(seedBuffer);
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        const accountIndex = state.accounts.length;
        const wallet = hdNode.derivePath(`m/44'/60'/0'/0/${accountIndex}`);

        const account: WalletAccount = {
          address: wallet.address,
          privateKey: wallet.privateKey,
          name: name || `Account ${accountIndex + 1}`,
          index: accountIndex
        };

        const encryptedPrivateKey = AES.encrypt(wallet.privateKey, state.password).toString();

        set(state => ({
          accounts: [...state.accounts, { ...account, privateKey: encryptedPrivateKey }],
          currentAccount: account
        }));

        return account;
      },

      switchAccount: (address: string) => {
        const state = get();
        const account = state.accounts.find(acc => acc.address === address);
        if (account) {
          set({ currentAccount: account });
        }
      },

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

      addNetwork: (network: Network) => {
        set(state => ({
          networks: [...state.networks, network]
        }));
      },

      switchNetwork: (networkId: string) => {
        const state = get();
        const network = state.networks.find(net => net.id === networkId);
        if (network) {
          set({ currentNetwork: network });
        }
      },

      addToken: (token: Token) => {
        set(state => ({
          tokens: [...state.tokens.filter(t => t.address !== token.address), token]
        }));
      },

      removeToken: (address: string) => {
        set(state => ({
          tokens: state.tokens.filter(token => token.address !== address)
        }));
      },

      updateTokenBalance: (address: string, balance: string) => {
        set(state => ({
          tokens: state.tokens.map(token =>
            token.address === address ? { ...token, balance } : token
          )
        }));
      },

      getProvider: () => {
        const state = get();
        try {
          return new ethers.JsonRpcProvider(state.currentNetwork.rpcUrl);
        } catch (error) {
          console.error('Failed to create provider:', error);
          return null;
        }
      },

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
        console.log(state.currentAccount );
        
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
        set({ currentAccount: null, isConnected: false})
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