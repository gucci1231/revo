<?php
namespace Api\Services;

use Api\Core\Database;

/**
 * PowerTeamMatcher - Intelligent Power Team Suggestion for Visitors
 * 
 * Analyzes visitor's profession, company, and pre-meeting WIIFM (business challenges)
 * to suggest the most synergistic chapter members for pre-meeting matching.
 */
class PowerTeamMatcher {
    private Database $db;

    // Standard Power Team Archetypes in REvo Chapter
    private static array $powerTeams = [
        'finance_legal' => [
            'name' => '士業・財務・コンサル PT',
            'icon' => '⚖️',
            'keywords' => ['士', '弁護士', '税理士', '行政書士', '社労士', '会計', '司法書士', '保険', 'FP', '財務', 'コンサル', '資金調達', '助成金']
        ],
        'real_estate_construction' => [
            'name' => '不動産・建築・住まい PT',
            'icon' => '🏗️',
            'keywords' => ['不動産', '建築', 'リフォーム', '解体', '外壁', '塗装', '電気', '内装', '設計', '工務店', '住宅', '屋根', '空き家']
        ],
        'web_marketing' => [
            'name' => 'Web・マーケ・クリエイティブ PT',
            'icon' => '💻',
            'keywords' => ['web', 'ウェブ', 'ホームページ', 'マーケ', 'デザイン', '印刷', '動画', 'sns', '広告', '写真', 'システム', 'it', '集客']
        ],
        'health_beauty' => [
            'name' => '健康・美容・ウェルネス PT',
            'icon' => '🌿',
            'keywords' => ['整体', '鍼灸', '接骨', 'サロン', 'エステ', 'パーソナル', 'フィットネス', '健康', 'サプリ', '治療', '美容', 'クリニック']
        ],
        'life_btoc' => [
            'name' => 'ライフ・ビジネス・食・イベント PT',
            'icon' => '🤝',
            'keywords' => ['飲食', 'カフェ', 'ギフト', '車', 'イベント', '旅行', '清掃', '警備', '物流', '仕入れ', '通信']
        ]
    ];

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    /**
     * Suggest optimal power team and matched members for a visitor
     * 
     * @param string $profession Visitor's profession / category
     * @param string $wiifm Pre-meeting business challenge / synergy target
     * @return array Matched power team name, icon, and recommended member list
     */
    public function suggestPowerTeam(string $profession, string $wiifm = ''): array {
        $targetText = mb_strtolower($profession . ' ' . $wiifm);

        $bestTeamKey = 'life_btoc';
        $highestScore = 0;

        foreach (self::$powerTeams as $key => $pt) {
            $score = 0;
            foreach ($pt['keywords'] as $kw) {
                if (mb_strpos($targetText, mb_strtolower($kw)) !== false) {
                    $score += 2;
                }
            }
            if ($score > $highestScore) {
                $highestScore = $score;
                $bestTeamKey = $key;
            }
        }

        $matchedPt = self::$powerTeams[$bestTeamKey];

        // Fetch matching active chapter members from members table
        $allMembers = $this->db->fetchAll("
            SELECT id, name, category, profession, role 
            FROM members 
            WHERE status = '在籍' 
            ORDER BY id ASC
        ");

        $matchedMembers = [];
        foreach ($allMembers as $m) {
            $mText = mb_strtolower(($m['category'] ?? '') . ' ' . ($m['profession'] ?? '') . ' ' . ($m['name'] ?? ''));
            $memberScore = 0;
            foreach ($matchedPt['keywords'] as $kw) {
                if (mb_strpos($mText, mb_strtolower($kw)) !== false) {
                    $memberScore++;
                }
            }
            if ($memberScore > 0) {
                $matchedMembers[] = [
                    'id' => $m['id'],
                    'name' => $m['name'],
                    'profession' => $m['profession'] ?: $m['category'],
                    'role' => $m['role']
                ];
            }
        }

        // Limit to 4 key members
        $matchedMembers = array_slice($matchedMembers, 0, 4);

        return [
            'teamKey' => $bestTeamKey,
            'teamName' => $matchedPt['name'],
            'teamIcon' => $matchedPt['icon'],
            'suggestedMembers' => $matchedMembers
        ];
    }
}
