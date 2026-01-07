# Pixel Hunter Online PK 🎮

在线双人对战版找色块游戏

## 本地运行

```bash
# 安装依赖
npm install

# 启动服务器
npm start
```

然后访问 http://localhost:3000

## 部署到云端

### 方式一：部署到 Railway（推荐，免费）

1. 注册 [Railway](https://railway.app/) 账号
2. 安装 Railway CLI：
   ```bash
   npm install -g @railway/cli
   ```
3. 登录并部署：
   ```bash
   railway login
   railway init
   railway up
   ```
4. 获取公网链接：
   ```bash
   railway domain
   ```

### 方式二：部署到 Render（免费）

1. 注册 [Render](https://render.com/) 账号
2. 新建 Web Service
3. 连接你的 GitHub 仓库
4. 设置：
   - Build Command: `npm install`
   - Start Command: `npm start`
5. 部署完成后获取链接

### 方式三：部署到 Vercel（需要改造）

Vercel 不支持 WebSocket，需要用 Socket.io + Vercel Serverless，改造较大，不推荐。

### 方式四：部署到自己的服务器

```bash
# 在服务器上
git clone <你的仓库>
cd pixel-hunter-online
npm install
npm start

# 使用 pm2 保持运行
npm install -g pm2
pm2 start server/index.js --name pixel-hunter
```

## 玩法说明

1. **创建房间**：点击"创建房间"获得6位房间号
2. **分享房间号**：把房间号发给朋友
3. **加入房间**：朋友输入房间号加入
4. **准备**：双方都点击 READY 后开始倒计时
5. **游戏**：找出颜色不同的方块，先达到 Level 15 的人获胜

## 技术栈

- 前端：原生 HTML/CSS/JS
- 后端：Node.js + Express + WebSocket
- 实时通信：ws 库

## 文件结构

```
pixel-hunter-online/
├── public/
│   └── index.html      # 前端页面
├── server/
│   └── index.js        # 后端服务
├── package.json
└── README.md
```
