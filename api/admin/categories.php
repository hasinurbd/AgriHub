<?php
/**
 * =====================================================================
 * AgriHub API - Admin Category Management (CRUD)
 * File: api/admin/categories.php
 * Methods: GET, POST, PUT, PATCH, DELETE
 * Role: Admin Only
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

$admin = requireRole('admin');
$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

/**
 * Generate a URL-safe slug from a category name
 */
function buildCategorySlug(string $source): string {
    $slug = strtolower(trim($source));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
    return trim((string)$slug, '-');
}

if ($method === 'GET') {
    try {
        $where = ["1=1"];
        $params = [];

        if (!empty($_GET['search'])) {
            $where[] = "(c.name LIKE :search OR c.slug LIKE :search OR COALESCE(c.description, '') LIKE :search)";
            $params[':search'] = '%' . trim($_GET['search']) . '%';
        }

        $sql = "SELECT 
                    c.id,
                    c.name,
                    c.slug,
                    c.description,
                    c.created_at,
                    COUNT(p.id) AS product_count,
                    COALESCE(SUM(p.quantity_available), 0) AS total_stock_units
                FROM categories c
                LEFT JOIN products p ON p.category_id = c.id AND p.status != 'archived'
                WHERE " . implode(' AND ', $where) . "
                GROUP BY c.id, c.name, c.slug, c.description, c.created_at
                ORDER BY c.name ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $formatted = array_map(function ($row) {
            return [
                'id'                => (int)$row['id'],
                'name'              => $row['name'],
                'slug'              => $row['slug'],
                'description'       => $row['description'] ?? '',
                'created_at'        => $row['created_at'],
                'product_count'     => (int)$row['product_count'],
                'total_stock_units' => (float)$row['total_stock_units']
            ];
        }, $rows);

        sendJsonResponse(true, $formatted, 'Categories retrieved successfully.');
    } catch (PDOException $e) {
        error_log("Admin categories GET error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Failed to fetch categories.', 500);
    }
} elseif ($method === 'POST') {
    $input = getJsonInput();
    $name = trim((string)($input['name'] ?? ''));
    $rawSlug = trim((string)($input['slug'] ?? ''));
    $slug = $rawSlug !== '' ? buildCategorySlug($rawSlug) : buildCategorySlug($name);
    $description = isset($input['description']) ? trim((string)$input['description']) : null;
    if ($description === '') {
        $description = null;
    }

    $errors = [];
    if (strlen($name) < 2 || strlen($name) > 100) {
        $errors[] = 'Category name must be between 2 and 100 characters.';
    }
    if ($slug === '' || strlen($slug) > 120 || !preg_match('/^[a-z0-9-]+$/', $slug)) {
        $errors[] = 'Category slug must contain lowercase letters, numbers, or hyphens only (max 120 chars).';
    }

    if (!empty($errors)) {
        sendJsonResponse(false, ['errors' => $errors], implode(' ', $errors), 422);
    }

    try {
        $dupStmt = $pdo->prepare("SELECT id FROM categories WHERE name = :name OR slug = :slug LIMIT 1");
        $dupStmt->execute([':name' => $name, ':slug' => $slug]);
        if ($dupStmt->fetch()) {
            sendJsonResponse(false, null, 'A category with this name or slug already exists.', 409);
        }

        $insertStmt = $pdo->prepare(
            "INSERT INTO categories (name, slug, description) VALUES (:name, :slug, :description)"
        );
        $insertStmt->execute([
            ':name'        => $name,
            ':slug'        => $slug,
            ':description' => $description
        ]);

        $newId = (int)$pdo->lastInsertId();

        recordAuditLog($pdo, $admin['id'], 'CATEGORY_CREATED', [
            'category_id' => $newId,
            'name'        => $name,
            'slug'        => $slug
        ]);

        $fetchStmt = $pdo->prepare(
            "SELECT id, name, slug, description, created_at FROM categories WHERE id = :id LIMIT 1"
        );
        $fetchStmt->execute([':id' => $newId]);
        $created = $fetchStmt->fetch();

        sendJsonResponse(true, [
            'id'                => (int)$created['id'],
            'name'              => $created['name'],
            'slug'              => $created['slug'],
            'description'       => $created['description'] ?? '',
            'created_at'        => $created['created_at'],
            'product_count'     => 0,
            'total_stock_units' => 0.0
        ], 'Category created successfully.', 201);
    } catch (PDOException $e) {
        error_log("Admin categories POST error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Database error creating category.', 500);
    }
} elseif ($method === 'PUT' || $method === 'PATCH') {
    $input = getJsonInput();
    $id = (int)($input['id'] ?? 0);
    $name = trim((string)($input['name'] ?? ''));
    $rawSlug = trim((string)($input['slug'] ?? ''));
    $slug = $rawSlug !== '' ? buildCategorySlug($rawSlug) : buildCategorySlug($name);
    $description = isset($input['description']) ? trim((string)$input['description']) : null;
    if ($description === '') {
        $description = null;
    }

    $errors = [];
    if ($id <= 0) {
        $errors[] = 'Valid category ID is required.';
    }
    if (strlen($name) < 2 || strlen($name) > 100) {
        $errors[] = 'Category name must be between 2 and 100 characters.';
    }
    if ($slug === '' || strlen($slug) > 120 || !preg_match('/^[a-z0-9-]+$/', $slug)) {
        $errors[] = 'Category slug must contain lowercase letters, numbers, or hyphens only (max 120 chars).';
    }

    if (!empty($errors)) {
        sendJsonResponse(false, ['errors' => $errors], implode(' ', $errors), 422);
    }

    try {
        $existsStmt = $pdo->prepare("SELECT id, name, slug FROM categories WHERE id = :id LIMIT 1");
        $existsStmt->execute([':id' => $id]);
        $existing = $existsStmt->fetch();
        if (!$existing) {
            sendJsonResponse(false, null, 'Category not found.', 404);
        }

        $dupStmt = $pdo->prepare(
            "SELECT id FROM categories WHERE (name = :name OR slug = :slug) AND id != :id LIMIT 1"
        );
        $dupStmt->execute([':name' => $name, ':slug' => $slug, ':id' => $id]);
        if ($dupStmt->fetch()) {
            sendJsonResponse(false, null, 'Another category already uses this name or slug.', 409);
        }

        $updateStmt = $pdo->prepare(
            "UPDATE categories SET name = :name, slug = :slug, description = :description WHERE id = :id"
        );
        $updateStmt->execute([
            ':name'        => $name,
            ':slug'        => $slug,
            ':description' => $description,
            ':id'          => $id
        ]);

        recordAuditLog($pdo, $admin['id'], 'CATEGORY_UPDATED', [
            'category_id'   => $id,
            'previous_name' => $existing['name'],
            'name'          => $name,
            'slug'          => $slug
        ]);

        $fetchStmt = $pdo->prepare(
            "SELECT 
                c.id, c.name, c.slug, c.description, c.created_at,
                COUNT(p.id) AS product_count,
                COALESCE(SUM(p.quantity_available), 0) AS total_stock_units
             FROM categories c
             LEFT JOIN products p ON p.category_id = c.id AND p.status != 'archived'
             WHERE c.id = :id
             GROUP BY c.id, c.name, c.slug, c.description, c.created_at
             LIMIT 1"
        );
        $fetchStmt->execute([':id' => $id]);
        $updated = $fetchStmt->fetch();

        sendJsonResponse(true, [
            'id'                => (int)$updated['id'],
            'name'              => $updated['name'],
            'slug'              => $updated['slug'],
            'description'       => $updated['description'] ?? '',
            'created_at'        => $updated['created_at'],
            'product_count'     => (int)$updated['product_count'],
            'total_stock_units' => (float)$updated['total_stock_units']
        ], 'Category updated successfully.');
    } catch (PDOException $e) {
        error_log("Admin categories PUT error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Database error updating category.', 500);
    }
} elseif ($method === 'DELETE') {
    $input = getJsonInput();
    $id = (int)($input['id'] ?? $_GET['id'] ?? 0);

    if ($id <= 0) {
        sendJsonResponse(false, null, 'Valid category ID is required.', 422);
    }

    try {
        $existsStmt = $pdo->prepare("SELECT id, name, slug FROM categories WHERE id = :id LIMIT 1");
        $existsStmt->execute([':id' => $id]);
        $existing = $existsStmt->fetch();
        if (!$existing) {
            sendJsonResponse(false, null, 'Category not found.', 404);
        }

        $refStmt = $pdo->prepare("SELECT COUNT(*) FROM products WHERE category_id = :id");
        $refStmt->execute([':id' => $id]);
        $linkedCount = (int)$refStmt->fetchColumn();

        if ($linkedCount > 0) {
            sendJsonResponse(
                false,
                ['linked_products' => $linkedCount],
                "Cannot delete '{$existing['name']}' because {$linkedCount} product(s) are assigned to it. Reassign or remove those products first.",
                409
            );
        }

        $delStmt = $pdo->prepare("DELETE FROM categories WHERE id = :id");
        $delStmt->execute([':id' => $id]);

        recordAuditLog($pdo, $admin['id'], 'CATEGORY_DELETED', [
            'category_id' => $id,
            'name'        => $existing['name'],
            'slug'        => $existing['slug']
        ]);

        sendJsonResponse(true, ['id' => $id], 'Category deleted successfully.');
    } catch (PDOException $e) {
        error_log("Admin categories DELETE error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Database error deleting category.', 500);
    }
} else {
    sendJsonResponse(false, null, 'Method not allowed.', 405);
}
