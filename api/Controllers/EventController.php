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
            case 'save_chapter_event':
                $this->saveChapterEvent();
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
            'description' => (string)$this->getParam('description', '')
        ];

        $id = $this->eventRepo->saveChapterEvent($data);
        Response::success([
            'message' => 'チャプター予定を保存しました',
            'id' => $id
        ]);
    }

    private function deleteChapterEvent(): void {
        $id = (string)$this->getParam('id', '');
        if (empty($id)) {
            Response::error('削除対象の予定IDが指定されていません');
            return;
        }

        $res = $this->eventRepo->deleteChapterEvent($id);
        if ($res) {
            Response::success(['message' => 'チャプター予定を削除しました']);
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
}

