/**
 * 作用：定义扩展的“设置页面”（通过扩展管理页访问）。

  用途：允许用户配置选项（如主题、快捷键、自定义参数）。

  入口路径：chrome://extensions/?options=<扩展id>
 */
import { useState } from "react"

function IndexOptions() {
  const [data, setData] = useState("")

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 16
      }}>
      <h1>
        Welcome to your <a href="https://www.plasmo.com">Plasmo</a> Extension!
      </h1>
      <input onChange={(e) => setData(e.target.value)} value={data} />
      <footer>Crafted by @PlasmoHQ</footer>{" "}
    </div>
  )
}

export default IndexOptions
