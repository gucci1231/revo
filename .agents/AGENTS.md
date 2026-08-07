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
