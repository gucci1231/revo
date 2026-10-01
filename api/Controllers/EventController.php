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

    private function getSummary(): void {
        $summary = $this->eventRepo->getSummary();
        Response::success(['summary' => $summary]);
    }
}
