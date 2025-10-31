interface EthereumProvider {
  isMetaMask?: boolean
  request?: (args: { method: string; params?: any[] }) => Promise<any>
  on?: (event: string, handler: (...args: any[]) => void) => void
}

interface Window {
  ethereum?: EthereumProvider
}

declare module '*.png' {
  const value: string
  export default value
}

declare module '*.jpg' {
  const value: string
  export default value
}

declare module '*.jpeg' {
  const value: string
  export default value
}

declare module '*.svg' {
  const value: string
  export default value
}

declare module '*.gif' {
  const value: string
  export default value
}