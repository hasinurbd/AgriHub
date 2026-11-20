<?php
/**
 * =====================================================================
 * AgriHub API - List Categories
 * File: api/products/categories.php
 * Method: GET
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

try {
    $pdo = Database::getConnection();
    $stmt = $pdo->query("SELECT id, name, slug, description, created_at FROM categories ORDER BY name ASC");
    $categories = $stmt->fetchAll();

    sendJsonResponse(true, $categories, 'Categories retrieved successfully.');
} catch (PDOException $e) {
    error_log("Categories error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Failed to fetch categories.', 500);
}
