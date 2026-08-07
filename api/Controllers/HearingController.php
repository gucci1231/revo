<?php
namespace Api\Controllers;

use Api\Core\Controller;
use Api\Core\Response;
use Api\Repositories\HearingRepository;
use Api\Repositories\VisitorRepository;
use Api\Repositories\MemberRepository;

class HearingController extends Controller {
    private HearingRepository $hearingRepo;
    private VisitorRepository $visitorRepo;
    private MemberRepository $memberRepo;

    public function __construct(
        ?HearingRepository $hearingRepo = null,
        ?VisitorRepository $visitorRepo = null,
        ?MemberRepository $memberRepo = null
    ) {
        parent::__construct();
        $this->hearingRepo = $hearingRepo ?? new HearingRepository();
        $this->visitorRepo = $visitorRepo ?? new VisitorRepository();
        $this->memberRepo = $memberRepo ?? new MemberRepository();
    }

    public function handle(): void {
        $action = $this->getAction();

        switch ($action) {
            case 'list':
                $this->list();
                break;
            case 'get':
                $this->get();
                break;
            case 'save':
                $this->save();
                break;
            default:
                Response::error('Invalid action');
        }
    }

    private function list(): void {
        $list = $this->hearingRepo->getAllWithVisitorInfo();
        Response::success(['list' => $list]);
    }

    private function get(): void {
        $vId = $this->getParam('visitorId', '');
        if (!$vId) {
            Response::error('visitorId is required');
        }

        $vInfoRaw = $this->visitorRepo->findById($vId);
        $vInfo = [
            'visitor_name' => $vInfoRaw['visitor_name'] ?? '',
            'inviter' => $vInfoRaw['inviter'] ?? '',
            'company' => $vInfoRaw['company'] ?? '',
            'profession' => $vInfoRaw['profession'] ?? '',
            'event_date' => $vInfoRaw['event_date'] ?? ''
        ];

        $h = $this->hearingRepo->findByVisitorId($vId);

        $formData = [
            'visitorId' => $vId,
            'orientUser' => $h['orient_user'] ?? '',
            'q1' => $h['q1'] ?? '', 'q2' => $h['q2'] ?? '', 'q3' => $h['q3'] ?? '',
            'q4' => $h['q4'] ?? '', 'q5' => $h['q5'] ?? '', 'q6' => $h['q6'] ?? '', 'q7' => $h['q7'] ?? '',
            'feelAbc' => $h['feel_abc'] ?? '',
            'orientMemo' => $h['orient_memo'] ?? '',
            'followMemo' => $h['follow_memo'] ?? '',
            'sheetUrl' => $h['sheet_url'] ?? ''
        ];

        $groupedMembers = $this->memberRepo->getGroupedByCategory();
        $memberCategories = $groupedMembers['memberCategories'] ?? [];

        Response::success([
            'visitorInfo' => $vInfo,
            'formData' => $formData,
            'memberCategories' => $memberCategories
        ]);
    }

    private function save(): void {
        $vId = $this->getParam('visitorId', '');
        if (!$vId) {
            Response::error('visitorId is required');
        }

        $now = date('Y/m/d H:i');

        $existing = $this->hearingRepo->findByVisitorId($vId);
        $sheetUrl = $this->getParam('sheetUrl');
        if ($sheetUrl === null && $existing) {
            $sheetUrl = $existing['sheet_url'] ?? '';
        }

        $this->hearingRepo->saveHearingSheet([
            'visitor_id' => $vId,
            'orient_user' => $this->getParam('orientUser', ''),
            'q1' => $this->getParam('q1', ''),
            'q2' => $this->getParam('q2', ''),
            'q3' => $this->getParam('q3', ''),
            'q4' => $this->getParam('q4', ''),
            'q5' => $this->getParam('q5', ''),
            'q6' => $this->getParam('q6', ''),
            'q7' => $this->getParam('q7', ''),
            'feel_abc' => $this->getParam('feelAbc', ''),
            'orient_memo' => $this->getParam('orientMemo', ''),
            'follow_memo' => $this->getParam('followMemo', ''),
            'sheet_url' => $sheetUrl ?? '',
            'updated_at' => $now
        ]);

        Response::success(['visitorId' => $vId]);
    }
}

