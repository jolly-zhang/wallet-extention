
import { HDNodeWallet, Mnemonic, randomBytes } from "ethers"
export default function CreateWallet({ enterCallBack, walletInfo }: { enterCallBack: () => void, walletInfo: (walletInfo: HDNodeWallet) => void }) {
  const entropy = randomBytes(16)
  const mnemonic = Mnemonic.fromEntropy(entropy)
  const wallet = HDNodeWallet.fromMnemonic(mnemonic)

  console.log("助记词:", mnemonic.phrase)
  console.log("私钥:", wallet.privateKey)
  console.log("地址:", wallet.address)
  const mnemonicWords = mnemonic.phrase.split(" ")
  return (
    <div className="w-[400px] flex flex-col gap-2 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center font-bold">
          钱包助记词
        </div>
        <div className="flex flex-wrap gap-2">
          {
            mnemonicWords.map(
              (word) =><div key={word} className="bg-gray-100 rounded-md px-4 py-2 text-sm">{word}</div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors duration-200" onClick={() => { enterCallBack(), wallet && walletInfo(wallet)}}>连接sepolia测试网</button>
      </div>
    </div>
  )
}

/**
 * abandon ability able about above absent absorb abstract absurd abuse access accident
 */