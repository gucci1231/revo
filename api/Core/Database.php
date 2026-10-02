<?php
namespace Api\Core;

use PDO;
use Exception;

/**
 * DRY SQLite Database Driver
 * Handles connection, schema setup, CRUD operations, Upserts, and Transactions.
 */
class Database {
    private static ?Database $instance = null;
    private PDO $pdo;

    public function __construct(?string $dbPath = null) {
        $dbPath = $dbPath ?? __DIR__ . '/../data/database.sqlite';
        $dir = dirname($dbPath);
        if (!file_exists($dir)) {
            mkdir($dir, 0755, true);
        }

        $this->pdo = new PDO('sqlite:' . $dbPath);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        // Enable WAL mode for high concurrency & speed
        $this->pdo->exec("PRAGMA journal_mode = WAL;");

        $this->initSchema();
    }

    public static function getInstance(?string $dbPath = null): Database {
        if (self::$instance === null) {
            self::$instance = new Database($dbPath);
        }
        return self::$instance;
    }

    public function getPdo(): PDO {
        return $this->pdo;
    }

    private function initSchema(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS visitors (
                id TEXT PRIMARY KEY,
                created_at TEXT,
                inviter TEXT,
                event_date TEXT,
                visitor_name TEXT,
                furigana TEXT,
                profession TEXT,
                company TEXT,
                email TEXT,
                phone TEXT DEFAULT '',
                attendance_count TEXT DEFAULT '初めて',
                remarks TEXT DEFAULT '',
                category TEXT DEFAULT 'ビジター'
            );

            CREATE TABLE IF NOT EXISTS visitors_status (
                visitor_id TEXT PRIMARY KEY,
                is_attended TEXT DEFAULT '未',
                is_joined TEXT DEFAULT '未',
                is_1to1 TEXT DEFAULT '未',
                is_matched TEXT DEFAULT '未',
                matching_note TEXT DEFAULT '',
                follow_type TEXT DEFAULT '直近フォロー',
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS hearing_sheets (
                visitor_id TEXT PRIMARY KEY,
                orient_user TEXT DEFAULT '',
                q1 TEXT DEFAULT '',
                q2 TEXT DEFAULT '',
                q3 TEXT DEFAULT '',
                q4 TEXT DEFAULT '',
                q5 TEXT DEFAULT '',
                q6 TEXT DEFAULT '',
                q7 TEXT DEFAULT '',
                feel_abc TEXT DEFAULT '',
                orient_memo TEXT DEFAULT '',
                follow_memo TEXT DEFAULT '',
                sheet_url TEXT DEFAULT '',
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS members (
                id TEXT PRIMARY KEY,
                category TEXT DEFAULT 'その他',
                name TEXT,
                profession TEXT DEFAULT '',
                status TEXT DEFAULT '在籍',
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS action_plans (
                id TEXT PRIMARY KEY,
                visitor_id TEXT NOT NULL,
                due_date TEXT,
                assignee_name TEXT DEFAULT '',
                assignee_id TEXT DEFAULT '',
                action_type TEXT DEFAULT '',
                action_text TEXT NOT NULL,
                report_text TEXT DEFAULT '',
                reporter_name TEXT DEFAULT '',
                completed_by TEXT DEFAULT '',
                is_completed INTEGER DEFAULT 0,
                completed_at TEXT DEFAULT '',
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS email_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT DEFAULT 'welcome',
                subject TEXT NOT NULL,
                body TEXT NOT NULL,
                description TEXT DEFAULT '',
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS chapter_links (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                category TEXT DEFAULT 'メンバー情報',
                scope TEXT DEFAULT 'member',
                description TEXT DEFAULT '',
                icon TEXT DEFAULT 'fa-solid fa-link',
                sort_order INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS chapter_link_categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                icon TEXT DEFAULT 'fa-solid fa-folder',
                sort_order INTEGER DEFAULT 0,
                scope TEXT DEFAULT 'member',
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS chapter_link_scopes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT DEFAULT 'fa-solid fa-folder',
                sort_order INTEGER DEFAULT 0,
                is_system INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS palms_reports (
                id TEXT PRIMARY KEY,
                member_id TEXT NOT NULL,
                member_name TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                p_present INTEGER DEFAULT 0,
                a_absent INTEGER DEFAULT 0,
                l_late INTEGER DEFAULT 0,
                m_medical INTEGER DEFAULT 0,
                s_substitute INTEGER DEFAULT 0,
                rgi_referrals_given_internal INTEGER DEFAULT 0,
                rgo_referrals_given_external INTEGER DEFAULT 0,
                rri_referrals_received_internal INTEGER DEFAULT 0,
                rro_referrals_received_external INTEGER DEFAULT 0,
                v_visitors INTEGER DEFAULT 0,
                one_to_ones INTEGER DEFAULT 0,
                tyfcb_amount REAL DEFAULT 0.0,
                ceu INTEGER DEFAULT 0,
                testimonials INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                UNIQUE(member_id, start_date, end_date)
            );

            CREATE TABLE IF NOT EXISTS lottery_history (
                id TEXT PRIMARY KEY,
                member_id TEXT NOT NULL,
                member_name TEXT NOT NULL,
                award_title TEXT DEFAULT '',
                won_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS region_events (
                id INTEGER PRIMARY KEY,
                event_id_hash TEXT,
                title TEXT NOT NULL,
                description TEXT,
                event_type_id INTEGER DEFAULT 0,
                event_type_name TEXT DEFAULT '',
                start_datetime TEXT NOT NULL,
                end_datetime TEXT NOT NULL,
                location_name TEXT DEFAULT '',
                location_address TEXT DEFAULT '',
                location_map_url TEXT DEFAULT '',
                is_online INTEGER DEFAULT 0,
                cost_member TEXT DEFAULT '',
                cost_non_member TEXT DEFAULT '',
                contact_name TEXT DEFAULT '',
                contact_phone TEXT DEFAULT '',
                max_attendees INTEGER DEFAULT 0,
                num_registered INTEGER DEFAULT 0,
                detail_url TEXT DEFAULT '',
                registration_url TEXT DEFAULT '',
                body_html TEXT DEFAULT '',
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS chapter_events (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT DEFAULT 'チャプターイベント',
                start_datetime TEXT NOT NULL,
                end_datetime TEXT DEFAULT '',
                location_name TEXT DEFAULT '',
                location_url TEXT DEFAULT '',
                is_online INTEGER DEFAULT 0,
                organizer TEXT DEFAULT '',
                description TEXT DEFAULT '',
                recurrence_group_id TEXT DEFAULT '',
                recurrence_rule TEXT DEFAULT '',
                flyer_url TEXT DEFAULT '',
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS meeting_customizations (
                meeting_date TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT DEFAULT '定例会',
                is_online INTEGER DEFAULT 0,
                location_name TEXT DEFAULT '',
                location_url TEXT DEFAULT '',
                start_datetime TEXT DEFAULT '',
                end_datetime TEXT DEFAULT '',
                organizer TEXT DEFAULT '',
                description TEXT DEFAULT '',
                created_at TEXT,
                updated_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_action_plans_visitor_id ON action_plans(visitor_id);
            CREATE INDEX IF NOT EXISTS idx_palms_reports_member ON palms_reports(member_id);
            CREATE INDEX IF NOT EXISTS idx_palms_reports_dates ON palms_reports(start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_lottery_history_member ON lottery_history(member_id);
            CREATE INDEX IF NOT EXISTS idx_lottery_history_date ON lottery_history(won_at);
            CREATE INDEX IF NOT EXISTS idx_region_events_start ON region_events(start_datetime);
            CREATE INDEX IF NOT EXISTS idx_region_events_type ON region_events(event_type_id);
            CREATE INDEX IF NOT EXISTS idx_chapter_events_start ON chapter_events(start_datetime);
            CREATE INDEX IF NOT EXISTS idx_meeting_customizations_date ON meeting_customizations(meeting_date);
        ");

        try {
            $this->pdo->exec("ALTER TABLE action_plans ADD COLUMN action_type TEXT DEFAULT ''");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE action_plans ADD COLUMN report_text TEXT DEFAULT ''");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE action_plans ADD COLUMN reporter_name TEXT DEFAULT ''");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE visitors_status ADD COLUMN follow_type TEXT DEFAULT '直近フォロー'");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE action_plans ADD COLUMN completed_by TEXT DEFAULT ''");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE visitors ADD COLUMN category TEXT DEFAULT 'ビジター'");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE members ADD COLUMN status TEXT DEFAULT '在籍'");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("
                UPDATE visitors 
                SET category = 'ゲスト' 
                WHERE (
                    remarks LIKE '%予約: ゲスト%' 
                    OR remarks LIKE '%ユニコーンチャプター%' 
                    OR profession LIKE '%(ユニコーン)%' 
                    OR visitor_name LIKE 'メンバー%' 
                    OR (visitor_name = '豊田健司' AND company LIKE '%ライフ&ファイナンス%')
                ) AND (category IS NULL OR category = 'ビジター' OR category = '')
            ");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE visitors ADD COLUMN phone TEXT DEFAULT ''");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("
                UPDATE visitors 
                SET phone = TRIM(SUBSTR(remarks, INSTR(remarks, 'TEL: ') + 5, 
                                CASE WHEN INSTR(SUBSTR(remarks, INSTR(remarks, 'TEL: ') + 5), ' |') > 0 
                                     THEN INSTR(SUBSTR(remarks, INSTR(remarks, 'TEL: ') + 5), ' |') - 1
                                     ELSE LENGTH(SUBSTR(remarks, INSTR(remarks, 'TEL: ') + 5))
                                END))
                WHERE remarks LIKE '%TEL:%' AND (phone IS NULL OR phone = '');
            ");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE chapter_events ADD COLUMN recurrence_group_id TEXT DEFAULT ''");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE chapter_events ADD COLUMN recurrence_rule TEXT DEFAULT ''");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE chapter_events ADD COLUMN flyer_url TEXT DEFAULT ''");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_chapter_events_group ON chapter_events(recurrence_group_id);");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("
                UPDATE meeting_customizations 
                SET is_online = 1, location_name = 'Zoom オンライン' 
                WHERE (title = 'モメンタム' OR title LIKE '%通常%') 
                  AND (location_name LIKE '%通常定例会会場%' OR is_online = 0) 
                  AND meeting_date != '2026-11-19'
            ");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE chapter_links ADD COLUMN scope TEXT DEFAULT 'member'");
            $this->pdo->exec("UPDATE chapter_links SET scope = 'admin' WHERE category = '役員・チャプター運営'");
            $this->pdo->exec("UPDATE chapter_links SET scope = 'archive' WHERE category = 'アーカイブ'");
            $this->pdo->exec("UPDATE chapter_links SET scope = 'member' WHERE scope IS NULL OR scope = ''");
        } catch (\PDOException $e) {}

        $this->seedDefaultEmailTemplates();
        $this->seedDefaultLinks();
        $this->seedDefaultChapterEvents();
        $this->seedDefaultMeetingCustomizations();
    }

    private function seedDefaultEmailTemplates(): void {
        $now = date('Y/m/d H:i');
        $defaults = [
            [
                'id' => 'EMAIL_VISITOR_INTRO',
                'name' => '新規ビジター参加案内 (Welcome)',
                'category' => 'welcome',
                'description' => '初めてお申し込みいただいたビジター様へ送信する初回案内メールです。',
                'subject' => '【BNI REvoチャプター】定例会ご参加のお申し込みありがとうございます（{$event_date}開催）',
                'body' => '{$name} 様' . "\n\n" .
                    'はじめまして！BNI REvoチャプター ビジターホストチームです。' . "\n" .
                    'この度は、{$event_date} 開催の定例会へのお申し込みをいただき誠にありがとうございます！' . "\n\n" .
                    '【ご紹介者様】{$inviter} 様' . "\n" .
                    '【ご参加日】{$event_date}' . "\n\n" .
                    '当日は、{$name} 様のビジネス（{$profession}）の発展に繋がる素晴らしい出会いをご提供できるよう、メンバー一同心より歓迎いたします。' . "\n\n" .
                    '{$matching_status}' . "\n\n" .
                    '何かご不明点やご質問などございましたら、お気軽にこのメールへご返信ください。' . "\n" .
                    'それでは当日お会いできますことを楽しみにしております！'
            ],
            [
                'id' => 'EMAIL_GUEST_INTRO',
                'name' => '他チャプターゲスト参加案内 (Welcome)',
                'category' => 'welcome',
                'description' => '他チャプターからゲスト参加されるメンバー様向けの参加案内メールです。',
                'subject' => '【BNI REvoチャプター】ゲスト参加のお申し込みありがとうございます（{$event_date}開催）',
                'body' => '{$name} 様' . "\n\n" .
                    'BNI REvoチャプター ビジターホストチームです。' . "\n" .
                    'この度は、{$event_date} 開催のREvoチャプター定例会へゲスト参加のお申し込みをいただきありがとうございます！' . "\n\n" .
                    '【ご紹介者様】{$inviter} 様' . "\n" .
                    '【ご参加日】{$event_date}' . "\n\n" .
                    '他チャプター様との活発なビジネス交流ができる場をご用意してお待ちしております。' . "\n\n" .
                    '{$matching_status}' . "\n\n" .
                    '当日どうぞよろしくお願いいたします！'
            ],
            [
                'id' => 'EMAIL_REPEATER_INTRO',
                'name' => '再参加リピーター案内 (Welcome)',
                'category' => 'welcome',
                'description' => '2回目以降の参加となるリピータービジター様への参加案内メールです。',
                'subject' => '【BNI REvoチャプター】再度のご参加お申し込みありがとうございます（{$event_date}開催）',
                'body' => '{$name} 様' . "\n\n" .
                    'いつも大変お世話になっております！BNI REvoチャプター ビジターホストチームです。' . "\n" .
                    '{$event_date} の定例会に再びご参加いただけるとのこと、大変嬉しく思っております！' . "\n\n" .
                    '【ご参加日】{$event_date}' . "\n\n" .
                    '前回に引き続き、{$name} 様のビジネス発展に繋がる有意義な時間となるよう努めてまいります。' . "\n\n" .
                    '{$matching_status}' . "\n\n" .
                    '当日お会いできることをメンバー一同心よりお待ちしております！'
            ],
            [
                'id' => 'EMAIL_REMIND_2DAYS',
                'name' => '定例会 2日前リマインド',
                'category' => 'remind',
                'description' => '定例会開催の2日前に事前準備や日程のリマインドとして送信するメールです。',
                'subject' => '【リマインド】定例会開催まであと2日となりました（{$event_date}）',
                'body' => '{$name} 様' . "\n\n" .
                    'BNI REvoチャプター ビジターホストチームです。' . "\n" .
                    '{$event_date} 開催の定例会が、いよいよ明後日となりました！' . "\n\n" .
                    '【開催日時】{$event_date} 6:40受付開始 / 7:00開会' . "\n" .
                    '【メインプレゼンター】{$main_presenter} 様' . "\n" .
                    '【求めている紹介】{$wanted}' . "\n\n" .
                    '当日は名刺・筆記用具をご準備の上、お気をつけてお越しくださいませ。' . "\n" .
                    '皆様とお会いできるのを楽しみにしております。'
            ],
            [
                'id' => 'EMAIL_REMIND_1DAY',
                'name' => '定例会 前日リマインド',
                'category' => 'remind',
                'description' => '定例会開催の前日に最終確認として送信するメールです。',
                'subject' => '【明日開催】BNI REvoチャプター定例会のご案内（{$event_date}）',
                'body' => '{$name} 様' . "\n\n" .
                    'BNI REvoチャプター ビジターホストチームです。' . "\n" .
                    'いよいよ明日 {$event_date}、定例会が開催されます！' . "\n\n" .
                    '【開催日時】明日 {$event_date} 6:40受付開始 / 7:00開会' . "\n\n" .
                    '朝早い時間帯となりますが、充実したビジネス交流の場となるよう準備を整えております。' . "\n" .
                    '道中どうぞお気をつけてお越しください。' . "\n" .
                    '明日お会いできることを楽しみにしております！'
            ],
            [
                'id' => 'EMAIL_THANKS_ATTENDED',
                'name' => '定例会ご参加御礼メール',
                'category' => 'thanks',
                'description' => '定例会に参加いただいたビジター様へ当日に送信するお礼メールです。',
                'subject' => '【御礼】本日のBNI REvoチャプター定例会にご参加いただきありがとうございました',
                'body' => '{$name} 様' . "\n\n" .
                    '本日は朝早くからBNI REvoチャプターの定例会にご参加いただき、誠にありがとうございました！' . "\n\n" .
                    '{$name} 様とお話しでき、素晴らしいご縁をいただけましたこと、メンバー一同大変嬉しく思っております。' . "\n" .
                    '本日のミーティングはいかがでしたでしょうか？' . "\n\n" .
                    '定例会を通じて気になったメンバーや、さらに詳しく話してみたい業種がございましたら、ぜひお気軽に1to1（個別面談）をお申し付けください。' . "\n\n" .
                    'またお会いできることを楽しみにしております！'
            ],
            [
                'id' => 'EMAIL_THANKS_ABSENT',
                'name' => '定例会欠席フォローメール',
                'category' => 'thanks',
                'description' => '定例会を欠席されたビジター様へお見舞いと次回案内を兼ねて送信するメールです。',
                'subject' => '【BNI REvoチャプター】本日の定例会について（次回日程のご案内）',
                'body' => '{$name} 様' . "\n\n" .
                    'BNI REvoチャプター ビジターホストチームです。' . "\n" .
                    '本日はご都合がつかず残念でしたが、体調やお仕事の状況はいかがでしょうか？' . "\n\n" .
                    'またご都合の良い日程がございましたら、いつでも振替参加を歓迎しております！' . "\n" .
                    '次回以降の定例会日程についてもお気軽にお問い合わせください。' . "\n\n" .
                    '{$name} 様にお会いできる日をメンバー一同心待ちにしております。'
            ],
            [
                'id' => 'EMAIL_FOLLOW_7DAYS',
                'name' => '参加1週間後フォローメール',
                'category' => 'follow',
                'description' => '参加から1週間が経過したタイミングでビジネスの進捗や1to1の確認を行うフォローメールです。',
                'subject' => '【その後いかがでしょうか？】BNI REvoチャプターよりご挨拶',
                'body' => '{$name} 様' . "\n\n" .
                    '先週は定例会にご参加いただきありがとうございました！ビジターホストチームです。' . "\n\n" .
                    '定例会から1週間が経ちましたが、その後お仕事の状況はいかがでしょうか？' . "\n\n" .
                    '当チャプターのメンバーとの繋がりや、ビジネスに関するご相談など、何かお役に立てることがあればいつでもお声がけください。' . "\n\n" .
                    'また次回の定例会へのご参加も大歓迎です！'
            ],
            [
                'id' => 'EMAIL_FOLLOW_30DAYS',
                'name' => '参加1ヶ月後フォローメール',
                'category' => 'follow',
                'description' => '参加から1ヶ月が経過したタイミングでの定期フォロー・リコネクトメールです。',
                'subject' => '【定期フォロー】BNI REvoチャプターより近況のお伺い',
                'body' => '{$name} 様' . "\n\n" .
                    '先月は当チャプター定例会へご参加いただき誠にありがとうございました。' . "\n" .
                    '早いもので定例会から1ヶ月が経過いたしました。' . "\n\n" .
                    '{$name} 様のビジネス（{$profession}）において、新たなリファーラル（紹介）やビジネスマッチングのお手伝いができる機会がございましたら幸いです。' . "\n\n" .
                    'ぜひまたチャプター定例会へも遊びにいらしてください！'
            ]
        ];

        // Check if templates need update / repair
        $sample = $this->fetchOne("SELECT body FROM email_templates WHERE id = 'EMAIL_VISITOR_INTRO'");
        if (!$sample || str_contains($sample['subject'] ?? '', 'レボリューション') || str_contains($sample['body'] ?? '', 'レボリューション') || !str_contains($sample['body'] ?? '', '{$name}')) {
            foreach ($defaults as $tmpl) {
                $this->upsert('email_templates', [
                    'id' => $tmpl['id'],
                    'name' => $tmpl['name'],
                    'category' => $tmpl['category'],
                    'description' => $tmpl['description'],
                    'subject' => $tmpl['subject'],
                    'body' => $tmpl['body'],
                    'updated_at' => $now
                ], ['id']);
            }
        }
    }

    public function fetchOne(string $sql, array $params = []): ?array {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch();
        return $result !== false ? $result : null;
    }

    public function fetchAll(string $sql, array $params = []): array {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function fetchColumn(string $sql, array $params = []): mixed {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    public function execute(string $sql, array $params = []): int {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public function insert(string $table, array $data): int {
        $cols = array_keys($data);
        $escapedCols = array_map(fn($c) => "`{$c}`", $cols);
        $placeholders = array_fill(0, count($cols), '?');
        $sql = sprintf(
            "INSERT INTO `%s` (%s) VALUES (%s)",
            $table,
            implode(', ', $escapedCols),
            implode(', ', $placeholders)
        );
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(array_values($data));
        return $stmt->rowCount();
    }

    public function update(string $table, array $data, string $where, array $whereParams = []): int {
        $sets = array_map(fn($col) => "`{$col}` = ?", array_keys($data));
        $sql = sprintf(
            "UPDATE `%s` SET %s WHERE %s",
            $table,
            implode(', ', $sets),
            $where
        );
        $params = array_merge(array_values($data), $whereParams);
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public function upsert(string $table, array $data, array $uniqueKeys): bool {
        $whereClauses = [];
        $whereParams = [];
        foreach ($uniqueKeys as $uKey) {
            $whereClauses[] = "`{$uKey}` = ?";
            $whereParams[] = $data[$uKey] ?? null;
        }
        $whereSql = implode(' AND ', $whereClauses);

        $exists = (int)$this->fetchColumn(sprintf("SELECT COUNT(*) FROM `%s` WHERE %s", $table, $whereSql), $whereParams);
        if ($exists > 0) {
            $updateCols = array_diff(array_keys($data), $uniqueKeys);
            if (empty($updateCols)) {
                return true; // Nothing to update
            }
            $updateData = [];
            foreach ($updateCols as $col) {
                $updateData[$col] = $data[$col];
            }
            return $this->update($table, $updateData, $whereSql, $whereParams) >= 0;
        } else {
            return $this->insert($table, $data) > 0;
        }
    }

    private function seedDefaultLinks(): void {
        $now = date('Y/m/d H:i');
        $defaults = [
            [
                'id' => 'LINK_001',
                'title' => 'みんなの1to1シート一覧',
                'url' => 'https://drive.google.com/drive/u/0/folders/1bwoAXDGv18sxVG5IEM46VpoqZhTgnMFP',
                'category' => '日常・1to1',
                'description' => 'みんなの1to1シート一覧',
                'icon' => 'fa-regular fa-handshake',
                'sort_order' => 1
            ],
            [
                'id' => 'LINK_002',
                'title' => 'メンバー写真一覧',
                'url' => 'https://drive.google.com/drive/u/0/folders/17aw58dojPTr1TQkMfkBDjDptxJbkcMm7',
                'category' => '日常・1to1',
                'description' => 'みんなの写真一覧',
                'icon' => 'fa-solid fa-camera-retro',
                'sort_order' => 2
            ],
            [
                'id' => 'LINK_003',
                'title' => 'メンバー一覧表',
                'url' => 'https://drive.google.com/drive/u/0/folders/16tXv60ZDqJcPw-8vJ5xXDYguc8lDqLXJ',
                'category' => '日常・1to1',
                'description' => 'チャプターメンバー名簿・業種一覧',
                'icon' => 'fa-solid fa-users',
                'sort_order' => 3
            ],
            [
                'id' => 'LINK_004',
                'title' => 'ZOOM背景',
                'url' => 'https://drive.google.com/drive/u/0/folders/1jCV5Q-DeJ0dCY2n_yvhPUfXEIrUAQjMn',
                'category' => '日常・1to1',
                'description' => '定例会・イベント用 公式バーチャル背景',
                'icon' => 'fa-solid fa-image',
                'sort_order' => 4
            ],
            [
                'id' => 'LINK_005',
                'title' => '名札',
                'url' => 'https://drive.google.com/drive/u/0/folders/1WJAbhCfPHwaAVLe6TiVV7-sasHJHFTZh',
                'category' => '日常・1to1',
                'description' => '名札のデータです',
                'icon' => 'fa-solid fa-id-badge',
                'sort_order' => 5
            ],
            [
                'id' => 'LINK_006',
                'title' => 'みんなのメインプレゼン一覧',
                'url' => 'https://drive.google.com/drive/u/0/folders/1KV1YRIp5h-SfHG-Wu-diYCxu7kDcVjWr',
                'category' => '日常・1to1',
                'description' => 'みんなのメインプレゼンをまとめてるよ',
                'icon' => 'fa-solid fa-chalkboard-user',
                'sort_order' => 6
            ],
            [
                'id' => 'LINK_007',
                'title' => 'みんなのウィークリー一覧',
                'url' => 'https://drive.google.com/drive/u/0/folders/1DyBR3qmTM5NgUK8J5mc65Jh74kBX-gRv',
                'category' => '日常・1to1',
                'description' => 'みんなのウィークリーをまとめてるよ',
                'icon' => 'fa-solid fa-bullhorn',
                'sort_order' => 7
            ],
            [
                'id' => 'LINK_008',
                'title' => '金の卵・金のガチョウ',
                'url' => 'https://drive.google.com/drive/folders/1DbVAH4cJk3l6KFb186bzcLzP4KuUFzvO',
                'category' => '日常・1to1',
                'description' => 'リファーラル協業パートナー検討資料',
                'icon' => 'fa-solid fa-egg',
                'sort_order' => 8
            ],
            [
                'id' => 'LINK_009',
                'title' => 'REvoロゴ',
                'url' => 'https://drive.google.com/drive/u/0/folders/1GvX7evY-iEH7g-7iNJvyn1Oq9mrx32nc',
                'category' => '日常・1to1',
                'description' => 'チャプター公式ロゴ画像・ベクターデータ',
                'icon' => 'fa-solid fa-shapes',
                'sort_order' => 9
            ],
            [
                'id' => 'LINK_010',
                'title' => 'REvo ZOOM',
                'url' => 'https://bnionline.zoom.us/j/3763093298',
                'category' => '日常・1to1',
                'description' => '毎週木曜 定例会ZOOMミーティングルーム',
                'icon' => 'fa-solid fa-video',
                'sort_order' => 10
            ],
            [
                'id' => 'LINK_011',
                'title' => 'アジェンダ',
                'url' => 'https://docs.google.com/spreadsheets/d/1ea5frKk2UYvnwZiRF2Cn2EgHuQHOrQMk/edit?gid=1883308143#gid=1883308143',
                'category' => '役員・チャプター運営',
                'description' => '定例会タイムスケジュール・進行スクリプト',
                'icon' => 'fa-solid fa-list-check',
                'sort_order' => 11
            ],
            [
                'id' => 'LINK_012',
                'title' => '40人リスト',
                'url' => 'https://docs.google.com/spreadsheets/d/1dgP_ujSsJqE_i2h-4DUO_Dzjx5rdSt7v/edit?gid=663418881#gid=663418881',
                'category' => '役員・チャプター運営',
                'description' => 'チャプター40人達成に向けたメンバー推薦リスト',
                'icon' => 'fa-solid fa-bullseye',
                'sort_order' => 12
            ],
            [
                'id' => 'LINK_013',
                'title' => 'ビジター申込状況',
                'url' => 'https://docs.google.com/spreadsheets/d/1-AWautt52j8nOT1VI5ofneGdyrKdiJudnuOqGvpezjs/edit?resourcekey=&gid=31160410#gid=31160410',
                'category' => 'ビジター・入会',
                'description' => '定例会ごとのビジター参加予定・回答状況一覧',
                'icon' => 'fa-solid fa-table-list',
                'sort_order' => 13
            ],
            [
                'id' => 'LINK_014',
                'title' => 'ビジター申込フォーム',
                'url' => 'https://docs.google.com/forms/d/e/1FAIpQLSdl7oDKf79Ohd6dgR_YWIlAMjrfEJEJTng2AryQQYLC8AdUMg/viewform?usp=send_form',
                'category' => 'ビジター・入会',
                'description' => 'ビジター招待用 公式参加申込みフォーム',
                'icon' => 'fa-solid fa-file-pen',
                'sort_order' => 14
            ],
            [
                'id' => 'LINK_015',
                'title' => 'BOR表',
                'url' => 'https://docs.google.com/spreadsheets/d/1Kk_ZkpMVhe1KBqtdVLw1ZVaumvLZdmnYNqYGk3piioU/edit?gid=1432961932#gid=1432961932',
                'category' => '役員・チャプター運営',
                'description' => '定例会ブレイクアウトルーム参加者割当表',
                'icon' => 'fa-solid fa-arrows-split-up-and-left',
                'sort_order' => 15
            ],
            [
                'id' => 'LINK_016',
                'title' => 'ヒアリングシート',
                'url' => 'https://drive.google.com/drive/u/0/folders/1fZjotMxSCHn9DPWlEtnGvLgVS5GXipHP',
                'category' => 'ビジター・入会',
                'description' => 'ビジター事後フォロー・ヒアリング記録シート',
                'icon' => 'fa-solid fa-clipboard-question',
                'sort_order' => 16
            ],
            [
                'id' => 'LINK_017',
                'title' => 'チャプターモニタリング8月',
                'url' => 'https://docs.google.com/spreadsheets/d/16giVWMKTbUSRMx0otvGwBPedB08a1uvjMkCvGtoVPsQ/edit?gid=473843505#gid=473843505',
                'category' => '役員・チャプター運営',
                'description' => 'チャプター健康度・トラフィックモニタリング指標',
                'icon' => 'fa-solid fa-chart-line',
                'sort_order' => 17
            ],
            [
                'id' => 'LINK_018',
                'title' => 'メンバートラフィックライト8月',
                'url' => 'https://docs.google.com/spreadsheets/d/1MQ9T5ddhUCowEKH0JOKGBRe07fSeaZJl/edit?gid=765074533#gid=765074533',
                'category' => '役員・チャプター運営',
                'description' => 'メンバー成績・トラフィックライトスコア',
                'icon' => 'fa-solid fa-traffic-light',
                'sort_order' => 18
            ],
            [
                'id' => 'LINK_019',
                'title' => 'REvo S3 役職者',
                'url' => 'https://docs.google.com/spreadsheets/d/1julCKv0NSYd4mPYv6QEcZjumpFjk_RSp/edit?gid=1522606302#gid=1522606302',
                'category' => '役員・チャプター運営',
                'description' => '第3期 役員・タスクフォース役割分担表',
                'icon' => 'fa-solid fa-user-tie',
                'sort_order' => 19
            ],
            [
                'id' => 'LINK_020',
                'title' => 'REvo内規',
                'url' => 'https://drive.google.com/file/d/1ugEcdMEuGzqZzdPJv4iFquFdSayoll47/view?usp=share_link',
                'category' => '役員・チャプター運営',
                'description' => 'REvoチャプター公式内規・運営ガイドライン',
                'icon' => 'fa-solid fa-shield-halved',
                'sort_order' => 20
            ],
            [
                'id' => 'LINK_021',
                'title' => '定例会スライド',
                'url' => 'https://onedrive.live.com/?view=1',
                'category' => '日常・1to1',
                'description' => '今週の定例会プレゼンテーションスライド',
                'icon' => 'fa-solid fa-person-chalkboard',
                'sort_order' => 21
            ],
            [
                'id' => 'LINK_022',
                'title' => 'パスポートプログラム星取表',
                'url' => 'https://docs.google.com/spreadsheets/d/1nKd5ZnhRsgTIsEHgKloSu2osuaYEgC5YzqFK1bMDjUE/edit?gid=1329149645#gid=1329149645',
                'category' => '公式ポータル・学び',
                'description' => '新メンバー パスポートプログラム履修状況',
                'icon' => 'fa-solid fa-star',
                'sort_order' => 22
            ],
            [
                'id' => 'LINK_023',
                'title' => '1to1シート（マスターテンプレート）',
                'url' => 'https://docs.google.com/spreadsheets/d/18zZmf9AzdZGWcx0yAndnCZi3dYlwYq9lX_0DaXX9ycA/edit?gid=0#gid=0',
                'category' => '日常・1to1',
                'description' => '1to1ミーティング用 標準テンプレートシート',
                'icon' => 'fa-regular fa-handshake',
                'sort_order' => 23
            ],
            [
                'id' => 'LINK_024',
                'title' => '略歴シート マスター',
                'url' => 'https://drive.google.com/drive/u/0/folders/1PKW-iQRei6lka38COLT-6gGaeNpzN8di',
                'category' => '日常・1to1',
                'description' => '新メンバー略歴シートのマスター書式',
                'icon' => 'fa-solid fa-address-card',
                'sort_order' => 24
            ],
            [
                'id' => 'LINK_025',
                'title' => 'オリエンシートマスター',
                'url' => 'https://docs.google.com/spreadsheets/d/1SSQzN1aVpoFxKDxKZZakz_f7v1_1J_HkCNyVy3opvuc/edit?gid=0#gid=0',
                'category' => 'ビジター・入会',
                'description' => '新入会メンバー オリエンテーション手順・雛形',
                'icon' => 'fa-solid fa-compass',
                'sort_order' => 25
            ],
            [
                'id' => 'LINK_026',
                'title' => 'エデュケーション',
                'url' => 'https://drive.google.com/drive/u/0/folders/1TDj09MNeHSPTvomZ_pOczZtik800W8bl',
                'category' => '公式ポータル・学び',
                'description' => 'ネットワーキング学習資料・プレゼンアーカイブ',
                'icon' => 'fa-solid fa-graduation-cap',
                'sort_order' => 26
            ],
            [
                'id' => 'LINK_027',
                'title' => 'ダイヤモンドグロース資料',
                'url' => 'https://drive.google.com/drive/u/0/folders/1-U3ML5u0gCNfodGRa2NUJ1xpTMnDmyhD',
                'category' => '役員・チャプター運営',
                'description' => 'チャプター拡大・グロース戦略資料',
                'icon' => 'fa-solid fa-gem',
                'sort_order' => 27
            ],
            [
                'id' => 'LINK_028',
                'title' => 'BODチーム編成',
                'url' => 'https://docs.google.com/spreadsheets/d/1Da3eWIov2wmYaiGmDJqZGG0AubUmNWRnFWJpS1EC2z0/edit?gid=1590356613#gid=1590356613',
                'category' => '役員・チャプター運営',
                'description' => 'ビジネスオープンデー（BOD）運営チーム体制表',
                'icon' => 'fa-solid fa-gem',
                'sort_order' => 28
            ],
            [
                'id' => 'LINK_029',
                'title' => '令和のBODマニュアル2',
                'url' => 'https://docs.google.com/spreadsheets/d/1uab1cwUSSTb0XS805-wSpZe3kMvdHMD6wQpy8Al1vr0/edit?usp=sharing',
                'category' => '役員・チャプター運営',
                'description' => 'BOD企画・集客・運営実践マニュアル',
                'icon' => 'fa-solid fa-gem',
                'sort_order' => 29
            ],
            [
                'id' => 'LINK_030',
                'title' => '7月16日参加申込みフォーム',
                'url' => 'https://docs.google.com/forms/d/e/1FAIpQLSdw13aK8hU4x20C-sKxEQUPZBPQ1-kCv5MeCO6i8XKqtdKzZw/viewform',
                'category' => 'アーカイブ',
                'description' => '過去定例会参加申込フォーム（2026/7/16）',
                'icon' => 'fa-solid fa-box-archive',
                'sort_order' => 30
            ],
            [
                'id' => 'LINK_031',
                'title' => '7月30日参加申込みフォーム',
                'url' => 'https://forms.gle/TD8FmGeaqqijLkdo8',
                'category' => 'アーカイブ',
                'description' => '過去定例会参加申込フォーム（2026/7/30）',
                'icon' => 'fa-solid fa-box-archive',
                'sort_order' => 31
            ],
            [
                'id' => 'LINK_032',
                'title' => 'ビジホスレボリューション',
                'url' => 'https://revo.k-d-o.biz/#dashboard',
                'category' => 'ビジター・入会',
                'description' => 'ビジターホスト統合管理ダッシュボード',
                'icon' => 'fa-solid fa-gauge-high',
                'sort_order' => 32
            ],
            [
                'id' => 'LINK_033',
                'title' => 'ビジホスマニュアル',
                'url' => 'https://docs.google.com/spreadsheets/d/1kTcsFR7go_6bLUCUg7o44FmtIw3I-K3J/edit?gid=663418881#gid=663418881',
                'category' => 'ビジター・入会',
                'description' => 'ビジホス業務手順・定例会当日の動き方',
                'icon' => 'fa-solid fa-book-open',
                'sort_order' => 33
            ],
            [
                'id' => 'LINK_034',
                'title' => 'CEUポイント表',
                'url' => 'https://drive.google.com/file/d/16lV2G1kS2sTyCe0syHBIHM2ncEXGh3Ag/view?usp=share_link',
                'category' => '公式ポータル・学び',
                'description' => 'BNI学習ユニット（CEU）獲得基準・ポイント表',
                'icon' => 'fa-solid fa-award',
                'sort_order' => 34
            ],
            [
                'id' => 'LINK_035',
                'title' => '５つの基本',
                'url' => 'https://drive.google.com/file/d/16lV2G1kS2sTyCe0syHBIHM2ncEXGh3Ag/view?usp=sharing',
                'category' => '公式ポータル・学び',
                'description' => 'チャプター活動で成果を出すための5つの行動原則',
                'icon' => 'fa-solid fa-compass',
                'sort_order' => 35
            ],
            [
                'id' => 'LINK_036',
                'title' => 'リファーラルレベル５段階',
                'url' => 'https://drive.google.com/file/d/11IcEMav-3L9sH2IjwijaSjrmPpVoZa-5/view?usp=share_link',
                'category' => '公式ポータル・学び',
                'description' => 'リファーラルに悩んだらこれ',
                'icon' => 'fa-solid fa-arrows-turn-to-dots',
                'sort_order' => 36
            ],
            [
                'id' => 'LINK_037',
                'title' => '運営マニュアル',
                'url' => 'https://drive.google.com/drive/u/0/folders/19OuFXDXwfvGVobzWs7DqtA15v7M_G5-X',
                'category' => '役員・チャプター運営',
                'description' => 'チャプター運営総合マニュアル・ガイドライン',
                'icon' => 'fa-solid fa-book-bookmark',
                'sort_order' => 37
            ],
            [
                'id' => 'LINK_038',
                'title' => '申込書PDF',
                'url' => 'https://drive.google.com/file/d/1fymAM8_LZ3IRxRzfYJwGUThMIJpCJ5Dn/view?usp=share_link',
                'category' => 'ビジター・入会',
                'description' => '入会申込書（印刷・手書き用PDF）',
                'icon' => 'fa-solid fa-file-pdf',
                'sort_order' => 38
            ],
            [
                'id' => 'LINK_039',
                'title' => 'メンバーシップ申込フォーム',
                'url' => 'https://bni-ck.com/revo/ja/applicationregistration?chapterId=42376',
                'category' => 'ビジター・入会',
                'description' => '入会希望者向け オンライン入会申請フォーム',
                'icon' => 'fa-solid fa-file-signature',
                'sort_order' => 39
            ],
            [
                'id' => 'LINK_040',
                'title' => 'Paypal 1年申し込み',
                'url' => 'https://www.paypal.com/ncp/payment/5CUEDN36KJ9DE',
                'category' => 'ビジター・入会',
                'description' => 'PayPalアカウントをお持ちでない方は、アカウントを作成後申し込みできます。',
                'icon' => 'fa-brands fa-paypal',
                'sort_order' => 40
            ],
            [
                'id' => 'LINK_041',
                'title' => 'Paypal 2年申し込み',
                'url' => 'https://www.paypal.com/ncp/payment/G2RUVGXC59FZL',
                'category' => 'ビジター・入会',
                'description' => 'アカウントは、「法人」と「個人」がありますが、「法人」は作成に時間がかかるため「個人」で作成して下さい。',
                'icon' => 'fa-brands fa-paypal',
                'sort_order' => 41
            ],
            [
                'id' => 'LINK_042',
                'title' => 'MSP / トレーニング',
                'url' => 'https://drive.google.com/drive/folders/1y9LOiK1ydHNqDFtP028vW2JS7fZN3HJ2?usp=share_link',
                'category' => '役員・チャプター運営',
                'description' => 'MSPに関するマニュアル、トレーニング受講時のノートをまとめるフォルダです',
                'icon' => 'fa-solid fa-user-graduate',
                'sort_order' => 42
            ],
            [
                'id' => 'LINK_043',
                'title' => '→ 受講状況を確認する方法 NEW',
                'url' => 'https://drive.google.com/file/d/1Mf2zihVC927D1MJtntCLrQWfFZ_VyYir/view?usp=share_link',
                'category' => '役員・チャプター運営',
                'description' => 'アカデミーのReport から メンバーのMSP / アドオンの受講状況を検索する方法',
                'icon' => 'fa-solid fa-user-graduate',
                'sort_order' => 43
            ],
            [
                'id' => 'LINK_044',
                'title' => 'トピックメンター',
                'url' => 'https://drive.google.com/drive/u/0/folders/14reQwl7WN9TLoqwY_k9ilEW5GhFVOXwQ',
                'category' => '公式ポータル・学び',
                'description' => 'トピックメンターに関する各種マニュアル類',
                'icon' => 'fa-solid fa-user-ninja',
                'sort_order' => 44
            ],
            [
                'id' => 'LINK_045',
                'title' => 'Webマニュアル',
                'url' => 'https://drive.google.com/drive/u/0/folders/1kiOxgnQWwHWYIvsH_FtC34kTrn8T3Sos',
                'category' => '公式ポータル・学び',
                'description' => 'コネクトの使い方などのマニュアル類',
                'icon' => 'fa-solid fa-desktop',
                'sort_order' => 45
            ],
            [
                'id' => 'LINK_046',
                'title' => 'TLT(TeamLeadersTraining)',
                'url' => 'https://drive.google.com/file/d/1mPUchOh7vxcWKoRYeqjrSyTWkoBFm0nN/view?usp=sharing',
                'category' => '役員・チャプター運営',
                'description' => '重要なマインドセット、アジェンダの本質、各役職の役割を網羅',
                'icon' => 'fa-solid fa-book-bookmark',
                'sort_order' => 46
            ],
            [
                'id' => 'LINK_047',
                'title' => 'BOD(BuissinessOpenDay)',
                'url' => 'https://drive.google.com/file/d/1J-Uc93tCGsYweQng7vQPrjraoabn0C7i/view?usp=share_link',
                'category' => '役員・チャプター運営',
                'description' => 'BOD当日のスライド',
                'icon' => 'fa-solid fa-gem',
                'sort_order' => 47
            ],
            [
                'id' => 'LINK_048',
                'title' => 'bni.jp',
                'url' => 'http://bni.jp/',
                'category' => '公式ポータル・学び',
                'description' => 'BNIジャパン 公式ポータルサイト',
                'icon' => 'fa-solid fa-globe',
                'sort_order' => 48
            ],
            [
                'id' => 'LINK_049',
                'title' => '京都CCリージョンHP',
                'url' => 'https://bni-ck.com/',
                'category' => '公式ポータル・学び',
                'description' => '京都シティセントラル リージョン公式ポータル',
                'icon' => 'fa-solid fa-globe',
                'sort_order' => 49
            ],
            [
                'id' => 'LINK_050',
                'title' => '京都CC イベント・トレーニング',
                'url' => 'https://bni-ck.com/ja/events',
                'category' => '公式ポータル・学び',
                'description' => 'リージョン主催トレーニング・ワークショップ日程',
                'icon' => 'fa-solid fa-calendar-days',
                'sort_order' => 50
            ],
            [
                'id' => 'LINK_051',
                'title' => 'BNI全国トレーニング一覧サイト',
                'url' => 'https://bni-traning.develop-site.net/',
                'category' => '公式ポータル・学び',
                'description' => '全国オンライン研修・MSPスケジュール',
                'icon' => 'fa-solid fa-calendar-days',
                'sort_order' => 51
            ],
            [
                'id' => 'LINK_052',
                'title' => 'BNI スマートガイド',
                'url' => 'http://welcome.bni.jp/',
                'category' => '公式ポータル・学び',
                'description' => '初めてのメンバー向け スタートガイド・マニュアル',
                'icon' => 'fa-solid fa-globe',
                'sort_order' => 52
            ],
            [
                'id' => 'LINK_053',
                'title' => 'BNI コネクト',
                'url' => 'http://www.bniconnectglobal.com/',
                'category' => '公式ポータル・学び',
                'description' => 'BNI Connect Global（リファーラル・実績入力）',
                'icon' => 'fa-solid fa-network-wired',
                'sort_order' => 53
            ],
            [
                'id' => 'LINK_054',
                'title' => 'BNI アカデミー',
                'url' => 'https://www.bniglobalacademy.com/',
                'category' => '公式ポータル・学び',
                'description' => 'BNI Business Builder（オンライン学習・CEU）',
                'icon' => 'fa-solid fa-graduation-cap',
                'sort_order' => 54
            ],
            [
                'id' => 'LINK_055',
                'title' => 'BNI ポッドキャスト',
                'url' => 'http://bnipodcast.jp/',
                'category' => '公式ポータル・学び',
                'description' => 'BNI公式ポッドキャスト（移動中に聴くナレッジ）',
                'icon' => 'fa-solid fa-podcast',
                'sort_order' => 55
            ],
            [
                'id' => 'LINK_056',
                'title' => 'BNI ジャパンブログ',
                'url' => 'http://blog.bni.jp/',
                'category' => '公式ポータル・学び',
                'description' => '全国の成功事例・ストーリー・公式ブログ',
                'icon' => 'fa-solid fa-newspaper',
                'sort_order' => 56
            ],
            [
                'id' => 'LINK_057',
                'title' => 'BNI リファーラルマーケティングブログ',
                'url' => 'http://referralmarketing.jp/',
                'category' => '公式ポータル・学び',
                'description' => '紹介マーケティングの実践ノウハウ',
                'icon' => 'fa-solid fa-newspaper',
                'sort_order' => 57
            ]
        ];

        foreach ($defaults as $link) {
            $exists = $this->fetchColumn("SELECT COUNT(*) FROM chapter_links WHERE id = ?", [$link['id']]);
            if ((int)$exists === 0) {
                $this->insert('chapter_links', [
                    'id' => $link['id'],
                    'title' => $link['title'],
                    'url' => $link['url'],
                    'category' => $link['category'],
                    'description' => $link['description'],
                    'icon' => $link['icon'],
                    'sort_order' => $link['sort_order'],
                    'created_at' => $now,
                    'updated_at' => $now
                ]);
            }
        }

        $this->seedDefaultLinkCategories();
        $this->seedDefaultLinkScopes();
    }

    private function seedDefaultLinkScopes(): void {
        $now = date('Y/m/d H:i');
        $initialScopes = [
            ['id' => 'member', 'name' => 'メンバー用 (日常・学び)', 'icon' => 'fa-solid fa-users', 'sort_order' => 10, 'is_system' => 1],
            ['id' => 'admin', 'name' => '役員・運営用', 'icon' => 'fa-solid fa-user-gear', 'sort_order' => 20, 'is_system' => 1],
            ['id' => 'archive', 'name' => 'アーカイブ', 'icon' => 'fa-solid fa-box-archive', 'sort_order' => 30, 'is_system' => 1],
        ];

        foreach ($initialScopes as $scope) {
            $exists = $this->fetchColumn("SELECT COUNT(*) FROM chapter_link_scopes WHERE id = ?", [$scope['id']]);
            if ((int)$exists === 0) {
                $this->insert('chapter_link_scopes', [
                    'id' => $scope['id'],
                    'name' => $scope['name'],
                    'icon' => $scope['icon'],
                    'sort_order' => $scope['sort_order'],
                    'is_system' => $scope['is_system'],
                    'created_at' => $now,
                    'updated_at' => $now
                ]);
            }
        }
    }

    private function seedDefaultLinkCategories(): void {
        $now = date('Y/m/d H:i');
        $initialCategories = [
            ['id' => 'CAT_VISITOR', 'name' => 'ビジター情報', 'icon' => 'fa-solid fa-user-plus', 'sort_order' => 10, 'scope' => 'member'],
            ['id' => 'CAT_MEMBER', 'name' => 'メンバー情報', 'icon' => 'fa-solid fa-users', 'sort_order' => 20, 'scope' => 'member'],
            ['id' => 'CAT_LEARN', 'name' => '公式ポータル・学び', 'icon' => 'fa-solid fa-graduation-cap', 'sort_order' => 30, 'scope' => 'member'],
            ['id' => 'CAT_ADMIN', 'name' => '役員・チャプター運営', 'icon' => 'fa-solid fa-user-gear', 'sort_order' => 40, 'scope' => 'admin'],
            ['id' => 'CAT_ASSETS', 'name' => 'アセット関連', 'icon' => 'fa-solid fa-folder-open', 'sort_order' => 50, 'scope' => 'member'],
            ['id' => 'CAT_ARCHIVE', 'name' => 'アーカイブ', 'icon' => 'fa-solid fa-box-archive', 'sort_order' => 60, 'scope' => 'archive'],
        ];

        foreach ($initialCategories as $cat) {
            $exists = $this->fetchColumn("SELECT COUNT(*) FROM chapter_link_categories WHERE id = ? OR name = ?", [$cat['id'], $cat['name']]);
            if ((int)$exists === 0) {
                $this->insert('chapter_link_categories', [
                    'id' => $cat['id'],
                    'name' => $cat['name'],
                    'icon' => $cat['icon'],
                    'sort_order' => $cat['sort_order'],
                    'scope' => $cat['scope'],
                    'created_at' => $now,
                    'updated_at' => $now
                ]);
            }
        }

        // Migrate legacy categories in chapter_links
        $this->execute("UPDATE chapter_links SET category = 'ビジター情報' WHERE category = 'ビジター・入会'");
        $assetIds = "'LINK_002','LINK_004','LINK_005','LINK_009','LINK_021','LINK_023','LINK_024'";
        $this->execute("UPDATE chapter_links SET category = 'アセット関連' WHERE id IN ($assetIds)");
        $this->execute("UPDATE chapter_links SET category = 'メンバー情報' WHERE category = '日常・1to1'");
    }

    private function seedDefaultChapterEvents(): void {
        try {
            $seeded = $this->fetchColumn("SELECT value FROM settings WHERE key = 'seeded_default_chapter_events'");
            if ($seeded === '1') {
                return;
            }
        } catch (\Exception $e) {}

        $now = date('Y/m/d H:i');
        $defaults = [
            [
                'id' => 'CH_EV_EXEC_202610',
                'title' => '第4期 役員会・リーダーシップミーティング',
                'category' => '役員会',
                'start_datetime' => '2026-10-14 19:00:00',
                'end_datetime' => '2026-10-14 21:00:00',
                'location_name' => 'オンライン (Zoom)',
                'location_url' => 'https://zoom.us',
                'is_online' => 1,
                'organizer' => '桐原 プレジデント',
                'description' => '月次目標進捗確認、各タスクチーム課題共有、次月イベント企画協議'
            ],
            [
                'id' => 'CH_EV_PARTY_202610',
                'title' => 'REvoチャプター 秋の大懇親会＆新入会歓迎会',
                'category' => '懇親会',
                'start_datetime' => '2026-10-23 19:30:00',
                'end_datetime' => '2026-10-23 21:30:00',
                'location_name' => '烏丸四条 会場 (京都)',
                'location_url' => '',
                'is_online' => 0,
                'organizer' => 'イベント委員会',
                'description' => 'メンバー間の親睦・信頼関係（Givers Gain）を深めるリアル懇親会'
            ],
            [
                'id' => 'CH_EV_BOD_202611',
                'title' => '秋のビジネスオープンデー（定例会特別拡大版）',
                'category' => 'ビジネスオープンデー',
                'start_datetime' => '2026-11-05 06:45:00',
                'end_datetime' => '2026-11-05 09:30:00',
                'location_name' => '通常定例会会場 & Zoom',
                'location_url' => '',
                'is_online' => 0,
                'organizer' => 'REvoチャプター全員',
                'description' => '多数のビジターをお招きし、各業界のプロフェッショナルを紹介する特別定例会'
            ]
        ];

        foreach ($defaults as $ev) {
            $exists = $this->fetchColumn("SELECT COUNT(*) FROM chapter_events WHERE id = ?", [$ev['id']]);
            if ((int)$exists === 0) {
                $this->insert('chapter_events', [
                    'id' => $ev['id'],
                    'title' => $ev['title'],
                    'category' => $ev['category'],
                    'start_datetime' => $ev['start_datetime'],
                    'end_datetime' => $ev['end_datetime'],
                    'location_name' => $ev['location_name'],
                    'location_url' => $ev['location_url'],
                    'is_online' => $ev['is_online'],
                    'organizer' => $ev['organizer'],
                    'description' => $ev['description'],
                    'created_at' => $now,
                    'updated_at' => $now
                ]);
            }
        }
        try {
            $this->execute("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('seeded_default_chapter_events', '1', ?)", [$now]);
        } catch (\Exception $e) {}
    }

    private function seedDefaultMeetingCustomizations(): void {
        try {
            $seeded = $this->fetchColumn("SELECT value FROM settings WHERE key = 'seeded_default_meeting_customizations'");
            if ($seeded === '1') {
                return;
            }
        } catch (\Exception $e) {}

        $now = date('Y-m-d H:i:s');
        $defaults = [
            [
                'meeting_date' => '2026-10-22',
                'title' => 'モメンタム',
                'category' => 'モメンタム',
                'is_online' => 1,
                'location_name' => 'Zoom オンライン',
                'location_url' => '',
                'start_datetime' => '2026-10-22 06:00:00',
                'end_datetime' => '2026-10-22 08:30:00',
                'organizer' => 'REvoチャプター プレジデント & 運営チーム',
                'description' => "【モメンタム】定例会！チャプターの勢いを加速させる特別プログラム。\nメンバー 6:00 / ビジター 6:40受付開始 / 7:00開会 / 8:30閉会"
            ],
            [
                'meeting_date' => '2026-11-05',
                'title' => 'BOD ONLINE',
                'category' => 'ビジネスオープンデー',
                'is_online' => 1,
                'location_name' => 'Zoom オンライン',
                'location_url' => '',
                'start_datetime' => '2026-11-05 06:00:00',
                'end_datetime' => '2026-11-05 08:30:00',
                'organizer' => 'REvoチャプター メンバー全員',
                'description' => "【BOD ONLINE】ビジネスオープンデー（オンラインZoom特別定例会）！\n多数のビジターをお招きしオンラインで開催。\nメンバー 6:00 / ビジター 6:40受付開始 / 7:00開会 / 8:30閉会"
            ],
            [
                'meeting_date' => '2026-11-19',
                'title' => 'BOD 対面',
                'category' => 'ビジネスオープンデー',
                'is_online' => 0,
                'location_name' => 'スター食堂',
                'location_url' => '',
                'start_datetime' => '2026-11-19 06:00:00',
                'end_datetime' => '2026-11-19 08:30:00',
                'organizer' => 'REvoチャプター メンバー全員',
                'description' => "【BOD 対面】ビジネスオープンデー（対面リアル特別定例会）！\n会場: スター食堂\nメンバー 6:00 / ビジター 6:40受付開始 / 7:00開会 / 8:30閉会"
            ]
        ];

        foreach ($defaults as $m) {
            $exists = $this->fetchColumn("SELECT COUNT(*) FROM meeting_customizations WHERE meeting_date = ?", [$m['meeting_date']]);
            if ((int)$exists === 0) {
                $this->insert('meeting_customizations', array_merge($m, [
                    'created_at' => $now,
                    'updated_at' => $now
                ]));
            }
        }
        try {
            $this->execute("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('seeded_default_meeting_customizations', '1', ?)", [$now]);
        } catch (\Exception $e) {}
    }

    public function transaction(callable $callback): mixed {
        $this->pdo->beginTransaction();
        try {
            $result = $callback($this);
            $this->pdo->commit();
            return $result;
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}

