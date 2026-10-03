<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Checkin;
use App\Models\Staff;
use App\Models\StaffDayoff;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CheckinController extends Controller
{
    /**
     * System & Database status check.
     */
    public function status()
    {
        $dbConnected = false;
        $dbError = null;

        try {
            DB::connection()->getPdo();
            $dbConnected = true;
        } catch (\Throwable $e) {
            $dbError = $e->getMessage();
        }

        return response()->json([
            'status' => 'online',
            'framework' => 'Laravel ' . app()->version(),
            'php_version' => PHP_VERSION,
            'database' => [
                'connected' => $dbConnected,
                'connection' => config('database.default'),
                'database_name' => config('database.connections.' . config('database.default') . '.database'),
                'error' => $dbError,
                'total_checkins' => $dbConnected ? Checkin::count() : 0,
            ],
            'timestamp' => now()->toISOString(),
        ]);
    }

    /**
     * Comprehensive Admin Dashboard KPI Statistics.
     */
    public function stats()
    {
        $today = Carbon::today();

        $totalAll = Checkin::count();
        $activeNow = Checkin::where('status', 'checked_in')->count();
        $checkedOutToday = Checkin::where('status', 'checked_out')
            ->whereDate('check_out_at', $today)
            ->count();
        $totalToday = Checkin::whereDate('created_at', $today)->count();

        // Staff specific attendance KPIs
        $totalStaff = Staff::count();
        $staffCheckedInToday = Checkin::where(function ($q) {
            $q->where('type', 'employee')->orWhereNotNull('staff_id');
        })->where('status', 'checked_in')->count();

        $staffCheckedOutToday = Checkin::where(function ($q) {
            $q->where('type', 'employee')->orWhereNotNull('staff_id');
        })->where('status', 'checked_out')
        ->whereDate('check_out_at', $today)
        ->count();

        $dayoffToday = StaffDayoff::whereDate('date', $today)->count();

        // Breakdown by visitor / person type
        $typeBreakdown = Checkin::select('type', DB::raw('count(*) as count'))
            ->groupBy('type')
            ->pluck('count', 'type');

        // Breakdown by department
        $departmentBreakdown = Checkin::whereNotNull('department')
            ->select('department', DB::raw('count(*) as count'))
            ->groupBy('department')
            ->pluck('count', 'department');

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_staff' => $totalStaff,
                'staff_checked_in_today' => $staffCheckedInToday,
                'staff_checked_out_today' => $staffCheckedOutToday,
                'dayoff_today' => $dayoffToday,
                'total_all' => $totalAll,
                'active_now' => $activeNow,
                'checked_out_today' => $checkedOutToday,
                'total_today' => $totalToday,
                'by_type' => $typeBreakdown,
                'by_department' => $departmentBreakdown,
            ],
        ]);
    }

    /**
     * List all check-ins with search, filter, and pagination support.
     */
    public function index(Request $request)
    {
        $query = Checkin::query();

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('badge_no', 'like', "%{$search}%")
                  ->orWhere('department', 'like', "%{$search}%")
                  ->orWhere('location', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('type') && $request->input('type') !== 'all') {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('department') && $request->input('department') !== 'all') {
            $query->where('department', $request->input('department'));
        }

        $checkins = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $checkins,
        ]);
    }

    /**
     * Store a new check-in.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|max:150',
            'type' => 'nullable|string|in:employee,visitor,contractor,guest',
            'department' => 'nullable|string|max:100',
            'badge_no' => 'nullable|string|max:50',
            'location' => 'nullable|string|max:100',
            'note' => 'nullable|string|max:255',
        ]);

        $checkin = Checkin::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'type' => $validated['type'] ?? 'employee',
            'department' => $validated['department'] ?? 'General',
            'badge_no' => $validated['badge_no'] ?? ('BADGE-' . strtoupper(substr(uniqid(), -4))),
            'location' => $validated['location'] ?? 'Main Entrance',
            'note' => $validated['note'] ?? null,
            'status' => 'checked_in',
            'check_in_at' => now(),
            'check_out_at' => null,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "{$checkin->name} checked in successfully!",
            'data' => $checkin,
        ], 201);
    }

    /**
     * Check out a person.
     */
    public function checkout($id)
    {
        $checkin = Checkin::findOrFail($id);

        if ($checkin->status === 'checked_out') {
            return response()->json([
                'status' => 'error',
                'message' => 'This person has already checked out.',
            ], 400);
        }

        $checkin->update([
            'status' => 'checked_out',
            'check_out_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "{$checkin->name} checked out successfully.",
            'data' => $checkin,
        ]);
    }

    /**
     * Bulk check out all active occupants.
     */
    public function bulkCheckout()
    {
        $updated = Checkin::where('status', 'checked_in')->update([
            'status' => 'checked_out',
            'check_out_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "{$updated} occupants checked out successfully.",
            'count' => $updated,
        ]);
    }

    /**
     * Seed realistic sample data for demo.
     */
    public function seedSamples()
    {
        $samples = [
            [
                'name' => 'Camille Laurent',
                'email' => 'camille@chafe.co',
                'type' => 'guest',
                'department' => 'Dine-In',
                'badge_no' => 'TBL-04',
                'location' => 'Main Dining - Table 4',
                'note' => 'Specialty Ethiopian Pour-Over & Croissant',
                'status' => 'checked_in',
                'check_in_at' => now()->subHours(1)->subMinutes(25),
                'check_out_at' => null,
            ],
            [
                'name' => 'Liam Gallagher',
                'email' => 'liam.barista@chafe.co',
                'type' => 'employee',
                'department' => 'Barista Team',
                'badge_no' => 'STF-102',
                'location' => 'Espresso Bar Station',
                'note' => 'Morning Espresso Shift Lead',
                'status' => 'checked_in',
                'check_in_at' => now()->subHours(3)->subMinutes(40),
                'check_out_at' => null,
            ],
            [
                'name' => 'Chloe Bennett',
                'email' => 'chloe.b@creativework.io',
                'type' => 'visitor',
                'department' => 'Workspace',
                'badge_no' => 'TBL-09',
                'location' => 'Garden Patio - Table 9',
                'note' => 'Laptop work session & Oat Milk Latte',
                'status' => 'checked_in',
                'check_in_at' => now()->subMinutes(45),
                'check_out_at' => null,
            ],
            [
                'name' => 'Mateo Rossi',
                'email' => 'deliveries@roastersupply.com',
                'type' => 'contractor',
                'department' => 'Logistics',
                'badge_no' => 'SPL-55',
                'location' => 'Back Kitchen & Roastery',
                'note' => 'Fresh single-origin beans delivery',
                'status' => 'checked_out',
                'check_in_at' => now()->subHours(4),
                'check_out_at' => now()->subHours(3)->subMinutes(15),
            ],
            [
                'name' => 'Dr. Elena Vance',
                'email' => 'elena.vance@chafemembers.com',
                'type' => 'guest',
                'department' => 'VIP Lounge',
                'badge_no' => 'VIP-08',
                'location' => 'Private Mezzanine Booth',
                'note' => 'Signature Tasting Menu Reservation',
                'status' => 'checked_out',
                'check_in_at' => now()->subHours(2)->subMinutes(30),
                'check_out_at' => now()->subMinutes(30),
            ],
        ];

        foreach ($samples as $sample) {
            Checkin::updateOrCreate(
                ['email' => $sample['email']],
                $sample
            );
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Sample demo records created successfully.',
        ]);
    }

    /**
     * Delete a check-in.
     */
    public function destroy($id)
    {
        $checkin = Checkin::findOrFail($id);
        $checkin->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Record removed successfully.',
        ]);
    }
}
