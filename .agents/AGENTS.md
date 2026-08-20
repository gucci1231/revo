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

## 🚫 Credit & Tool Policy (Strict)
- **ブラウザツール（`browser_subagent` 等）の自動起動は完全禁止**:
  - ユーザーから明示的な指示がない限り、ブラウザの立ち上げやブラウザサブエージェント（`browser_subagent`）を一切使用・起動しないこと。
  - クレジットの無駄な消費を防ぐため、ソースコード解析（`grep_search` / `view_file`）および単体テスト（`npm test`）による検証を徹底すること。

## 🎨 UI & Design Principles (Strict)
- **戻るボタン等のアイコンボタンに説明テキスト（「一覧に戻る」等）を絶対に追加しない**:
  - 詳細画面の戻るボタン（`.vd-back-btn`）をはじめとするアイコン操作ボタンは、Appleスタイルのミニマルなアイコン（`<i class="fa-solid fa-chevron-left"></i>`）単体で維持すること。余計な説明文言を追加してはならない。
- **KPIボード デザインスタイル（Ultimate Minimal & Integrated Gauge）**:
  - **一体型ウィジェット**: `%` や余計な説明テキスト・アイコンを排除し、大型プログレスリング（126px）の中心に特大メイン数字（56px）を直接内包する構造を維持すること。
  - **純白カード & クリーンホバー**: カードは純白（`#ffffff`）、極薄境界線（`#e2e8f0`）とし、過剰な着色・オーラ・ホバー時の濃色化は行わないこと（軽い微動リフトのみ）。
  - **カラーセマンティクス（正常＝青 🔵 / 警告＝赤 🔴）**: カード全体を赤く着色せず、右上のスマートなステータスドット（`kpi-status-dot`）として 🔴 / 🔵 を表示すること（次回定例会0名時や要対応超過時）。
  - **4大KPIカード並び順**: 1: `次回定例会(日付のみ)`、2: `要対応`、3: `申込ビジター`、4: `入会目標`。
