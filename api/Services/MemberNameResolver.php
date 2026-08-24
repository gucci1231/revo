<?php
namespace Api\Services;

use Api\Repositories\MemberRepository;

class MemberNameResolver {
    private static ?array $cachedMembers = null;

    private static array $knownAliases = [
        '小瀬戸 健一' => ['小瀬戸', 'おぜと', 'おせど', '小瀬', '瀬戸', 'こせど', 'おぜとさん', 'おせどさん'],
        '前井 宏之' => ['前井', 'まえい', '前居', '前居宏之', '前居さん'],
        '平田 貴嗣' => ['平田', 'ひらた', '平田さん', '平田たかつぐ', 'たかつぐ'],
        '上田 優也' => ['上田', 'うえだ', '植田', '上田さん', 'ゆうや'],
        '小山 世次' => ['小山', 'こやま', 'おやま', '小山さん', '世次', 'せいじ'],
        '阿部 真二' => ['阿部', 'あべ', '安倍', '安部', '阿部さん', '安倍さん', '真二', 'しんじ'],
        '三島 文美' => ['三島', 'みしま', '三島さん', '文美', 'あやみ'],
        '永井 創太' => ['永井', 'ながい', '長井', '長井さん', '永井さん', '創太', 'そうた'],
        '森田 由美子' => ['森田', 'もりた', '盛田', '森田さん', '盛田さん', '由美子', 'ゆみこ'],
        '川田 湧矢' => ['川田', 'かわた', 'かわだ', '河田', '川田さん', '湧矢'],
        '板谷 栄子' => ['板谷', 'いたや', '板屋', '板谷さん', '板屋さん', '栄子', 'えいこ'],
        '桐原 卓也' => ['桐原', 'きりはら', '桐山', '桐原さん', '卓也', 'たくや'],
        '川口 陽平' => ['川口', 'かわぐち', '河口', '川口さん', '陽平', 'ようへい', 'ぐっち'],
        '江幡 幸典' => ['江幡', '江端', 'えばた', 'えばたさん', '江端さん', '江端幸典', '江端ゆきのり', '幸典', 'ゆきのり', 'エバタ'],
        '居原田 晃司' => ['居原田', 'いはらだ', '井原田', '猪原田', '居原田さん', '井原田さん', '晃司', 'こうじ'],
        '熊野 りん' => ['熊野', 'くまの', '熊野さん', 'りん', 'りんさん'],
        '畑中 実' => ['畑中', 'はたなか', '畑中さん', '実', 'みのる'],
        '野本 暁' => ['野本', 'のもと', '野本さん', '暁', 'あきら'],
        '佐内 勖' => ['佐内', 'さない', '佐内さん', '左内'],
        '松本 俊輔' => ['松本', 'まつもと', '松本さん', '俊輔', 'しゅんすけ']
    ];

    public static function resolve(string $rawName, array $members = []): string {
        $raw = trim($rawName);
        if ($raw === '' || $raw === '-') {
            return $raw;
        }

        // 敬称（さん・様・さま・氏・君・くん・先生・社長・代表など）の除去
        $cleaned = preg_replace('/[\s\x{3000}]*(?:さん|様|さま|氏|君|くん|先生|社長|代表)$/u', '', $raw);
        $cleaned = trim($cleaned);
        if ($cleaned === '') {
            return $raw;
        }

        if (empty($members)) {
            if (self::$cachedMembers === null) {
                try {
                    $repo = new MemberRepository();
                    self::$cachedMembers = $repo->getAll();
                } catch (\Throwable $e) {
                    self::$cachedMembers = [];
                }
            }
            $members = self::$cachedMembers;
        }

        $cleanKey = mb_strtolower(preg_replace('/[\s\x{3000}]+/u', '', $cleaned));
        $cleanHira = mb_convert_kana($cleanKey, 'c', 'UTF-8');

        // 1. 完全一致 (スペース無視)
        foreach ($members as $m) {
            $mName = trim($m['name'] ?? $m['氏名'] ?? '');
            $mKey = mb_strtolower(preg_replace('/[\s\x{3000}]+/u', '', $mName));
            if ($cleanKey === $mKey) {
                return $mName;
            }
        }

        // 2. 既知の同音・漢字エイリアス / ひらがな辞書一致
        foreach (self::$knownAliases as $canonical => $aliasList) {
            foreach ($aliasList as $a) {
                $aKey = mb_strtolower(preg_replace('/[\s\x{3000}]+/u', '', $a));
                $aHira = mb_convert_kana($aKey, 'c', 'UTF-8');
                if ($cleanKey === $aKey || $cleanHira === $aHira) {
                    // 名簿内に正式名が存在すればその表記、無ければcanonical
                    foreach ($members as $m) {
                        $mName = trim($m['name'] ?? $m['氏名'] ?? '');
                        if ($mName === $canonical) return $mName;
                    }
                    return $canonical;
                }
            }
        }

        // 3. 姓一致 (苗字が一致し、該当者が1名の場合)
        $lastNameMatches = [];
        foreach ($members as $m) {
            $mName = trim($m['name'] ?? $m['氏名'] ?? '');
            $parts = preg_split('/[\s\x{3000}]+/u', $mName);
            $lastName = mb_strtolower($parts[0] ?? '');
            if ($lastName !== '' && $cleanKey === $lastName) {
                $lastNameMatches[] = $mName;
            }
        }
        if (count($lastNameMatches) === 1) {
            return $lastNameMatches[0];
        }

        // 4. 名一致 (名前が一致し、該当者が1名の場合)
        $firstNameMatches = [];
        foreach ($members as $m) {
            $mName = trim($m['name'] ?? $m['氏名'] ?? '');
            $parts = preg_split('/[\s\x{3000}]+/u', $mName);
            if (count($parts) > 1) {
                $firstName = mb_strtolower(implode('', array_slice($parts, 1)));
                if ($firstName !== '' && $cleanKey === $firstName) {
                    $firstNameMatches[] = $mName;
                }
            }
        }
        if (count($firstNameMatches) === 1) {
            return $firstNameMatches[0];
        }

        // 5. 部分一致
        $partialMatches = [];
        foreach ($members as $m) {
            $mName = trim($m['name'] ?? $m['氏名'] ?? '');
            $mKey = mb_strtolower(preg_replace('/[\s\x{3000}]+/u', '', $mName));
            if (str_contains($mKey, $cleanKey) || str_contains($cleanKey, $mKey)) {
                $partialMatches[] = $mName;
            }
        }
        if (count($partialMatches) === 1) {
            return $partialMatches[0];
        }

        // 6. 類似度（編集距離）マッチング (1文字違いの漢字間違い・タイポ)
        if (mb_strlen($cleanKey) >= 2) {
            $typoMatches = [];
            foreach ($members as $m) {
                $mName = trim($m['name'] ?? $m['氏名'] ?? '');
                $mKey = mb_strtolower(preg_replace('/[\s\x{3000}]+/u', '', $mName));
                $parts = preg_split('/[\s\x{3000}]+/u', $mName);
                $lastName = mb_strtolower($parts[0] ?? '');

                $distFull = levenshtein($cleanKey, $mKey);
                $distLast = levenshtein($cleanKey, $lastName);

                if ($distFull <= 1 || ($distLast <= 1 && mb_strlen($cleanKey) >= 2)) {
                    $typoMatches[] = $mName;
                }
            }
            if (count($typoMatches) === 1) {
                return $typoMatches[0];
            }
        }

        return $cleaned;
    }
}
