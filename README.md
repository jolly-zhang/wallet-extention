# 去中心化钱包

## 功能梳理

![钱包功能](https://github.com/user-attachments/assets/eb175e4a-8fd8-48f7-b7aa-fab0472142e7)


## 功能架构

<img width="3340" height="2042" alt="Untitled diagram-2025-11-06-112229" src="https://github.com/user-attachments/assets/bfcc46d8-0d34-4ea7-a764-248588843c50" />


## MetaNodeWallet 文件目录结构

```
wallet-extention/
├── assets/                    # 静态资源
│   └── icon.png              # 扩展图标
│
├── build/                     # 构建输出目录（自动生成）
│   └── chrome-mv3-dev/        # Chrome Manifest V3 开发版本
│
├── docs/                      # 文档目录
│   ├── 功能模块架构图.md      # 功能模块架构图
│   └── 文件目录结构.md        # 本文件
│
├── node_modules/              # 依赖包（自动生成）
│
├── src/                       # 源代码目录
│   ├── background/           # 后台脚本
│   ├── components/           # React 组件
│   ├── contents/             # Content Scripts
│   ├── hooks/                # 自定义 Hooks
│   ├── lib/                  # 工具库
│   ├── pages/                # 页面组件
│   ├── services/             # 服务层
│   ├── static/               # 静态资源
│   ├── stores/               # 状态管理
│   ├── types/                # TypeScript 类型定义
│   ├── options.tsx           # 扩展设置页面入口
│   ├── popup.tsx             # 弹窗入口
│   └── style.css             # 全局样式
│
├── global.d.ts                # 全局类型定义
├── package.json              # 项目配置和依赖
├── package-lock.json         # npm 锁文件
├── pnpm-lock.yaml            # pnpm 锁文件
├── postcss.config.js         # PostCSS 配置
├── README.md                 # 项目说明
├── start.md                  # 启动说明
├── tailwind.config.ts        # Tailwind CSS 配置
├── tailwind.config1.js       # Tailwind CSS 备用配置
└── tsconfig.json             # TypeScript 配置
```

## 详细目录结构

### 📁 src/background/ - 后台脚本
```
background/
├── index.ts                  # 后台脚本主入口
│                            # - 初始化钱包状态
│                            # - 注册消息监听器
│                            # - 注入脚本到网页
│
├── injected-helper.ts        # 注入到网页的脚本
│                            # - 提供 window.myWallet API
│                            # - 处理连接、签名、断开等操作
│
├── type_constant.ts         # 消息类型常量定义
│                            # - WALLET_CONNECT
│                            # - WALLET_GET_ACCOUNT
│                            # - WALLET_SIGN_MESSAGE
│                            # - WALLET_DISCONNECT
│
└── types.ts                 # 后台脚本类型定义
```

### 📁 src/components/ - React 组件

#### components/wallet/ - 钱包核心组件
```
components/wallet/
├── WalletSetup.tsx          # 钱包设置组件
│                           # - 创建新钱包
│                           # - 导入助记词
│                           # - 导入私钥
│
├── WalletUnlock.tsx        # 钱包解锁组件
│                           # - 密码验证
│                           # - 解锁界面
│
├── WalletDashboard.tsx     # 钱包主面板
│                           # - 账户总览
│                           # - 余额显示
│                           # - 代币列表
│                           # - 快捷操作
│
├── AccountManager.tsx      # 账户管理组件
│                           # - 创建账户
│                           # - 切换账户
│                           # - 重命名账户
│
├── NetworkSelector.tsx     # 网络选择器组件
│                           # - 切换网络
│                           # - 添加自定义网络
│
├── SendTransaction.tsx     # 发送交易组件
│                           # - 交易表单
│                           # - 交易确认
│
└── TokenManager.tsx        # 代币管理组件
                            # - 添加代币
                            # - 删除代币
                            # - 查看代币余额
```

#### components/ui/ - UI 组件库（shadcn/ui）
```
components/ui/
├── accordion.tsx           # 手风琴组件
├── alert-dialog.tsx        # 警告对话框
├── alert.tsx               # 警告提示
├── aspect-ratio.tsx        # 宽高比组件
├── avatar.tsx              # 头像组件
├── badge.tsx               # 徽章组件
├── breadcrumb.tsx          # 面包屑导航
├── button.tsx              # 按钮组件
├── calendar.tsx            # 日历组件
├── card.tsx                # 卡片组件
├── carousel.tsx            # 轮播图组件
├── chart.tsx               # 图表组件
├── checkbox.tsx            # 复选框
├── collapsible.tsx         # 可折叠组件
├── command.tsx             # 命令面板
├── context-menu.tsx        # 右键菜单
├── dialog.tsx              # 对话框
├── drawer.tsx              # 抽屉组件
├── dropdown-menu.tsx       # 下拉菜单
├── form.tsx                # 表单组件
├── hover-card.tsx          # 悬停卡片
├── input-otp.tsx           # OTP 输入框
├── input.tsx               # 输入框
├── label.tsx               # 标签组件
├── menubar.tsx             # 菜单栏
├── navigation-menu.tsx     # 导航菜单
├── pagination.tsx          # 分页组件
├── popover.tsx             # 弹出框
├── progress.tsx            # 进度条
├── radio-group.tsx         # 单选按钮组
├── resizable.tsx           # 可调整大小组件
├── scroll-area.tsx         # 滚动区域
├── select.tsx              # 选择器
├── separator.tsx           # 分隔符
├── sheet.tsx               # 侧边栏
├── sidebar.tsx             # 侧边栏导航
├── skeleton.tsx            # 骨架屏
├── slider.tsx              # 滑块
├── sonner.tsx              # Sonner Toast
├── switch.tsx              # 开关
├── table.tsx               # 表格
├── tabs.tsx                # 标签页
├── textarea.tsx            # 文本域
├── toast.tsx               # Toast 通知
├── toaster.tsx             # Toast 容器
├── toggle-group.tsx        # 切换按钮组
├── toggle.tsx              # 切换按钮
├── tooltip.tsx             # 工具提示
└── use-toast.ts            # Toast Hook
```

#### components/ - 其他组件
```
components/
├── CreateWallet.tsx        # 创建钱包组件（旧版，可能已废弃）
├── Dashboard.tsx           # 仪表板组件（旧版，可能已废弃）
└── Welcome.tsx             # 欢迎页面组件
```

### 📁 src/contents/ - Content Scripts
```
contents/
└── message-bridge.ts       # 消息桥接脚本
                            # - 监听来自 injected-helper 的消息
                            # - 转发消息到 background
                            # - 将响应返回给网页
```

### 📁 src/hooks/ - 自定义 Hooks
```
hooks/
├── use-mobile.tsx          # 移动端检测 Hook
├── use-toast.ts            # Toast 通知 Hook
└── useWalletBalance.ts     # 钱包余额查询 Hook
                            # - 查询 ETH 余额
                            # - 查询代币余额
                            # - 刷新余额
```

### 📁 src/lib/ - 工具库
```
lib/
└── utils.ts                # 工具函数
                            # - cn() - className 合并函数
                            # - 其他通用工具函数
```

### 📁 src/pages/ - 页面组件
```
pages/
├── Index.tsx               # 主页面
│                           # - 根据钱包状态显示不同界面
│                           # - 路由到 WalletSetup/WalletUnlock/WalletDashboard
│
└── NotFound.tsx            # 404 页面
```

### 📁 src/services/ - 服务层
```
services/
└── dappProvider.ts         # DApp Provider 服务
                            # - 实现 EIP-1102 (eth_requestAccounts)
                            # - 实现 EIP-747 (wallet_watchAsset)
                            # - 提供标准以太坊 Provider API
                            # - 注入 window.ethereum 和 window.mywallet
```

### 📁 src/static/ - 静态资源
```
static/
└── logo.png                # 钱包 Logo
```

### 📁 src/stores/ - 状态管理
```
stores/
└── walletStore.ts         # 钱包状态管理（Zustand）
                            # - 钱包创建/导入/解锁
                            # - 账户管理
                            # - 网络管理
                            # - 代币管理
                            # - DApp 连接/签名/断开
                            # - 使用 Chrome Storage 持久化
```

### 📁 src/types/ - 类型定义
```
types/
├── bip39.d.ts             # BIP39 类型定义
├── crypto.d.ts            # crypto-js 类型定义
└── wallet.ts              # 钱包相关类型定义
                            # - WalletAccount
                            # - WalletState
                            # - Network
                            # - Token
                            # - Transaction
                            # - DappRequest
                            # - DEFAULT_NETWORKS
```

### 📁 src/ - 根级文件
```
src/
├── options.tsx             # 扩展设置页面入口
│                           # - 通过 chrome://extensions/?options=<id> 访问
│
├── popup.tsx               # 弹窗入口
│                           # - 提供 React Router
│                           # - 提供全局 Provider (QueryClient, TooltipProvider)
│                           # - 路由到 Index 页面
│
└── style.css               # 全局样式
                            # - Tailwind CSS 指令
                            # - 自定义 CSS 变量
```

## 配置文件说明

### 根目录配置文件
```
├── package.json            # 项目配置
│                           # - 依赖管理
│                           # - 脚本命令
│                           # - Manifest 配置
│
├── tsconfig.json           # TypeScript 配置
│                           # - 编译选项
│                           # - 路径别名 (@/)
│
├── tailwind.config.ts      # Tailwind CSS 配置
│                           # - 主题配置
│                           # - 插件配置
│
├── postcss.config.js       # PostCSS 配置
│                           # - Tailwind CSS 处理
│
└── global.d.ts             # 全局类型定义
                            # - 扩展全局类型
                            # - Chrome API 类型
```

## 目录组织原则

### 1. 按功能模块划分
- `components/wallet/` - 钱包相关组件
- `components/ui/` - 通用 UI 组件
- `background/` - 后台脚本
- `contents/` - Content Scripts

### 2. 按职责划分
- `stores/` - 状态管理
- `services/` - 服务层
- `hooks/` - 自定义 Hooks
- `types/` - 类型定义
- `lib/` - 工具函数

### 3. 入口文件
- `popup.tsx` - 弹窗入口
- `options.tsx` - 设置页面入口
- `background/index.ts` - 后台脚本入口

## 文件命名规范

1. **组件文件**: 使用 PascalCase，如 `WalletDashboard.tsx`
2. **工具文件**: 使用 camelCase，如 `useWalletBalance.ts`
3. **类型文件**: 使用 camelCase，如 `wallet.ts`
4. **配置文件**: 使用 kebab-case 或 camelCase，如 `tailwind.config.ts`

## 依赖关系

```
popup.tsx
  └── pages/Index.tsx
      └── components/wallet/*
          └── stores/walletStore.ts
              └── types/wallet.ts

background/index.ts
  └── stores/walletStore.ts
  └── background/injected-helper.ts

contents/message-bridge.ts
  └── background/index.ts (通过 Chrome Runtime API)

services/dappProvider.ts
  └── stores/walletStore.ts
```

## 扩展点

### 添加新功能模块
1. 在 `components/` 下创建新组件目录
2. 在 `stores/` 下添加对应的状态管理（如需要）
3. 在 `types/` 下添加类型定义（如需要）
4. 在 `services/` 下添加服务层（如需要）

### 添加新的 Content Script
1. 在 `contents/` 下创建新文件
2. 在 `background/index.ts` 中注册注入逻辑

### 添加新的后台功能
1. 在 `background/` 下创建新文件
2. 在 `background/index.ts` 中导入和使用

