const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const SRC_DIR = path.join(__dirname, 'src');

function buildHtml() {
  let indexContent = fs.readFileSync(path.join(SRC_DIR, 'Index.html'), 'utf8');

  // Replace <?!= include('FileName'); ?> with actual sub-template file contents
  indexContent = indexContent.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (match, filename) => {
    let filePath = path.join(SRC_DIR, filename + '.html');
    if (fs.existsSync(filePath)) {
      let subContent = fs.readFileSync(filePath, 'utf8');
      return subContent.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (m, fn) => {
        let fp = path.join(SRC_DIR, fn + '.html');
        return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '';
      });
    }
    return '';
  });

  // Inject Local Mock for google.script.run
  const mockScript = `
  <script>
    if (typeof google === 'undefined') {
      window.google = {
        script: {
          history: { setChangeHandler: function() {} },
          host: { close: function() {} },
          run: {
            withSuccessHandler: function(cb) {
              this._successCb = cb;
              return this;
            },
            withFailureHandler: function(cb) {
              this._failCb = cb;
              return this;
            },
            getDashboardData: function() {
              setTimeout(() => {
                if (this._successCb) this._successCb({
                  success: true,
                  nextThuStr: "2026/08/13",
                  afterNextThuStr: "2026/08/20",
                  metrics: { applyCount: 42, joinedCount: 8, targetJoinGoal: 12, achievementRate: "66.7", joinRate: "19.0", nextThuCount: 5, avgVisitorCount: "4.2", feedbackRate: "80.0", hearingRate: "75.0" },
                  tables: {
                    hotVisitors: [
                      { id: "101", no: "101", name: "山田 太郎", furigana: "ヤマダ タロウ", company: "サンプル株式会社", profession: "経営コンサル", inviter: "佐藤 一郎", orientUser: "鈴木 健二", eventDate: "2026/08/06", feelAbc: "A", q7: "ぜひ入会を検討したい", isAttended: "参加", isJoined: "未", is1to1: "済", hasHearingSheet: true },
                      { id: "102", no: "102", name: "鈴木 花子", furigana: "スズキ ハナコ", company: "テックデザイン合同会社", profession: "Web制作", inviter: "高橋 誠", orientUser: "田中 恵", eventDate: "2026/08/06", feelAbc: "B", q7: "見学後に判断", isAttended: "参加", isJoined: "未", is1to1: "未", hasHearingSheet: true },
                      { id: "103", no: "103", name: "佐藤 健", furigana: "サトウ タケシ", company: "佐藤企画", profession: "イベント企画", inviter: "川口 陽平", orientUser: "小山 哲夫", eventDate: "2026/08/06", feelAbc: "C", q7: "タイミングをみて再検討", isAttended: "参加", isJoined: "未", is1to1: "未", hasHearingSheet: true }
                    ],
                    nextMeeting: [
                      { id: "103", no: "103", name: "伊藤 健太", furigana: "イトウ ケンタ", company: "クリエイト社", profession: "広告デザイン", inviter: "渡辺 直樹", eventDate: "2026/08/13", isAttended: "未", hasHearingSheet: false }
                    ]
                  }
                });
              }, 50);
            },
            getAllVisitorsApi: function() {
              setTimeout(() => {
                let list = [];
                for (let i = 1; i <= 68; i++) {
                  list.push({
                    id: String(i),
                    no: String(i),
                    eventDate: "2026/08/" + (i % 28 + 1).toString().padStart(2, '0'),
                    name: "テストビジター " + i,
                    furigana: "てすとびじたー " + i,
                    profession: "専門職 " + (i % 5 + 1),
                    company: "サンプル企業 " + i,
                    inviter: "紹介者 " + (i % 10 + 1),
                    attendanceCount: "初めて",
                    isAttended: i % 3 === 0 ? "参加" : (i % 3 === 1 ? "不参加" : "未"),
                    isJoined: i % 10 === 0 ? "入会済" : "未",
                    is1to1: i % 4 === 0 ? "済" : "未",
                    hasHearingSheet: i % 2 === 0
                  });
                }
                if (this._successCb) this._successCb({ success: true, list: list });
              }, 50);
            },
            getHearingSheetsListApi: function() {
              setTimeout(() => {
                let list = [];
                for (let i = 1; i <= 35; i++) {
                  list.push({
                    visitorId: String(i),
                    no: String(i),
                    name: "ホットビジター " + i,
                    furigana: "ほっとびじたー " + i,
                    company: "株式会社サンプル " + i,
                    profession: "IT・マーケティング",
                    inviter: "紹介メンバー " + (i % 5 + 1),
                    orientUser: "オリエン担当 " + (i % 3 + 1),
                    eventDate: "2026/08/06",
                    feelAbc: i % 3 === 0 ? "A" : (i % 3 === 1 ? "B" : "C"),
                    q7: "前向きに入会を検討中。メンバーとの面談を希望。",
                    isAttended: "参加",
                    hasHearingSheet: true
                  });
                }
                if (this._successCb) this._successCb({ success: true, list: list });
              }, 50);
            },
            getScheduledEmailsApi: function() {
              setTimeout(() => {
                if (this._successCb) this._successCb({
                  success: true,
                  metrics: { totalCount: 12, todayCount: 2, thisWeekCount: 5 },
                  isTestMode: true,
                  testEmailList: ["test@example.com"],
                  scheduledList: []
                });
              }, 50);
            },
            getVisitorDetailApi: function(id) {
              setTimeout(() => {
                if (this._successCb) this._successCb({
                  success: true,
                  visitorInfo: { id: id, name: "サンプル 太郎", furigana: "サンプル タロウ", company: "サンプル社", profession: "経営者", email: "sample@example.com", eventDate: "2026/08/06", inviter: "紹介者" },
                  statusInfo: { isAttended: "参加", isJoined: "未", is1to1: "未" },
                  hearingInfo: { feelAbc: "A", q1: "非常に良かった", q7: "入会検討中", orientUser: "オリエン担当者" },
                  mailHistories: []
                });
              }, 50);
            },
            getMembersMasterApi: function() {
              setTimeout(() => {
                if (this._successCb) this._successCb({ success: true, list: [] });
              }, 50);
            },
            logClientErrorApi: function() {}
          }
        }
      };
    }
  </script>
  `;

  return indexContent.replace('</head>', mockScript + '\n</head>');
}

const server = http.createServer((req, res) => {
  try {
    const html = buildHtml();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end("Local Server Error:\n" + err.stack);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 ローカルテストサーバーが起動しました: http://localhost:${PORT}`);
  console.log(`💡 src/ 内のHTML/CSS/JSファイルを編集してブラウザでリロードするだけでローカルテストできます！`);
});
