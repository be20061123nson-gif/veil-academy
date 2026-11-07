# GitHub Pages 部署

本專案是純靜態網頁遊戲。`.github/workflows/pages.yml` 會在推送到 `main` 或 `master` 時執行，也可從 GitHub Actions 手動啟動。部署前會使用 Node.js 24 執行 `npm test` 和所有 JavaScript 檔案的 `node --check`；檢查失敗時不會部署。

Pages artifact 只包含 `index.html`、`styles.css`、`src/*.js` 和 `.nojekyll`。本機開發用的 `server.js`、測試、企劃文件及 Git 資料不會放進網站 artifact。

## 首次發布

1. 選定要使用的 GitHub repository，檢查將要提交的全部檔案和 Git 歷史中沒有密碼、API 金鑰或私人資料。若使用 GitHub Free，Pages 需使用公開 repository；公開 repository 會讓其中的程式碼、文件和版本歷史都可被查看，不只有遊戲頁面。
2. 將本專案提交並推送到 `main` 或 `master` 分支。
3. 開啟 repository 的 **Settings → Pages**。
4. 在 **Build and deployment → Source** 選擇 **GitHub Actions**。
5. 到 **Actions** 確認 `Deploy game to GitHub Pages` 的測試、語法檢查及部署工作都成功。
6. Pages 網址會顯示在 **Settings → Pages**，專案網站一般格式為 `https://<帳號>.github.io/<repository>/`。

之後每次推送至 `main` 或 `master` 都會先執行檢查，再自動部署；也可以在 Actions 頁面手動執行 workflow。

## 本機預覽

部署設定不影響原有本機方式：在專案根目錄執行 `node server.js`，開啟 `http://127.0.0.1:8000/`。

## 路徑與瀏覽器儲存

入口頁以相對路徑載入 `styles.css` 和 `src/main.js`；ES modules 也使用相對模組路徑，因此支援 `/<repository>/` 子路徑。現有遊戲素材由 Canvas 程式繪製，音效由 Web Audio API 合成，沒有必須部署的圖片或音訊檔案。Google Fonts 是可選字型，無法連線時會回退到系統字型。若日後加入本機素材，需同時把該素材目錄加入 workflow 的 `_site` 複製步驟，並確認大小寫與引用路徑一致。

設定使用瀏覽器 `localStorage`；若使用者瀏覽器封鎖儲存，遊戲仍以預設配置、標準難度和特效設定運行，但該次設定無法保存。遊戲不呼叫 localhost API，也不需要伺服器音訊端點。

本次只完成部署準備，沒有推送至 GitHub，也沒有建立公開網址。公開 repository 前仍須由你確認 repository 內容及可公開範圍。
