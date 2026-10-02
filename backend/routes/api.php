<?php

use App\Http\Controllers\Api\CheckinController;
use App\Http\Controllers\Api\ControlController;
use App\Http\Controllers\Api\StaffController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Status & Dashboard Overview
Route::get('/status', [CheckinController::class, 'status']);
Route::get('/stats', [CheckinController::class, 'stats']);

// Checkins & Checkouts
Route::get('/checkins', [CheckinController::class, 'index']);
Route::post('/checkins', [CheckinController::class, 'store']);
Route::post('/checkins/bulk-checkout', [CheckinController::class, 'bulkCheckout']);
Route::post('/checkins/seed-samples', [CheckinController::class, 'seedSamples']);
Route::post('/checkins/{id}/checkout', [CheckinController::class, 'checkout']);
Route::delete('/checkins/{id}', [CheckinController::class, 'destroy']);

// Staff Management
Route::get('/staff', [StaffController::class, 'index']);
Route::post('/staff', [StaffController::class, 'store']);
Route::put('/staff/{id}', [StaffController::class, 'update']);
Route::delete('/staff/{id}', [StaffController::class, 'destroy']);
Route::post('/staff/seed', [StaffController::class, 'seedStaff']);

// Performance Analytics
Route::get('/performance', [StaffController::class, 'performance']);

// Control Room & QR Generator
Route::get('/control/today', [ControlController::class, 'todayCheckins']);
Route::get('/control/qr', [ControlController::class, 'qrConfig']);

// Settings
Route::get('/settings', [ControlController::class, 'settings']);
Route::post('/settings', [ControlController::class, 'settings']);

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
