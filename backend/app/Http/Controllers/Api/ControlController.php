<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Checkin;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ControlController extends Controller
{
    /**
     * Compact list of ONLY TODAY's check-ins and check-outs for fast control room view.
     */
    public function todayCheckins()
    {
        $today = Carbon::today();

        $records = Checkin::whereDate('created_at', $today)
            ->orWhereDate('check_in_at', $today)
            ->orderBy('created_at', 'desc')
            ->get();

        $activeCount = $records->where('status', 'checked_in')->count();
        $checkedOutCount = $records->where('status', 'checked_out')->count();

        return response()->json([
            'status' => 'success',
            'summary' => [
                'date' => $today->toFormattedDateString(),
                'total_today' => $records->count(),
                'active_now' => $activeCount,
                'checked_out_today' => $checkedOutCount,
            ],
            'data' => $records,
        ]);
    }

    /**
     * Get or Generate QR Check-In / Check-Out Station configurations.
     */
    public function qrConfig(Request $request)
    {
        $type = $request->input('type', 'guest'); // 'guest' | 'staff' | 'checkout'
        $baseUrl = config('app.url', 'http://127.0.0.1:8000');

        $qrCodeUrls = [
            'guest' => [
                'title' => 'Chafé Guest Self Check-In',
                'description' => 'Scan with phone camera to choose your table and register arrival.',
                'target_url' => "{$baseUrl}/guest-checkin?cafe=chafe",
                'code_data' => "CHAFE-GUEST-TABLE-CHECKIN-" . now()->format('Ymd'),
            ],
            'staff' => [
                'title' => 'Chafé Staff Shift Clock-In',
                'description' => 'Staff members scan to record punctual shift arrival.',
                'target_url' => "{$baseUrl}/staff-shift?cafe=chafe",
                'code_data' => "CHAFE-STAFF-SHIFT-CLOCKIN-" . now()->format('Ymd'),
            ],
            'checkout' => [
                'title' => 'Express Self Check-Out',
                'description' => 'Scan at the exit or payment counter to complete visit.',
                'target_url' => "{$baseUrl}/express-checkout?cafe=chafe",
                'code_data' => "CHAFE-EXPRESS-CHECKOUT-" . now()->format('Ymd'),
            ],
        ];

        return response()->json([
            'status' => 'success',
            'data' => $qrCodeUrls[$type] ?? $qrCodeUrls['guest'],
        ]);
    }

    /**
     * Get or update settings for Chafé.
     */
    public function settings(Request $request)
    {
        if ($request->isMethod('post')) {
            $validated = $request->validate([
                'cafe_name' => 'required|string|max:100',
                'operating_hours' => 'nullable|string|max:100',
                'late_grace_period_mins' => 'nullable|integer|min:0|max:60',
                'seating_capacity' => 'nullable|integer|min:1|max:500',
                'wifi_ssid' => 'nullable|string|max:100',
                'wifi_password' => 'nullable|string|max:100',
            ]);

            // Save in application cache or file
            cache()->forever('chafe_settings', $validated);

            return response()->json([
                'status' => 'success',
                'message' => 'Chafé settings updated successfully!',
                'data' => $validated,
            ]);
        }

        $defaultSettings = [
            'cafe_name' => 'Chafé',
            'tagline' => 'Artisan Roastery & Lounge',
            'operating_hours' => '07:00 AM - 10:00 PM',
            'late_grace_period_mins' => 10,
            'seating_capacity' => 48,
            'wifi_ssid' => 'Chafe_Specialty_Guest',
            'wifi_password' => 'coffee2026',
        ];

        $settings = cache()->get('chafe_settings', $defaultSettings);

        return response()->json([
            'status' => 'success',
            'data' => $settings,
        ]);
    }
}
