
import { Wallet } from "lucide-react";
export default function Welcome({ createCallBack, importCallBack }: { createCallBack: () => void, importCallBack: () => void }) {
  return (
     <div className="w-[400px] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-purple-300 rounded-xl flex items-center justify-center">
            <Wallet className="w-10 h-10 text-blue-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">
              My Wallet
            </h1>
            <p className="text-gray-500 mt-2">
              安全、简单的加密货币钱包
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors duration-200" onClick={createCallBack}>创建新钱包</button>
          <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors duration-200" onClick={importCallBack}>导入现有钱包</button>
        </div>
      </div>
    </div>
  )
}
