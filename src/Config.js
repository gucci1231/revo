/** 
 * Visitor Host Revolution (VHR) - Global Config
 * 定数定義・列定義・メンバー定義・シート名一覧
 */

// テストモード設定
const IS_TEST_MODE = true;
const TEST_EMAIL_LIST = ['gucci1231@me.com', 'info@k-d-o.biz'];

// LINE API 設定
const LINE_TOKEN = 'ZWQP9JFncMBsJ7MmxGJ97emxDaQgs5BcCLW53ota+53Ec0Z0sqbzq/TEfrW+NCGp1ybFaTCKRTnsjAqfm6xVWehBMOk71HA/Sk9Zdy5suzQrHcvUFKjElV5RyAPvqkV7/QenYyYKYCY01vb/UIju/wdB04t89/1O/w1cDnyilFU=';
const LINE_GROUP_ID = 'C8dc2f8c84ba00664735196f78973cf1e';

// スプレッドシートID設定
const SPREADSHEET_ID = '1wMXXurT9uWpythSDKSggjJESldIrqc0_5PL22LXDSGQ';

/**
 * システム利用スプレッドシートの全シート名定義
 */
const SHEET_NAMES = {
  TOTAL: "Total",
  LIST: "List",
  RAW_FORM: "フォームの回答 1",
  VISITORS: "visitors",
  VISITORS_STATUS: "visitors_status",
  HEARING_SHEETS: "hearing_sheets",
  MAIL_HISTORIES: "mail_historys",
  MAIL_REACTIONS: "mail_reactions",
  MEMBERS: "members",
  SETTINGS: "settings",
  SETTING_ALT: "setting",
  SUMMARY_CACHE: "summary_cache",
  PANEL: "操作用パネル",
  REPORT_LOG: "Report",
  FOLLOW_MAIL_TEMPLATE: "FollowMail_template",
  LINE_TEMPLATE: "LINE_template",
  RAS_TEMPLATE: "RAS_template",
  REFERRAL_TEMPLATE: "Referral_template"
};

/**
 * REvo & DNA メンバーリスト (カテゴリ順)
 */
const REVO_MEMBERS = [
  {
    category: "〇士業・事業サポート",
    members: [
      { name: "小瀬戸 健一", profession: "融資・補助金申請サポート" },
      { name: "前井 宏之", profession: "社長の孤独をなくす専属AI" }
    ]
  },
  {
    category: "〇建築",
    members: [
      { name: "平田 貴嗣", profession: "電気工事LED" },
      { name: "上田 優也", profession: "シーリング工事" },
      { name: "小山 世次", profession: "セミ新築(住まいの再生ラボ)" }
    ]
  },
  {
    category: "〇不動産",
    members: [
      { name: "阿部 真二", profession: "不動産買取り" }
    ]
  },
  {
    category: "〇保険・金融",
    members: [
      { name: "三島 文美", profession: "生命保険（家計にやさしいアドバイザー）" },
      { name: "永井 創太", profession: "生命保険（個人）" }
    ]
  },
  {
    category: "〇飲食・物販",
    members: [
      { name: "森田 由美子", profession: "日本茶販売" },
      { name: "川田 湧矢", profession: "和食とワイン" }
    ]
  },
  {
    category: "〇美容・健康",
    members: [
      { name: "板谷 栄子", profession: "ながらダイエット機器販売" }
    ]
  },
  {
    category: "〇クリエイティブ・マーケティング",
    members: [
      { name: "桐原 卓也", profession: "SNS特化ショート動画制作" },
      { name: "川口 陽平", profession: "デザイナー" },
      { name: "江幡 幸典", profession: "人生の節目フォトグラファー" }
    ]
  },
  {
    category: "〇ライフイベント・サービス",
    members: [
      { name: "居原田 晃司", profession: "結婚相談所" }
    ]
  },
  {
    category: "DNAメンバー",
    members: [
      { name: "熊野 りん", profession: "DNA" },
      { name: "畑中 実", profession: "DNA" },
      { name: "野本 暁", profession: "DNA" },
      { name: "佐内 勖", profession: "DNA" },
      { name: "松本 俊輔", profession: "DNA" }
    ]
  }
];

/**
 * フォームの回答 1 (Listシート) の列定義
 */
const RAW_FORM_COL = {
  TIMESTAMP: 0,
  EMAIL: 1,
  CATEGORY: 2,
  ATTENDANCE_COUNT: 3,
  CHAPTER: 4,
  INVITER: 5,
  VISITOR_NAME: 6,
  FURIGANA: 7,
  PROFESSION: 8,
  COMPANY: 9,
  PHONE: 10,
  ZOOM_EXP: 11,
  EVENT_DATE: 12,
  INTERVIEW: 13,
  SCORE: 14,
  ALT_EMAIL: 15
};

/**
 * Totalシートの列定義
 */
const COL = {
  NO: 0,
  APPLY_DATE: 1,
  EMAIL: 2,
  CATEGORY: 3,
  ATTENDANCE_COUNT: 4,
  CHAPTER: 5,
  INVITER: 6,
  VISITOR_NAME: 7,
  FURIGANA: 8,
  PROFESSION: 9,
  COMPANY: 10,
  PHONE: 11,
  ZOOM_EXP: 12,
  EVENT_DATE: 13,
  INTERVIEW: 14,
  IS_ATTENDED: 15,
  IS_ABSENT: 16,
  IS_JOINED: 17,
  HEARING_SHEET: 18,
  FLG_ADD: 19,
  FLG_2DAYS: 20,
  FLG_1DAY: 21,
  FLG_THANKS: 22,
  FLG_7DAYS: 23,
  FLG_30DAYS: 24,
  FB_ADD: 25,
  FB_2DAYS: 26,
  FB_1DAY: 27,
  FB_THANKS: 28,
  FB_7DAYS: 29,
  FB_30DAYS: 30,
  IS_1TO1: 31,
  IS_MATCHED: 32,
  HOT_LEVEL: 33,
  MATCHING_REQ: 34,
  NEXT_ACTION: 35,
  REMARKS: 36
};