<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Checkin;
use App\Models\Staff;
use Carbon\Carbon;
use Illuminate\Http\Request;

class StaffController extends Controller
{
    /**
     * List all staff members with their role, shift times, current status, and today's dayoff flag.
     */
    public function index()
    {
        $today = Carbon::today()->toDateString();
        $staffMembers = Staff::with([
            'checkins' => function ($query) {
                $query->latest()->limit(5);
            },
            'dayoffs' => function ($query) use ($today) {
                $query->where('date', '>=', $today)->orderBy('date', 'asc');
            },
        ])->orderBy('name')->get();

        // Attach active shift status and day off info
        $data = $staffMembers->map(function ($s) use ($today) {
            $latestCheckin = $s->checkins->first();
            $isOnShift = $latestCheckin && $latestCheckin->status === 'checked_in';
            $todayDayoff = $s->dayoffs->firstWhere('date', $today);

            return [
                'id' => $s->id,
                'name' => $s->name,
                'email' => $s->email,
                'username' => $s->username ?? strtolower(explode('@', $s->email)[0]),
                'role' => $s->role,
                'shift_start' => $s->shift_start,
                'shift_end' => $s->shift_end,
                'hourly_rate' => $s->hourly_rate,
                'status' => $s->status,
                'avatar_color' => $s->avatar_color,
                'is_on_shift' => $isOnShift,
                'has_dayoff_today' => !is_null($todayDayoff),
                'dayoff_today' => $todayDayoff,
                'upcoming_dayoffs' => $s->dayoffs->take(3),
                'latest_checkin' => $latestCheckin,
                'created_at' => $s->created_at->toISOString(),
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    /**
     * Create a new staff member with login credentials.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|max:150|unique:staff,email',
            'username' => 'nullable|string|max:50|unique:staff,username',
            'password' => 'nullable|string|min:4',
            'role' => 'required|string|max:100',
            'shift_start' => 'nullable|string|max:10',
            'shift_end' => 'nullable|string|max:10',
            'hourly_rate' => 'nullable|numeric|min:0',
        ]);

        $colors = ['amber', 'emerald', 'sky', 'indigo', 'purple', 'rose'];
        $randomColor = $colors[array_rand($colors)];

        // Generate clean username if not provided
        $username = !empty($validated['username'])
            ? trim(strtolower($validated['username']))
            : strtolower(preg_replace('/[^a-zA-Z0-9]/', '', explode('@', $validated['email'])[0]));

        // Ensure unique username
        $baseUsername = $username;
        $counter = 1;
        while (Staff::where('username', $username)->exists()) {
            $username = $baseUsername . $counter;
            $counter++;
        }

        $passwordRaw = !empty($validated['password']) ? $validated['password'] : '123456';

        $staff = Staff::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $username,
            'password' => \Illuminate\Support\Facades\Hash::make($passwordRaw),
            'role' => $validated['role'],
            'shift_start' => $validated['shift_start'] ?? '07:30',
            'shift_end' => $validated['shift_end'] ?? '16:00',
            'hourly_rate' => $validated['hourly_rate'] ?? 19.50,
            'status' => 'active',
            'avatar_color' => $randomColor,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "Staff member {$staff->name} created successfully! (Username: {$username})",
            'data' => [
                'id' => $staff->id,
                'name' => $staff->name,
                'email' => $staff->email,
                'username' => $staff->username,
                'role' => $staff->role,
                'shift_start' => $staff->shift_start,
                'shift_end' => $staff->shift_end,
                'hourly_rate' => $staff->hourly_rate,
                'status' => $staff->status,
                'avatar_color' => $staff->avatar_color,
            ],
        ], 201);
    }

    /**
     * Update staff details, assigned role, credentials, or shift times.
     */
    public function update(Request $request, $id)
    {
        $staff = Staff::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'username' => 'sometimes|string|max:50|unique:staff,username,' . $staff->id,
            'password' => 'nullable|string|min:4',
            'role' => 'sometimes|string|max:100',
            'shift_start' => 'sometimes|string|max:10',
            'shift_end' => 'sometimes|string|max:10',
            'hourly_rate' => 'sometimes|numeric|min:0',
            'status' => 'sometimes|string|in:active,on_break,off_duty',
        ]);

        if (!empty($validated['password'])) {
            $validated['password'] = \Illuminate\Support\Facades\Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $staff->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => "Staff {$staff->name} updated successfully.",
            'data' => [
                'id' => $staff->id,
                'name' => $staff->name,
                'email' => $staff->email,
                'username' => $staff->username,
                'role' => $staff->role,
                'shift_start' => $staff->shift_start,
                'shift_end' => $staff->shift_end,
                'hourly_rate' => $staff->hourly_rate,
                'status' => $staff->status,
                'avatar_color' => $staff->avatar_color,
            ],
        ]);
    }

    /**
     * Remove staff member.
     */
    public function destroy($id)
    {
        $staff = Staff::findOrFail($id);
        $staff->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Staff member deleted.',
        ]);
    }

    /**
     * Comprehensive Staff Performance analytics:
     * - On-time vs Late arrivals
     * - Punctuality score
     * - Performance rating
     * - Total hours worked
     */
    public function performance()
    {
        $staffMembers = Staff::all();

        $performanceData = $staffMembers->map(function ($s) {
            $records = Checkin::where('staff_id', $s->id)
                ->orWhere('email', $s->email)
                ->get();

            $totalShifts = $records->count();
            $lateShifts = $records->where('punctuality_status', 'late')->count();
            $onTimeShifts = $records->where('punctuality_status', 'on_time')->count();
            $totalLateMinutes = $records->sum('late_minutes');

            // Default calculation if new staff
            $punctualityScore = $totalShifts > 0
                ? round((($totalShifts - $lateShifts) / $totalShifts) * 100)
                : 100;

            $rating = 'Star Performer';
            if ($punctualityScore < 75) {
                $rating = 'Needs Improvement';
            } elseif ($punctualityScore < 90) {
                $rating = 'Standard';
            }

            // Estimate total hours logged
            $totalMinutesWorked = 0;
            foreach ($records as $r) {
                if ($r->check_in_at && $r->check_out_at) {
                    $totalMinutesWorked += $r->check_in_at->diffInMinutes($r->check_out_at);
                } elseif ($r->check_in_at) {
                    $totalMinutesWorked += $r->check_in_at->diffInMinutes(now());
                }
            }

            $hoursWorked = round($totalMinutesWorked / 60, 1);

            return [
                'staff_id' => $s->id,
                'name' => $s->name,
                'email' => $s->email,
                'role' => $s->role,
                'shift_start' => $s->shift_start,
                'shift_end' => $s->shift_end,
                'total_shifts' => $totalShifts,
                'on_time_shifts' => $onTimeShifts,
                'late_shifts' => $lateShifts,
                'total_late_minutes' => $totalLateMinutes,
                'punctuality_score' => $punctualityScore,
                'rating' => $rating,
                'hours_worked' => $hoursWorked,
                'recent_logs' => $records->take(5),
            ];
        });

        // Overall team performance KPIs
        $totalTeamShifts = $performanceData->sum('total_shifts');
        $totalTeamLate = $performanceData->sum('late_shifts');
        $overallPunctuality = $totalTeamShifts > 0
            ? round((($totalTeamShifts - $totalTeamLate) / $totalTeamShifts) * 100)
            : 0;

        return response()->json([
            'status' => 'success',
            'data' => [
                'overall_punctuality' => $overallPunctuality,
                'total_shifts' => $totalTeamShifts,
                'total_late_arrivals' => $totalTeamLate,
                'staff_performance' => $performanceData,
            ],
        ]);
    }

    /**
     * Pre-seed realistic Chafé staff roster.
     */
    public function seedStaff()
    {
        $roster = [
            [
                'name' => 'Liam Gallagher',
                'email' => 'liam.barista@chafe.co',
                'username' => 'liam',
                'password' => \Illuminate\Support\Facades\Hash::make('123456'),
                'role' => 'Head Barista',
                'shift_start' => '07:00',
                'shift_end' => '15:30',
                'hourly_rate' => 24.50,
                'status' => 'active',
                'avatar_color' => 'amber',
            ],
            [
                'name' => 'Maya Lin',
                'email' => 'maya.lin@chafe.co',
                'username' => 'maya',
                'password' => \Illuminate\Support\Facades\Hash::make('123456'),
                'role' => 'Senior Latte Artist',
                'shift_start' => '07:30',
                'shift_end' => '16:00',
                'hourly_rate' => 21.00,
                'status' => 'active',
                'avatar_color' => 'emerald',
            ],
            [
                'name' => 'Lucas Meyer',
                'email' => 'lucas.pastry@chafe.co',
                'username' => 'lucas',
                'password' => \Illuminate\Support\Facades\Hash::make('123456'),
                'role' => 'Artisan Pastry Chef',
                'shift_start' => '06:00',
                'shift_end' => '14:30',
                'hourly_rate' => 23.00,
                'status' => 'active',
                'avatar_color' => 'purple',
            ],
            [
                'name' => 'Aiden Reed',
                'email' => 'aiden.cashier@chafe.co',
                'username' => 'aiden',
                'password' => \Illuminate\Support\Facades\Hash::make('123456'),
                'role' => 'Front Counter & Cashier',
                'shift_start' => '08:30',
                'shift_end' => '17:00',
                'hourly_rate' => 19.00,
                'status' => 'active',
                'avatar_color' => 'sky',
            ],
            [
                'name' => 'Chloe Bennett',
                'email' => 'chloe.supervisor@chafe.co',
                'username' => 'chloe',
                'password' => \Illuminate\Support\Facades\Hash::make('123456'),
                'role' => 'Shift Supervisor',
                'shift_start' => '10:00',
                'shift_end' => '18:30',
                'hourly_rate' => 25.00,
                'status' => 'active',
                'avatar_color' => 'rose',
            ],
        ];

        foreach ($roster as $item) {
            $staff = Staff::updateOrCreate(
                ['email' => $item['email']],
                $item
            );

            // Also create attendance checkin history for performance evaluation
            $isLiam = $item['name'] === 'Liam Gallagher';
            $isAiden = $item['name'] === 'Aiden Reed';

            // Liam is always punctual (on_time)
            Checkin::updateOrCreate(
                ['email' => $item['email'], 'check_in_at' => now()->startOfDay()->addHours(7)],
                [
                    'staff_id' => $staff->id,
                    'name' => $item['name'],
                    'email' => $item['email'],
                    'type' => 'employee',
                    'department' => $item['role'],
                    'badge_no' => 'STF-' . str_pad($staff->id, 3, '0', STR_PAD_LEFT),
                    'location' => 'Main Espresso Bar',
                    'note' => 'Morning shift check-in',
                    'status' => 'checked_in',
                    'punctuality_status' => $isAiden ? 'late' : 'on_time',
                    'late_minutes' => $isAiden ? 18 : 0,
                    'check_in_at' => now()->startOfDay()->addHours(7)->addMinutes($isAiden ? 18 : 0),
                    'check_out_at' => null,
                ]
            );
        }

        // Seed sample Day Off assignments for testing the calendar
        $today = Carbon::today();
        $maya = Staff::where('email', 'maya.lin@chafe.co')->first();
        $lucas = Staff::where('email', 'lucas.pastry@chafe.co')->first();
        $chloe = Staff::where('email', 'chloe.supervisor@chafe.co')->first();

        if ($maya) {
            \App\Models\StaffDayoff::updateOrCreate(
                ['staff_id' => $maya->id, 'date' => $today->copy()->addDays(1)->toDateString()],
                ['type' => 'day_off', 'reason' => 'Scheduled Rest Day', 'created_by' => 'admin']
            );
            \App\Models\StaffDayoff::updateOrCreate(
                ['staff_id' => $maya->id, 'date' => $today->copy()->addDays(2)->toDateString()],
                ['type' => 'day_off', 'reason' => 'Scheduled Rest Day', 'created_by' => 'admin']
            );
        }

        if ($lucas) {
            \App\Models\StaffDayoff::updateOrCreate(
                ['staff_id' => $lucas->id, 'date' => $today->copy()->addDays(4)->toDateString()],
                ['type' => 'annual_leave', 'reason' => 'Annual Culinary Workshop', 'created_by' => 'admin']
            );
            \App\Models\StaffDayoff::updateOrCreate(
                ['staff_id' => $lucas->id, 'date' => $today->copy()->addDays(5)->toDateString()],
                ['type' => 'annual_leave', 'reason' => 'Annual Leave', 'created_by' => 'admin']
            );
        }

        if ($chloe) {
            \App\Models\StaffDayoff::updateOrCreate(
                ['staff_id' => $chloe->id, 'date' => $today->copy()->toDateString()],
                ['type' => 'personal', 'reason' => 'Personal Appointment', 'created_by' => 'admin']
            );
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Chafé staff roster, credentials (pw: 123456), shift logs, and calendar dayoffs initialized!',
        ]);
    }
}
