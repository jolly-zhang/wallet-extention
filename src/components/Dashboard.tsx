
import { HDNodeWallet, JsonRpcProvider, Wallet } from "ethers";
import { useEffect, useState } from "react";
export default function Dashboard({ wallet }: { wallet: HDNodeWallet }) {
  const [balance, setBalance] = useState('0.0')
  const connectNetwork = async () => {
    const provider = new JsonRpcProvider("https://sepolia.gateway.tenderly.co")
    const wallet1 = new Wallet(wallet.privateKey)
    const connectedWallet = wallet1.connect(provider)
    const balance = await provider.getBalance(connectedWallet.address)
    alert(balance.toString())
    setBalance(balance.toString())
  }
  useEffect(() => {
    connectNetwork()
  }, [])
  return (
    <div className="w-[400px] flex flex-col gap-2 p-4">
      <div className="p-4 text-2xl font-bold">钱包</div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xl">总余额</span>
          <span className="bg-blue-300 p-1 rounded-md text-white">{balance}ETH</span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500">地址</span>
          <span className="bg-blue-300 p-1 rounded-md text-white">{wallet.address}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500">私钥</span>
          <span className="bg-blue-300 p-1 rounded-md text-white">{wallet.privateKey}</span>
        </div>
      </div>
    </div>
  )
}
