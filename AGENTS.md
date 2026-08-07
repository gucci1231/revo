# Project Rules & Memory (Visitor Host Revolution 2.0)

## 🚀 GitHub & Server Deployment Workflow
- **Git Repository**: `https://github.com/gucci1231/revo.git` (Branch: `main`)
- **Deployment Method**: All code changes MUST be committed and pushed to GitHub first, then pulled directly onto the Xserver web server.
  - **Server Host**: `xs489303.xsrv.jp` (Port: `10022`, User: `xs489303`)
  - **SSH Key**: `/Users/kawaguchiyouhei/ssh_key/k-d-o.key` (Passphrase: `docvk!3Ka.`)
  - **Remote Directory**: `/home/xs489303/k-d-o.biz/public_html/revo.k-d-o.biz`
  - **Deployment Command**:
    ```bash
    eval $(ssh-agent -s) && expect -c "
    spawn ssh-add /Users/kawaguchiyouhei/ssh_key/k-d-o.key
    expect \"Enter passphrase for /Users/kawaguchiyouhei/ssh_key/k-d-o.key:\"
    send \"docvk!3Ka.\r\"
    expect \"Identity added:\"
    " && ssh -o StrictHostKeyChecking=no -p 10022 xs489303@xs489303.xsrv.jp "cd /home/xs489303/k-d-o.biz/public_html/revo.k-d-o.biz && git pull origin main"
    ```

## 🏗 Architecture & Stack
- **Domain**: `https://revo.k-d-o.biz`
- **Primary Database**: SQLite PDO (`api/data/database.sqlite`) on Xserver (<10ms response).
- **Google Sheets Role**: Used ONLY for importing new Google Form responses via `api/sync.php`.
- **Frontend**: Tailwind CSS v4, Modular JS (`public/js/`), Single-page architecture (`index.html`).
- **Testing**: TDD with Vitest/Node Test Suite (`npm test`).

## ⚙️ Core Development Principles
- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.

## 📌 今後の開発タスク & メモ (Upcoming Tasks)
1. **GAS による PUSH 型リアルタイム同期設定**:
   - Google スプレッドシート / フォーム送信時のイベントから `https://revo.k-d-o.biz/api/sync.php` をWebフック呼び出し（PUSH型）してSQLite DBに即時同期する。
2. **Web画面からのメールテンプレート管理 ＆ GAS経由メール送信機能**:
   - Web画面（`index.html` / 管理画面）上でメールテンプレート（件名・本文、`{name}` や `{event_date}` 等の差し込み変数）の作成・保存・編集機能を構築。
   - メール送信実行時、PHPからGASエンドポイント（`GmailApp.sendEmail`）を呼び出し、Gmailから迷惑メール判定を回避しつつ送信履歴を残して安全にメール送信する仕組みを実装。

