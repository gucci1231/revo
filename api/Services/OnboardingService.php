<?php
namespace Api\Services;

use Api\Core\Database;

/**
 * OnboardingService - 60-Day New Member Onboarding Engine
 * 
 * Tracks the 4 key milestones within the first 60 days of membership:
 *  1. First 1to1 (初1to1)
 *  2. First CEU training (初CEU)
 *  3. First Referral / Slip input (初スリップ)
 *  4. First Visitor invitation (初ビジター招待)
 * Detects stagnation and automatically generates Care Call Nudges for Buddies and Vice President.
 */
class OnboardingService {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    /**
     * Get all members currently in their first 60 days
     */
    public function getOnboardingMembers(): array {
        // Query members with is_onboarding = 1 or joined within 60 days
        $stmt = $this->db->query("
            SELECT m.*, b.name as buddy_name, b.email as buddy_email
            FROM members m
            LEFT JOIN members b ON m.buddy_member_id = b.id
            WHERE m.status = '在籍' 
              AND (m.is_onboarding = 1 OR (m.joined_date IS NOT NULL AND m.joined_date != '' AND m.joined_date >= date('now', '-60 days')))
            ORDER BY m.joined_date DESC
        ");
        $members = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        $results = [];
        foreach ($members as $m) {
            $results[] = $this->evaluateMemberMilestones($m);
        }
        return $results;
    }

    /**
     * Evaluate the 4 milestones for a specific member
     */
    public function evaluateMemberMilestones(array $member): array {
        $memberId = (string)$member['id'];
        $memberName = $member['name'];
        $joinedDate = $member['joined_date'] ?: date('Y-m-d');
        $daysElapsed = max(0, (int)((time() - strtotime($joinedDate)) / 86400));

        // 1. Fetch PALMS data
        $stmt = $this->db->prepare("
            SELECT SUM(one_to_ones) as total_1to1,
                   SUM(ceu) as total_ceu,
                   SUM(referrals_inside + referrals_outside) as total_ref,
                   SUM(tyfcb) as total_tyfcb
            FROM palms_reports 
            WHERE member_id = ? OR member_name = ?
        ");
        $stmt->execute([$memberId, $memberName]);
        $palms = $stmt->fetch(\PDO::FETCH_ASSOC);

        $total1to1 = (int)($palms['total_1to1'] ?? 0);
        $totalCeu = (int)($palms['total_ceu'] ?? 0);
        $totalRef = (int)($palms['total_ref'] ?? 0);
        $totalTyfcb = (int)($palms['total_tyfcb'] ?? 0);

        // 2. Fetch Visitor invitation data
        $vStmt = $this->db->prepare("
            SELECT COUNT(*) FROM visitors WHERE inviter LIKE ?
        ");
        $vStmt->execute(['%' . $memberName . '%']);
        $totalVisitors = (int)$vStmt->fetchColumn();

        $milestones = [
            'first_1to1' => [
                'label' => '初1to1実施',
                'completed' => $total1to1 > 0,
                'value' => $total1to1,
                'target' => 1,
                'urgent_after_days' => 14
            ],
            'first_ceu' => [
                'label' => '初CEU受講',
                'completed' => $totalCeu > 0,
                'value' => $totalCeu,
                'target' => 1,
                'urgent_after_days' => 30
            ],
            'first_slip' => [
                'label' => '初スリップ入力',
                'completed' => ($totalRef > 0 || $totalTyfcb > 0),
                'value' => ($totalRef + ($totalTyfcb > 0 ? 1 : 0)),
                'target' => 1,
                'urgent_after_days' => 30
            ],
            'first_visitor' => [
                'label' => '初ビジター招待',
                'completed' => $totalVisitors > 0,
                'value' => $totalVisitors,
                'target' => 1,
                'urgent_after_days' => 45
            ]
        ];

        // Completed milestone count
        $completedCount = 0;
        $urgentStagnations = [];

        foreach ($milestones as $key => $ms) {
            if ($ms['completed']) {
                $completedCount++;
            } else if ($daysElapsed >= $ms['urgent_after_days']) {
                $urgentStagnations[] = $ms['label'];
            }
        }

        $progressRate = round(($completedCount / 4) * 100);
        $needsCareCall = count($urgentStagnations) > 0;

        return [
            'memberId' => $memberId,
            'name' => $memberName,
            'role' => $member['role'] ?? '',
            'joinedDate' => $joinedDate,
            'daysElapsed' => $daysElapsed,
            'buddyId' => $member['buddy_member_id'] ?? null,
            'buddyName' => $member['buddy_name'] ?? '未設定',
            'milestones' => $milestones,
            'completedCount' => $completedCount,
            'progressRate' => $progressRate,
            'needsCareCall' => $needsCareCall,
            'stagnantMilestones' => $urgentStagnations,
            'careCallSuggestion' => $needsCareCall ? $this->generateCareCallText($memberName, $urgentStagnations, $member['buddy_name'] ?? '') : null
        ];
    }

    /**
     * Generate 10-minute Care Call Nudge text for Buddy / Vice President
     */
    public function generateCareCallText(string $memberName, array $stagnantMilestones, string $buddyName = ''): string {
        $reasons = implode('・', $stagnantMilestones);
        $buddyPrefix = !empty($buddyName) && $buddyName !== '未設定' ? "バディの{$buddyName}様、" : "";
        
        return "【10分ケアコール推奨】{$buddyPrefix}新入会者の{$memberName}さんの「{$reasons}」が未達のまま入会日数が経過しています。孤立を防ぐため、10分間のお電話またはZoomでのお声がけ（不安解消ヒアリング）を推奨します。";
    }
}
