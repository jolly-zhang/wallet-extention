/**
 * 桥接脚本
 * 
 * 网页(injected-helper)消息 => 桥接(message-bridge)转发 => 插件(background/index)接受到网页消息，处理消息并返回处理信息 => 桥接将处理的信息转给 => 网页
 * 
 * 网页脚本：插入到网页上下文， 但是不能访问不到 chrom.runtime
 */
// import type { PlasmoCSConfig } from "plasmo";

// export const config: PlasmoCSConfig = {
//   matches: ["<all_urls>"],
//   //写上一个网址，就是不监听这个网址的脚本
//   exclude_matches: ["<all_urls>"],
//   // 设置脚本运行的世界，MAIN 表示在主进程运行，CONTENT_SCRIPT 表示在内容脚本运行 
//   world: "MAIN",
// }
// console.log("message-bridge.ts 已经加载");

// 监听来自 injected-helper 的消息
window.addEventListener("message", (event) => {
  console.log("收到来自 injected-helper 的消息：", event);
  if (
    //① 来源过滤：必须来自当前 window，不能是 iframe
    event.source !== window ||
    //② 数据过滤：必须有有效数据，包含必要字段
    !event.data ||
    //③ 来源过滤：必须来自 injected-helper，不能是其他来源
    event.data.from !== "injected-helper" ||
    //④ 数据过滤：必须有有效类型和请求ID
    !event.data.type ||
    //⑤ 数据过滤：必须有有效请求ID
    !event.data.requestId
  ) {
    return
  }

  // chrome.runtime.connect / sendMessage 把页面请求转发过去，也监听 background 返回的结果。
  chrome.runtime.sendMessage(
    {
      type: event.data.type,
      requestId: event.data.requestId,
      data: event.data.data
    },
    (response) => {
      console.log("收到来自 background 的响应：", response)
      if (chrome.runtime.lastError) {
        console.error("转发消息到background失败:", chrome.runtime.lastError)
         window.postMessage({
          from: 'message-bridge',
          requestId: event.data.requestId,
          success: false,
          error: chrome.runtime.lastError.message
         }, window.location.origin)
         return
      }

      const error = response?.data?.error
      // 转发结果消息到injected-helper。拒绝连接时要让网页侧的 Promise 失败，RainbowKit 才会退出等待
      window.postMessage({
        from: 'message-bridge',
        requestId: event.data.requestId,
        success: !error && !!response,
        data: response?.data,
        error: error || (response ? undefined : '扩展没有响应'),
        code: response?.data?.code
      }, "*")
    }
  )
})
