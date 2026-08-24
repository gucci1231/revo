<?php
namespace Api\Core;

/**
 * VisitorStatus
 * ビジターの各種ステータス（入会進捗・出席・フォロー方針・感触ランク）の判定および正規化を一元管理するクラス
 */
class VisitorStatus {
    // 入会ステータス定数
    public const JOINED_NONE = '未';
    public const JOINED_CONSIDERING = '検討中';
    public const JOINED_APPLYING = '申込書提出';
    public const JOINED_PAYMENT = '入金待ち';
    public const JOINED_REVIEW = '審査';
    public const JOINED_DONE = '入会済';
    public const JOINED_CLOSED = 'フォロー終了';
    public const JOINED_REJECTED = '見送り';

    // フォロー方針定数
    public const FOLLOW_ACTIVE = 'フォロー';
    public const FOLLOW_PENDING = '時期尚早';
    public const FOLLOW_ALLIANCE = '関係維持';
    public const FOLLOW_CLOSED = 'フォロー終了';

    // 出席ステータス定数
    public const ATTEND_NONE = '未';
    public const ATTEND_ATTENDED = '参加';
    public const ATTEND_ABSENT = '不参加';

    /**
     * 入会済み判定
     */
    public static function isJoined(?string $status): bool {
        if (!$status) return false;
        $s = trim((string)$status);
        return in_array($s, ['入会済', '済', '入会', 'true', '1'], true);
    }

    /**
     * 出席済み判定
     */
    public static function isAttended(?string $status): bool {
        if (!$status) return false;
        $s = trim((string)$status);
        return in_array($s, ['参加', '出席', '済', 'true', '1'], true);
    }

    /**
     * クローズ・終了・見送り判定
     */
    public static function isClosed(?string $joinStatus, ?string $followType = null): bool {
        $j = self::normalizeJoinStatus($joinStatus);
        if ($j === self::JOINED_CLOSED || $j === self::JOINED_REJECTED) {
            return true;
        }
        if ($followType !== null) {
            $f = self::normalizeFollowType($followType);
            if ($f === self::FOLLOW_CLOSED) {
                return true;
            }
        }
        return false;
    }

    /**
     * 直近フォロー対象（進行中）判定
     */
    public static function isFollowActive(?string $followType): bool {
        $f = self::normalizeFollowType($followType);
        return $f === self::FOLLOW_ACTIVE;
    }

    /**
     * 入会ステータスの正規化
     */
    public static function normalizeJoinStatus(?string $raw): string {
        if (!$raw) return self::JOINED_NONE;
        $s = trim((string)$raw);
        if (in_array($s, ['入会済', '済', '入会', 'true', '1'], true)) return self::JOINED_DONE;
        if (in_array($s, ['メンバーシップ審査', '審査中', '審査'], true)) return self::JOINED_REVIEW;
        if (in_array($s, ['終了', 'フォロー終了'], true)) return self::JOINED_CLOSED;
        if ($s === '見送り') return self::JOINED_REJECTED;
        if (in_array($s, [self::JOINED_CONSIDERING, self::JOINED_APPLYING, self::JOINED_PAYMENT, self::JOINED_NONE], true)) {
            return $s;
        }
        return self::JOINED_NONE;
    }

    /**
     * フォロー方針の正規化
     */
    public static function normalizeFollowType(?string $raw): string {
        if (!$raw) return self::FOLLOW_ACTIVE;
        $s = trim((string)$raw);
        if (in_array($s, ['フォロー', '直近フォロー', '直近'], true)) return self::FOLLOW_ACTIVE;
        if (in_array($s, ['保留', '保留（時期尚早）', '時期尚早'], true) || mb_strpos($s, '時期尚早') !== false) return self::FOLLOW_PENDING;
        if (in_array($s, ['アライアンス', '繋がり維持', '定期コンタクト', '関係維持'], true) || mb_strpos($s, '関係維持') !== false) return self::FOLLOW_ALLIANCE;
        if (in_array($s, ['クローズ', '完了', 'フォロー終了', '終了', '見送り'], true)) return self::FOLLOW_CLOSED;
        return self::FOLLOW_ACTIVE;
    }

    /**
     * 入会ステータスの進行優先度（重複マージ等用）
     */
    public static function getJoinPriority(?string $status): int {
        $normalized = self::normalizeJoinStatus($status);
        switch ($normalized) {
            case self::JOINED_DONE: return 5;
            case self::JOINED_REVIEW: return 4;
            case self::JOINED_PAYMENT: return 3;
            case self::JOINED_APPLYING: return 2;
            case self::JOINED_CONSIDERING: return 1;
            default: return 0;
        }
    }

    /**
     * 感触ランクの正規化 (A, B, C or empty)
     */
    public static function normalizeFeelRank(?string $raw): string {
        if (!$raw) return '';
        $s = strtoupper(trim((string)$raw));
        if (strpos($s, 'A') !== false) return 'A';
        if (strpos($s, 'B') !== false) return 'B';
        if (strpos($s, 'C') !== false) return 'C';
        return '';
    }
}
