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
            case 'reorder':
                $this->reorderLinks();
                break;
            case 'reorder_categories':
                $this->reorderCategories();
                break;
            case 'save_category':
                $this->saveCategory();
                break;
            case 'delete_category':
                $this->deleteCategory();
                break;
            default:
                $this->listLinks();
                break;
        }
    }

    private function listLinks(): void {
        $links = $this->linkRepo->getAll();
        $categories = $this->linkRepo->getCategories();
        Response::success([
            'links' => $links,
            'categories' => $categories
        ]);
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
            'category' => (string)$this->getParam('category', 'メンバー情報'),
            'scope' => (string)$this->getParam('scope', ''),
            'description' => (string)$this->getParam('description', ''),
            'icon' => (string)$this->getParam('icon', 'fa-solid fa-link'),
            'sort_order' => (int)$this->getParam('sort_order', 0)
        ];

        $ok = $this->linkRepo->save($data);
        if ($ok) {
            Response::success([
                'message' => 'リンク情報を保存しました',
                'links' => $this->linkRepo->getAll(),
                'categories' => $this->linkRepo->getCategories()
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
                'links' => $this->linkRepo->getAll(),
                'categories' => $this->linkRepo->getCategories()
            ]);
        } else {
            Response::error('リンクの削除に失敗しました');
        }
    }

    private function reorderLinks(): void {
        $items = $this->getParam('items', null);
        if (!is_array($items)) {
            // Support 'orders' or 'links'
            $items = $this->getParam('orders', $this->getParam('links', []));
        }

        if (empty($items) || !is_array($items)) {
            Response::error('並び替えデータが不正です');
            return;
        }

        $ok = $this->linkRepo->reorderLinks($items);
        if ($ok) {
            Response::success([
                'message' => '並び順を更新しました',
                'links' => $this->linkRepo->getAll()
            ]);
        } else {
            Response::error('並び順の更新に失敗しました');
        }
    }

    private function reorderCategories(): void {
        $items = $this->getParam('items', null);
        if (!is_array($items)) {
            $items = $this->getParam('orders', $this->getParam('categories', []));
        }

        if (empty($items) || !is_array($items)) {
            Response::error('並び替えデータが不正です');
            return;
        }

        $ok = $this->linkRepo->reorderCategories($items);
        if ($ok) {
            Response::success([
                'message' => 'カテゴリーの並び順を更新しました',
                'categories' => $this->linkRepo->getCategories()
            ]);
        } else {
            Response::error('カテゴリーの並び順更新に失敗しました');
        }
    }

    private function saveCategory(): void {
        $name = trim((string)$this->getParam('name', ''));
        if ($name === '') {
            Response::error('カテゴリー名を入力してください');
            return;
        }

        $data = [
            'id' => $this->getParam('id', null),
            'name' => $name,
            'icon' => (string)$this->getParam('icon', 'fa-solid fa-folder'),
            'sort_order' => (int)$this->getParam('sort_order', 0),
            'scope' => (string)$this->getParam('scope', 'member')
        ];

        $ok = $this->linkRepo->saveCategory($data);
        if ($ok) {
            Response::success([
                'message' => 'カテゴリーを保存しました',
                'categories' => $this->linkRepo->getCategories(),
                'links' => $this->linkRepo->getAll()
            ]);
        } else {
            Response::error('カテゴリーの保存に失敗しました');
        }
    }

    private function deleteCategory(): void {
        $id = (string)$this->getParam('id', $this->getParam('name', ''));
        if (!$id) {
            Response::error('カテゴリーが指定されていません');
            return;
        }

        $ok = $this->linkRepo->deleteCategory($id);
        if ($ok) {
            Response::success([
                'message' => 'カテゴリーを削除しました',
                'categories' => $this->linkRepo->getCategories(),
                'links' => $this->linkRepo->getAll()
            ]);
        } else {
            Response::error('カテゴリーの削除に失敗しました');
        }
    }
}
