<?php
require_once __DIR__ . '/db.php';

// 1. Seed Members
$membersData = [
  ['1', '〇士業・事業サポート', '小瀬戸 健一', '融資・補助金申請サポート'],
  ['2', '〇士業・事業サポート', '前井 宏之', '社長の孤独をなくす専属AI'],
  ['3', '〇建築', '平田 貴嗣', '電気工事LED'],
  ['4', '〇建築', '上田 優也', 'シーリング工事'],
  ['5', '〇建築', '小山 世次', 'セミ新築(住まいの再生ラボ)'],
  ['6', '〇不動産', '阿部 真二', '不動産買取り'],
  ['7', '〇保険・金融', '三島 文美', '生命保険（家計にやさしいアドバイザー）'],
  ['8', '〇保険・金融', '永井 創太', '生命保険（個人）'],
  ['9', '〇飲食・物販', '森田 由美子', '日本茶販売'],
  ['10', '〇飲食・物販', '川田 湧矢', '和食とワイン'],
  ['11', '〇美容・健康', '板谷 栄子', 'ながらダイエット機器販売'],
  ['12', '〇クリエイティブ・マーケティング', '桐原 卓也', 'SNS特化ショート動画制作'],
  ['13', '〇クリエイティブ・マーケティング', '川口 陽平', 'デザイナー'],
  ['14', '〇クリエイティブ・マーケティング', '江幡 幸典', '人生の節目フォトグラファー'],
  ['15', '〇ライフイベント・サービス', '居原田 晃司', '結婚相談所']
];

$stmtM = $pdo->prepare("INSERT OR REPLACE INTO members (id, category, name, profession, updated_at) VALUES (?, ?, ?, ?, ?)");
$now = date('Y/m/d H:i');
foreach ($membersData as $m) {
    $stmtM->execute([$m[0], $m[1], $m[2], $m[3], $now]);
}

// 2. Seed Initial Visitors & Status
$visitorsData = [
  ['101', '2026/08/01', '佐藤 一郎', '2026/08/06', '山田 太郎', 'ヤマダ タロウ', '経営コンサル', 'サンプル株式会社', 'yamada@example.com', '初めて', '入会を前向きに検討中'],
  ['102', '2026/08/02', '高橋 誠', '2026/08/06', '鈴木 花子', 'スズキ ハナコ', 'Web制作', 'テックデザイン合同会社', 'suzuki@example.com', '初めて', '見学後に判断希望'],
  ['103', '2026/08/03', '川口 陽平', '2026/08/06', '佐藤 健', 'サトウ タケシ', 'イベント企画', '佐藤企画', 'sato@example.com', '2回目', '再検討'],
  ['104', '2026/08/04', '渡辺 直樹', '2026/08/13', '伊藤 健太', 'イトウ ケンタ', '広告デザイン', 'クリエイト社', 'ito@example.com', '初めて', '次回参加予定']
];

$stmtV = $pdo->prepare("INSERT OR REPLACE INTO visitors (id, created_at, inviter, event_date, visitor_name, furigana, profession, company, email, attendance_count, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
foreach ($visitorsData as $v) {
    $stmtV->execute($v);
}

$statusData = [
  ['101', '参加', '未', '済', '未', '', $now],
  ['102', '参加', '未', '未', '未', '', $now],
  ['103', '参加', '未', '未', '未', '', $now],
  ['104', '未', '未', '未', '未', '', $now]
];

$stmtS = $pdo->prepare("INSERT OR REPLACE INTO visitors_status (visitor_id, is_attended, is_joined, is_1to1, is_matched, matching_note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
foreach ($statusData as $s) {
    $stmtS->execute($s);
}

$hearingData = [
  ['101', '鈴木 健二', '非常に良かった', '満足', 'あり', 'はい', '希望', '積極的', 'ぜひ入会を検討したい', 'A', '好感触', '1to1設定済み', '', $now],
  ['102', '田中 恵', '良かった', '普通', 'あり', '検討中', '希望', '普通', '見学後に判断', 'B', '検討段階', '', '', $now],
  ['103', '小山 哲夫', '普通', '普通', 'なし', '未定', 'なし', 'タイミング待ち', 'タイミングをみて再検討', 'C', '継続フォロー', '', '', $now]
];

$stmtH = $pdo->prepare("INSERT OR REPLACE INTO hearing_sheets (visitor_id, orient_user, q1, q2, q3, q4, q5, q6, q7, feel_abc, orient_memo, follow_memo, sheet_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
foreach ($hearingData as $h) {
    $stmtH->execute($h);
}

sendJsonResponse([
    'success' => true,
    'message' => 'SQLiteデータベースの初期データ投入が完了しました！'
]);
