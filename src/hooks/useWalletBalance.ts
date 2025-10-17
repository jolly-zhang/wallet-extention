import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWalletStore } from '@/stores/walletStore';
import { Token } from '@/types/wallet';

export const useWalletBalance = () => {
  const { currentAccount, currentNetwork, getProvider, tokens, updateTokenBalance } = useWalletStore();
  const [ethBalance, setEthBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);

  const fetchEthBalance = async () => {
    if (!currentAccount || !currentNetwork) return;

    setIsLoading(true);
    try {
      const provider = getProvider();
      if (!provider) return;

      const balance = await provider.getBalance(currentAccount.address);
      setEthBalance(ethers.formatEther(balance));
    } catch (error) {
      console.error('Failed to fetch ETH balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTokenBalance = async (token: Token) => {
    if (!currentAccount || !currentNetwork) return;

    try {
      const provider = getProvider();
      if (!provider) return;

      if (token.type === 'ERC20') {
        const erc20Abi = [
          'function balanceOf(address owner) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ];
        
        const contract = new ethers.Contract(token.address, erc20Abi, provider);
        const balance = await contract.balanceOf(currentAccount.address);
        const formattedBalance = ethers.formatUnits(balance, token.decimals);
        updateTokenBalance(token.address, formattedBalance);
      } else if (token.type === 'ERC721') {
        const erc721Abi = [
          'function balanceOf(address owner) view returns (uint256)',
          'function ownerOf(uint256 tokenId) view returns (address)'
        ];
        
        const contract = new ethers.Contract(token.address, erc721Abi, provider);
        const balance = await contract.balanceOf(currentAccount.address);
        updateTokenBalance(token.address, balance.toString());
      }
    } catch (error) {
      console.error(`Failed to fetch ${token.symbol} balance:`, error);
    }
  };

  const fetchAllTokenBalances = async () => {
    if (!tokens.length) return;

    setIsLoading(true);
    try {
      await Promise.all(tokens.map(token => fetchTokenBalance(token)));
    } catch (error) {
      console.error('Failed to fetch token balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshBalances = async () => {
    await Promise.all([
      fetchEthBalance(),
      fetchAllTokenBalances()
    ]);
  };

  useEffect(() => {
    if (currentAccount) {
      refreshBalances();
    }
  }, [currentAccount, currentNetwork]);

  return {
    ethBalance,
    isLoading,
    refreshBalances,
    fetchTokenBalance
  };
};