<?php
namespace Api\Services;

use Api\Core\Database;

/**
 * GrowthAdvisorService - Personalized Growth Engine (PGE)
 * 
 * Analyzes individual member PALMS & Traffic Light performance,
 * computes the minimum-effort Baby Step prescription to reach the next tier (Red->Yellow, Yellow->Green),
 * matches appropriate regional training events, and provides 1-tap goal commitment.
 */
class GrowthAdvisorService {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    /**
     * Generate or fetch personal growth recommendation for a member
     * 
     * @param int|string $memberId
     * @return array Growth prescription plan
     */
    public function generatePrescription($memberId): array {
        $memberStmt = $this->db->prepare("SELECT * FROM members WHERE id = ?");
        $memberStmt->execute([(string)$memberId]);
        $member = $memberStmt->fetch(\PDO::FETCH_ASSOC);

        if (!$member) {
            return [
                'success' => false,
                'message' => 'Member not found'
            ];
        }

        $memberName = $member['name'];

        // 1. Fetch latest PALMS report
        $palmsStmt = $this->db->prepare("
            SELECT * FROM palms_reports 
            WHERE member_id = ? OR member_name = ?
            ORDER BY end_date DESC LIMIT 1
        ");
        $palmsStmt->execute([(string)$memberId, $memberName]);
        $palms = $palmsStmt->fetch(\PDO::FETCH_ASSOC);

        $currentScore = $palms ? (int)($palms['traffic_score'] ?? 60) : 60;
        $oneToOnes = $palms ? (int)($palms['one_to_ones'] ?? 0) : 0;
        $ceus = $palms ? (int)($palms['ceu'] ?? 0) : 0;
        $visitors = $palms ? (int)($palms['visitors'] ?? 0) : 0;

        // Current & Target Tiers
        $currentTier = $currentScore >= 70 ? 'green' : ($currentScore >= 55 ? 'yellow' : 'red');
        $targetScore = 70;
        $nextTier = 'green';
        $additional1to1 = 1;
        $additionalCeu = 1;

        if ($currentTier === 'red') {
            $targetScore = 55;
            $nextTier = 'yellow';
            $additional1to1 = max(1, 2 - $oneToOnes);
            $additionalCeu = max(1, 1 - $ceus);
            $headline = "イエロー（55点）への最短ステップ";
            $prescription = "現在のスコア（{$currentScore}点）から、まずは確実にイエロー（55点）に上がるプランです。あと1to1を{$additional1to1}回、研修（CEU）を{$additionalCeu}回受講するだけで達成可能です！";
        } elseif ($currentTier === 'yellow') {
            $targetScore = 70;
            $nextTier = 'green';
            $additional1to1 = max(1, 3 - $oneToOnes);
            $additionalCeu = max(1, 2 - $ceus);
            $headline = "公式グリーン（70点）への昇格ステップ";
            $prescription = "現在のスコア（{$currentScore}点）から、チャプター模範のグリーンゾーン（70点）を目指すプランです。月間1to1をあと{$additional1to1}回、CEUを{$additionalCeu}ポイント獲得することで最短で到達します。";
        } else {
            $targetScore = min(100, $currentScore + 10);
            $nextTier = 'green_star';
            $additional1to1 = 4;
            $additionalCeu = 3;
            $headline = "エクセレント（{$targetScore}点）維持ステップ";
            $prescription = "すでに素晴らしいグリーン（{$currentScore}点）を達成中！この調子を維持しつつ、後輩メンバーへの1to1をサポートする高水準プランです。";
        }

        // 2. Recommend optimal Kyoto CC training events from region_events
        $evStmt = $this->db->query("
            SELECT * FROM region_events 
            WHERE start_datetime >= datetime('now', 'localtime')
            ORDER BY start_datetime ASC 
            LIMIT 2
        ");
        $recommendedEvents = $evStmt->fetchAll(\PDO::FETCH_ASSOC);

        // 3. Persist or fetch existing goal in member_goals
        $currentPeriod = date('Y-m');
        $goalStmt = $this->db->prepare("
            SELECT * FROM member_goals 
            WHERE member_id = ? AND target_period = ?
        ");
        $goalStmt->execute([(string)$memberId, $currentPeriod]);
        $existingGoal = $goalStmt->fetch(\PDO::FETCH_ASSOC);

        $goalId = $existingGoal['id'] ?? ('mg_' . $memberId . '_' . date('Ym'));
        $isAccepted = $existingGoal ? (int)($existingGoal['is_accepted'] ?? 0) : 0;
        $acceptedAt = $existingGoal['accepted_at'] ?? '';

        if (!$existingGoal) {
            $recEventIds = implode(',', array_column($recommendedEvents, 'id'));
            $insStmt = $this->db->prepare("
                INSERT INTO member_goals (
                    id, member_id, target_period, target_score, target_1to1_count, target_ceu_count, advice_text, recommended_event_ids, is_accepted, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now', 'localtime'), datetime('now', 'localtime'))
            ");
            $insStmt->execute([
                $goalId, (string)$memberId, $currentPeriod, $targetScore, $additional1to1, $additionalCeu, $prescription, $recEventIds
            ]);
        }

        // Action Token for 1-tap goal acceptance
        $acceptToken = TokenService::generateToken([
            'm' => (int)$memberId,
            'a' => 'accept_goal',
            't' => $goalId
        ], 2592000);

        return [
            'success' => true,
            'memberId' => $memberId,
            'memberName' => $memberName,
            'currentScore' => $currentScore,
            'currentTier' => $currentTier,
            'targetScore' => $targetScore,
            'nextTier' => $nextTier,
            'headline' => $headline,
            'prescription' => $prescription,
            'target1to1' => $additional1to1,
            'targetCeu' => $additionalCeu,
            'goalId' => $goalId,
            'isAccepted' => $isAccepted,
            'acceptedAt' => $acceptedAt,
            'acceptToken' => $acceptToken,
            'acceptUrl' => 'act.php?k=' . urlencode($acceptToken),
            'recommendedEvents' => $recommendedEvents
        ];
    }

    /**
     * Accept a goal
     */
    public function acceptGoal(string $goalId): bool {
        $stmt = $this->db->prepare("
            UPDATE member_goals 
            SET is_accepted = 1, accepted_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
            WHERE id = ?
        ");
        return $stmt->execute([$goalId]);
    }

    /**
     * Generate weekly encouragement nudge message
     */
    public function generateWeeklyNudge(array $plan): string {
        $name = $plan['memberName'];
        $score = $plan['targetScore'];
        $remain1to1 = $plan['target1to1'];
        
        return "【REvoパーソナル応援】{$name}さん、今週もお疲れ様です！今期の目標（{$score}点）に向けて、今週は「1to1をあと{$remain1to1}回」実施すれば最短で前進します。無理のないベイビーステップで一緒に成長しましょう！🔥";
    }
}
