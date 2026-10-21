import { WalletDashboard } from '@/components/wallet/WalletDashboard';
import { WalletSetup } from '@/components/wallet/WalletSetup';
import { WalletUnlock } from '@/components/wallet/WalletUnlock';
import { useWalletStore } from '@/stores/walletStore';

const Index = () => {
  const { keyrings, importedAccounts, isLocked } = useWalletStore();
  const hasAccount = (keyrings ?? []).some(keyring => keyring.accounts.length > 0) || (importedAccounts ?? []).length > 0;

  // 如果没有账户，显示设置页面
  if (!hasAccount) {
    return <WalletSetup />;
  }
  
  // 如果钱包被锁定，显示解锁页面
  if (isLocked) {
    return <WalletUnlock />;
  }
  
  // 显示钱包主界面
  return <WalletDashboard />;
};

export default Index;
