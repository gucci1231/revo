<?php
namespace Api\Controllers;

use Api\Core\Controller;
use Api\Core\Response;
use Api\Repositories\EventRepository;
use Api\Services\RegionEventService;
use Exception;

class EventController extends Controller {
    private EventRepository $eventRepo;
    private RegionEventService $eventService;

    public function __construct(?EventRepository $eventRepo = null, ?RegionEventService $eventService = null) {
        parent::__construct();
        $this->eventRepo = $eventRepo ?? new EventRepository();
        $this->eventService = $eventService ?? new RegionEventService();
    }

    public function handle(): void {
        $action = $this->getAction();

        switch ($action) {
            case 'calendar':
                $this->getCalendarEvents();
                break;
            case 'save_meeting_customization':
            case 'save_meeting':
                $this->saveMeetingCustomization();
                break;
            case 'reset_meeting_customization':
            case 'reset_meeting':
                $this->resetMeetingCustomization();
                break;
            case 'save_chapter_event':
                $this->saveChapterEvent();
                break;
            case 'upload_flyer':
                $this->uploadFlyer();
                break;
            case 'delete_chapter_event':
                $this->deleteChapterEvent();
                break;
            case 'get_chapter_event':
                $this->getChapterEvent();
                break;
            case 'list':
                $this->listEvents();
                break;
            case 'get':
            case 'detail':
                $this->getEvent();
                break;
            case 'sync':
                $this->syncEvents();
                break;
            case 'categories':
                $this->getCategories();
                break;
            case 'summary':
                $this->getSummary();
                break;
            default:
                $this->listEvents();
                break;
        }
    }

    private function listEvents(): void {
        $filters = [
            'scope' => (string)$this->getParam('scope', 'upcoming'),
            'category' => (string)$this->getParam('category', ''),
            'event_type_name' => (string)$this->getParam('event_type_name', ''),
            'is_online' => $this->getParam('is_online', ''),
            'keyword' => (string)$this->getParam('keyword', ''),
            'limit' => (int)$this->getParam('limit', 150)
        ];

        $events = $this->eventRepo->getList($filters);
        $summary = $this->eventRepo->getSummary();
        $categories = $this->eventRepo->getCategories();
        $months = $this->eventRepo->getMonths();

        Response::success([
            'events' => $events,
            'summary' => $summary,
            'categories' => $categories,
            'months' => $months
        ]);
    }

    private function getEvent(): void {
        $id = (int)$this->getParam('id', 0);
        if (!$id) {
            Response::error('イベントIDが指定されていません');
            return;
        }

        $event = $this->eventRepo->getById($id);
        if (!$event) {
            Response::error('指定されたイベントが見つかりません');
            return;
        }

        Response::success(['event' => $event]);
    }

    private function syncEvents(): void {
        try {
            $daysBack = (int)$this->getParam('days_back', 30);
            $monthsAhead = (int)$this->getParam('months_ahead', 6);
            $fetchDetails = (bool)$this->getParam('fetch_details', true);

            $result = $this->eventService->sync($daysBack, $monthsAhead, $fetchDetails);
            $summary = $this->eventRepo->getSummary();

            Response::success([
                'message' => '京都シティセントラル カレンダーのイベント情報を正常に同期しました',
                'syncResult' => $result,
                'summary' => $summary
            ]);
        } catch (Exception $e) {
            Response::error('イベント同期中にエラーが発生しました: ' . $e->getMessage());
        }
    }

    private function getCategories(): void {
        $categories = $this->eventRepo->getCategories();
        Response::success(['categories' => $categories]);
    }

    private function getCalendarEvents(): void {
        $month = (string)$this->getParam('month', date('Y-m'));
        $filters = [
            'source_type' => (string)$this->getParam('source_type', ''),
            'format' => (string)$this->getParam('format', ''),
            'keyword' => (string)$this->getParam('keyword', '')
        ];

        $events = $this->eventRepo->getAllCalendarEvents($month, $filters);
        $summary = $this->eventRepo->getSummary();
        $categories = $this->eventRepo->getCategories();

        Response::success([
            'month' => $month,
            'events' => $events,
            'summary' => $summary,
            'categories' => $categories
        ]);
    }

    private function saveChapterEvent(): void {
        $title = trim((string)$this->getParam('title', ''));
        if (empty($title)) {
            Response::error('イベント名を入力してください');
            return;
        }

        $startDatetime = trim((string)$this->getParam('start_datetime', ''));
        if (empty($startDatetime)) {
            Response::error('開始日時を入力してください');
            return;
        }

        $data = [
            'id' => (string)$this->getParam('id', ''),
            'title' => $title,
            'category' => (string)$this->getParam('category', 'チャプターイベント'),
            'start_datetime' => $startDatetime,
            'end_datetime' => (string)$this->getParam('end_datetime', ''),
            'location_name' => (string)$this->getParam('location_name', ''),
            'location_url' => (string)$this->getParam('location_url', ''),
            'is_online' => (int)$this->getParam('is_online', 0),
            'organizer' => (string)$this->getParam('organizer', ''),
            'description' => (string)$this->getParam('description', ''),
            'recurrence_rule' => (string)$this->getParam('recurrence_rule', $this->getParam('repeat_type', 'none')),
            'recurrence_until' => (string)$this->getParam('recurrence_until', $this->getParam('repeat_until', '')),
            'recurrence_count' => (int)$this->getParam('recurrence_count', $this->getParam('repeat_count', 0)),
            'recurrence_group_id' => (string)$this->getParam('recurrence_group_id', ''),
            'flyer_url' => trim((string)$this->getParam('flyer_url', ''))
        ];

        $res = $this->eventRepo->saveChapterEvent($data);
        $count = $res['count'] ?? 1;
        $message = ($count > 1) ? "{$count}件の定期予定を一括登録しました" : 'チャプター予定を保存しました';

        Response::success([
            'message' => $message,
            'id' => $res['id'] ?? '',
            'count' => $count,
            'group_id' => $res['group_id'] ?? ''
        ]);
    }

    private function uploadFlyer(): void {
        $uploadDir = dirname(__DIR__, 2) . '/uploads/flyers/';
        if (!file_exists($uploadDir)) {
            @mkdir($uploadDir, 0777, true);
        }

        // Support direct Base64 JSON payload
        $fileData = (string)$this->getParam('file_data', '');
        $fileName = (string)$this->getParam('file_name', '');

        if (!empty($fileData)) {
            // Check base64 format (e.g. data:image/png;base64,...)
            if (preg_match('/^data:([^;]+);base64,(.+)$/', $fileData, $matches)) {
                $data = base64_decode($matches[2]);
            } else {
                $data = base64_decode($fileData);
            }

            if (!$data) {
                Response::error('画像データのデコードに失敗しました');
                return;
            }

            $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'], true)) {
                $ext = 'jpg';
            }

            $newFileName = 'flyer_' . date('Ymd_His') . '_' . substr(uniqid(), -6) . '.' . $ext;
            $targetPath = $uploadDir . $newFileName;

            if (@file_put_contents($targetPath, $data) === false) {
                Response::error('チラシファイルの保存に失敗しました');
                return;
            }

            $publicUrl = 'uploads/flyers/' . $newFileName;
            Response::success([
                'url' => $publicUrl,
                'file_name' => $fileName ?: $newFileName,
                'message' => 'チラシを正常にアップロードしました'
            ]);
            return;
        }

        // Support multipart/form-data upload
        if (isset($_FILES['flyer']) && $_FILES['flyer']['error'] === UPLOAD_ERR_OK) {
            $tmpName = $_FILES['flyer']['tmp_name'];
            $origName = $_FILES['flyer']['name'];
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'], true)) {
                Response::error('対応していないファイル形式です (JPG, PNG, WebP, GIF, PDFのみ)');
                return;
            }

            $newFileName = 'flyer_' . date('Ymd_His') . '_' . substr(uniqid(), -6) . '.' . $ext;
            $targetPath = $uploadDir . $newFileName;

            if (@move_uploaded_file($tmpName, $targetPath)) {
                $publicUrl = 'uploads/flyers/' . $newFileName;
                Response::success([
                    'url' => $publicUrl,
                    'file_name' => $origName,
                    'message' => 'チラシを正常にアップロードしました'
                ]);
                return;
            } else {
                Response::error('アップロードファイルの保存に失敗しました');
                return;
            }
        }

        Response::error('アップロード対象のファイルが指定されていません');
    }

    private function deleteChapterEvent(): void {
        $id = (string)$this->getParam('id', '');
        if (empty($id)) {
            Response::error('削除対象の予定IDが指定されていません');
            return;
        }

        $deleteSeries = (bool)$this->getParam('delete_series', false);
        $res = $this->eventRepo->deleteChapterEvent($id, $deleteSeries);
        if ($res) {
            $msg = $deleteSeries ? '繰り返し予定を一括削除しました' : 'チャプター予定を削除しました';
            Response::success(['message' => $msg]);
        } else {
            Response::error('指定された予定の削除に失敗しました（見つかりません）');
        }
    }

    private function getChapterEvent(): void {
        $id = (string)$this->getParam('id', '');
        if (empty($id)) {
            Response::error('予定IDが指定されていません');
            return;
        }

        $event = $this->eventRepo->getChapterEventById($id);
        if (!$event) {
            Response::error('指定された予定が見つかりません');
            return;
        }

        Response::success(['event' => $event]);
    }

    private function saveMeetingCustomization(): void {
        $meetingDate = trim((string)$this->getParam('meeting_date', ''));
        if (empty($meetingDate)) {
            Response::error('定例会の日付が指定されていません');
            return;
        }

        $title = trim((string)$this->getParam('title', ''));
        if (empty($title)) {
            $title = 'REvoチャプター 定例会';
        }

        $data = [
            'meeting_date' => $meetingDate,
            'title' => $title,
            'category' => (string)$this->getParam('category', '定例会'),
            'is_online' => (int)$this->getParam('is_online', 1),
            'location_name' => (string)$this->getParam('location_name', ''),
            'location_url' => (string)$this->getParam('location_url', ''),
            'start_datetime' => (string)$this->getParam('start_datetime', $meetingDate . ' 06:45:00'),
            'end_datetime' => (string)$this->getParam('end_datetime', $meetingDate . ' 08:30:00'),
            'organizer' => (string)$this->getParam('organizer', 'REvoチャプター プレジデント & 運営チーム'),
            'description' => (string)$this->getParam('description', '')
        ];

        try {
            $res = $this->eventRepo->saveMeetingCustomization($data);
            Response::success([
                'message' => "{$meetingDate} の定例会情報を更新しました",
                'customization' => $res['customization'] ?? $data
            ]);
        } catch (Exception $e) {
            Response::error('定例会情報の更新に失敗しました: ' . $e->getMessage());
        }
    }

    private function resetMeetingCustomization(): void {
        $meetingDate = trim((string)$this->getParam('meeting_date', ''));
        if (empty($meetingDate)) {
            Response::error('定例会の日付が指定されていません');
            return;
        }

        $res = $this->eventRepo->resetMeetingCustomization($meetingDate);
        if ($res) {
            Response::success(['message' => "{$meetingDate} の定例会情報をデフォルトに戻しました"]);
        } else {
            Response::error('リセット対象のカスタマイズ設定が見つかりません');
        }
    }
}

