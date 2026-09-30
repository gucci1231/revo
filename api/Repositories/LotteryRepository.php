<?php
namespace Api\Repositories;

use Api\Core\Database;

class LotteryRepository {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    /**
     * 当選履歴の全件取得（最新順）
     */
    public function getAllHistory(): array {
        return $this->db->fetchAll("
            SELECT id, member_id, member_name, award_title, won_at, created_at 
            FROM lottery_history 
            ORDER BY won_at DESC, created_at DESC
        ");
    }

    /**
     * メンバーごとの当選状況集計
     */
    public function getMemberWinCounts(): array {
        $rows = $this->db->fetchAll("
            SELECT 
                member_id,
                COUNT(*) as win_count,
                MAX(won_at) as last_won_at
            FROM lottery_history
            GROUP BY member_id
        ");

        $stats = [];
        foreach ($rows as $r) {
            $stats[$r['member_id']] = [
                'win_count' => (int)$r['win_count'],
                'last_won_at' => $r['last_won_at']
            ];
        }
        return $stats;
    }

    /**
     * 全メンバーと当選状況を組み合わせたリストを取得
     */
    public function getMembersWithLotteryStats(): array {
        $members = $this->db->fetchAll("SELECT id, category, name, profession FROM members ORDER BY category, name");
        $stats = $this->getMemberWinCounts();

        // 過去の受賞詳細
        $awardsRows = $this->db->fetchAll("
            SELECT member_id, award_title, won_at 
            FROM lottery_history 
            ORDER BY won_at DESC
        ");
        $awardsByMember = [];
        foreach ($awardsRows as $ar) {
            if (!isset($awardsByMember[$ar['member_id']])) {
                $awardsByMember[$ar['member_id']] = [];
            }
            $awardsByMember[$ar['member_id']][] = [
                'award_title' => $ar['award_title'],
                'won_at' => $ar['won_at']
            ];
        }

        $result = [];
        foreach ($members as $m) {
            $mId = (string)$m['id'];
            $stat = $stats[$mId] ?? ['win_count' => 0, 'last_won_at' => null];
            $result[] = [
                'id' => $mId,
                'category' => $m['category'] ?: 'その他',
                'name' => $m['name'],
                'profession' => $m['profession'] ?: '',
                'win_count' => $stat['win_count'],
                'last_won_at' => $stat['last_won_at'],
                'awards' => $awardsByMember[$mId] ?? []
            ];
        }

        return $result;
    }

    /**
     * 当選の記録
     */
    public function recordWin(string $memberId, string $memberName, string $awardTitle = '', ?string $wonAt = null): string {
        $id = uniqid('lot_', true);
        $now = date('Y/m/d H:i');
        $wonDate = $wonAt ?: date('Y/m/d');

        $this->db->insert('lottery_history', [
            'id' => $id,
            'member_id' => $memberId,
            'member_name' => $memberName,
            'award_title' => $awardTitle,
            'won_at' => $wonDate,
            'created_at' => $now
        ]);

        return $id;
    }

    /**
     * 履歴1件削除
     */
    public function deleteHistory(string $id): int {
        return $this->db->execute("DELETE FROM lottery_history WHERE id = ?", [$id]);
    }

    /**
     * 履歴全件リセット
     */
    public function resetHistory(): int {
        return $this->db->execute("DELETE FROM lottery_history");
    }
}
