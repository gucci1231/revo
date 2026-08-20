<?php
namespace Api\Repositories;

use Api\Core\Database;

class SettingRepository {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    public function getAll(): array {
        $rows = $this->db->fetchAll("SELECT key, value FROM settings");
        $settings = [];
        foreach ($rows as $r) {
            $settings[$r['key']] = $r['value'];
        }
        if (empty($settings['start_date'])) {
            $settings['start_date'] = '2026/04/01';
        }
        return $settings;
    }

    public function getByKey(string $key, ?string $default = null): ?string {
        $value = $this->db->fetchColumn("SELECT value FROM settings WHERE key = ?", [$key]);
        return $value !== false ? $value : $default;
    }

    public function getDefaultGoals(): array {
        $json = $this->getByKey('goals_default');
        $default = [
            'target_joined' => 2,
            'target_visitors_weekly' => 4,
            'target_join_rate' => 25.0,
            'target_hearing_rate' => 100.0
        ];
        if ($json) {
            $data = json_decode($json, true);
            if (is_array($data)) {
                return array_merge($default, $data);
            }
        }
        return $default;
    }

    public function setDefaultGoals(array $goals, string $now): bool {
        $clean = [
            'target_joined' => (int)($goals['target_joined'] ?? 2),
            'target_visitors_weekly' => (int)($goals['target_visitors_weekly'] ?? 4),
            'target_join_rate' => (float)($goals['target_join_rate'] ?? 25.0),
            'target_hearing_rate' => (float)($goals['target_hearing_rate'] ?? 100.0)
        ];
        return $this->setKey('goals_default', json_encode($clean, JSON_UNESCAPED_UNICODE), $now);
    }

    public function getMonthlyGoalsMap(): array {
        $json = $this->getByKey('goals_monthly');
        if ($json) {
            $data = json_decode($json, true);
            if (is_array($data)) {
                return $data;
            }
        }
        return [];
    }

    public function setMonthlyGoal(string $month, ?array $goals, string $now): bool {
        $normMonth = str_replace('-', '/', trim($month));
        $map = $this->getMonthlyGoalsMap();
        if ($goals === null) {
            unset($map[$normMonth]);
        } else {
            $map[$normMonth] = [
                'target_joined' => (int)($goals['target_joined'] ?? 2),
                'target_visitors_weekly' => (int)($goals['target_visitors_weekly'] ?? 4),
                'target_join_rate' => (float)($goals['target_join_rate'] ?? 25.0),
                'target_hearing_rate' => (float)($goals['target_hearing_rate'] ?? 100.0)
            ];
        }
        ksort($map);
        return $this->setKey('goals_monthly', json_encode($map, JSON_UNESCAPED_UNICODE), $now);
    }

    public function resolveGoalsForMonth(string $month): array {
        $normMonth = str_replace('-', '/', trim($month));
        $defaultGoals = $this->getDefaultGoals();
        $monthlyMap = $this->getMonthlyGoalsMap();

        // 1. Direct monthly setting exists
        if (isset($monthlyMap[$normMonth])) {
            return array_merge($monthlyMap[$normMonth], [
                'month' => $normMonth,
                'source' => 'custom',
                'is_custom' => true
            ]);
        }

        // 2. Inherit from latest past configured month
        $pastMonths = [];
        foreach (array_keys($monthlyMap) as $m) {
            if ($m < $normMonth) {
                $pastMonths[] = $m;
            }
        }
        if (!empty($pastMonths)) {
            rsort($pastMonths);
            $latestPastMonth = $pastMonths[0];
            return array_merge($monthlyMap[$latestPastMonth], [
                'month' => $normMonth,
                'source' => 'inherited',
                'inherited_from' => $latestPastMonth,
                'is_custom' => false
            ]);
        }

        // 3. Fallback to default goals
        return array_merge($defaultGoals, [
            'month' => $normMonth,
            'source' => 'default',
            'is_custom' => false
        ]);
    }
}

