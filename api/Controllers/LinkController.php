<?php
namespace Api\Controllers;

use Api\Core\Controller;
use Api\Core\Response;
use Api\Repositories\LinkRepository;

class LinkController extends Controller {
    private LinkRepository $linkRepo;

    public function __construct(?LinkRepository $linkRepo = null) {
        parent::__construct();
        $this->linkRepo = $linkRepo ?? new LinkRepository();
    }

    public function handle(): void {
        $action = $this->getAction();

        switch ($action) {
            case 'list':
            case 'get':
                $this->listLinks();
                break;
            case 'save':
            case 'update':
            case 'create':
                $this->saveLink();
                break;
            case 'delete':
                $this->deleteLink();
                break;
            default:
                $this->listLinks();
                break;
        }
    }

    private function listLinks(): void {
        $links = $this->linkRepo->getAll();
        Response::success(['links' => $links]);
    }

    private function saveLink(): void {
        $title = trim((string)$this->getParam('title', ''));
        $url = trim((string)$this->getParam('url', ''));

        if ($title === '') {
            Response::error('タイトルを入力してください');
            return;
        }
        if ($url === '') {
            Response::error('URLを入力してください');
            return;
        }

        $data = [
            'id' => $this->getParam('id', null),
            'title' => $title,
            'url' => $url,
            'category' => (string)$this->getParam('category', '定例会・運営'),
            'description' => (string)$this->getParam('description', ''),
            'icon' => (string)$this->getParam('icon', 'fa-solid fa-link'),
            'sort_order' => (int)$this->getParam('sort_order', 0)
        ];

        $ok = $this->linkRepo->save($data);
        if ($ok) {
            Response::success([
                'message' => 'リンク情報を保存しました',
                'links' => $this->linkRepo->getAll()
            ]);
        } else {
            Response::error('リンク情報の保存に失敗しました');
        }
    }

    private function deleteLink(): void {
        $id = (string)$this->getParam('id', '');
        if (!$id) {
            Response::error('IDが指定されていません');
            return;
        }

        $ok = $this->linkRepo->delete($id);
        if ($ok) {
            Response::success([
                'message' => 'リンクを削除しました',
                'links' => $this->linkRepo->getAll()
            ]);
        } else {
            Response::error('リンクの削除に失敗しました');
        }
    }
}
