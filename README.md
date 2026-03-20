# 羅茱組隊小工具 (RJPQ Tool) - v1.6.1

這是一個專為新楓之谷（MapleStory）中「羅密歐與茱麗葉」組隊任務（PQ）實驗室階段設計的即時同步工具。支援多人連線、顏色佔位鎖定以及行動裝置優化。

## ✨ 核心功能
*   **即時同步網格**：10x4 網格同步更新，支援多人在線同時標記。
*   **顏色佔位系統**：自動鎖定已選顏色，顯示使用者圖示防止重複選擇。
*   **3人團輔助**：紫色按鈕一鍵產生剩餘空格數字字串，方便發給不方便看畫面的隊友。
*   **防錯機制**：禁止覆蓋他人標記，同一顏色每列僅限一格。
*   **安全防呆**：加入房間強制密碼驗證，防止誤入。

## 🚀 本地開發與啟動

### 1. 安裝環境
請確保您的電腦已安裝 [Node.js](https://nodejs.org/) (建議 v18 以上)。

### 2. 安裝依賴
在專案根目錄執行：
```bash
npm run install:all
```

### 3. 啟動服務
同時啟動後端與前端（開發模式）：
*   **啟動後端** (Port 3001): `node backend/server.js`
*   **啟動前端** (Port 5173): `npm run dev --prefix frontend`

---

## ☁️ 部署說明 (Render.com)
*   **Build Command**: `npm run install:all && npm run build`
*   **Start Command**: `npm start`
*   **Port**: 3001 (Render 會自動對應)

---

## 🛠️ Git 版本管理與還原指南

如果您在修改過程中發現「炸了」或者想回到某個成功的版本，請參考以下指令：

### 1. 檢視歷史紀錄
```bash
git log --oneline
```
這會列出所有提交紀錄，例如：
`c581bcc (HEAD -> master, origin/master) v1.6.1: Optimized deployment config`
`c8871f7 v1.6.1: Final stable version with all features`

### 2. 硬性還原 (回到過去，捨棄之後的所有改動)
如果您想徹底回到某個穩定的 commit（例如 `c8871f7`）：
```bash
# 警告：這會刪除所有未儲存的本地改動
git reset --hard c8871f7
```

### 3. 還原到 GitHub 上的最新版本
如果您本地端改亂了，想直接同步回雲端最新的：
```bash
git fetch origin
git reset --hard origin/master
```

### 4. 救回誤刪的檔案 (尚未 commit 的情況)
```bash
git checkout .
```

---

## 📄 授權與宣告
本專案僅供遊戲交流使用。
風格參考自 rjpq.wuca.cc 並由 Antigravity AI 進行二創與效能優化。
