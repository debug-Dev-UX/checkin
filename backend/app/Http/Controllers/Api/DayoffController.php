<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use App\Models\StaffDayoff;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;

class DayoffController extends Controller
{
    /**
     * List all assigned day offs with staff details.
     * Can filter by month, date range, or staff_id.
     */
    public function index(Request $request)
    {
        $query = StaffDayoff::with(['staff:id,name,email,username,role,avatar_color,shift_start,shift_end']);

        if ($request->filled('staff_id')) {
            $query->where('staff_id', $request->input('staff_id'));
        }

        if ($request->filled('month')) {
            // format: YYYY-MM
            $month = $request->input('month');
            $startOfMonth = Carbon::parse($month . '-01')->startOfMonth()->toDateString();
            $endOfMonth = Carbon::parse($month . '-01')->endOfMonth()->toDateString();
            $query->whereBetween('date', [$startOfMonth, $endOfMonth]);
        } elseif ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('date', [$request->input('start_date'), $request->input('end_date')]);
        } elseif ($request->filled('year')) {
            $query->whereYear('date', $request->input('year'));
        }

        $dayoffs = $query->orderBy('date', 'asc')->get();

        // Calculate metadata
        $today = Carbon::today()->toDateString();
        $todayOffCount = $dayoffs->where('date', $today)->count();

        return response()->json([
            'status' => 'success',
            'data' => $dayoffs,
            'summary' => [
                'total_records' => $dayoffs->count(),
                'today_off_count' => $todayOffCount,
                'today_date' => $today,
            ],
        ]);
    }

    /**
     * Assign a day off or range of day offs to staff.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'staff_id' => 'required|exists:staff,id',
            'date' => 'nullable|date_format:Y-m-d',
            'date_start' => 'nullable|date_format:Y-m-d',
            'date_end' => 'nullable|date_format:Y-m-d|after_or_equal:date_start',
            'type' => 'required|string|in:day_off,annual_leave,sick_leave,holiday,personal',
            'reason' => 'nullable|string|max:255',
        ]);

        $staff = Staff::findOrFail($validated['staff_id']);
        $assignedDates = [];

        // Check if date range or single date
        if (!empty($validated['date_start']) && !empty($validated['date_end'])) {
            $period = CarbonPeriod::create($validated['date_start'], $validated['date_end']);
            foreach ($period as $date) {
                $assignedDates[] = $date->format('Y-m-d');
            }
        } elseif (!empty($validated['date'])) {
            $assignedDates[] = $validated['date'];
        } else {
            return response()->json([
                'status' => 'error',
                'message' => 'Please provide a date or date range.',
            ], 422);
        }

        $createdRecords = [];
        foreach ($assignedDates as $dateStr) {
            $record = StaffDayoff::updateOrCreate(
                [
                    'staff_id' => $staff->id,
                    'date' => $dateStr,
                ],
                [
                    'type' => $validated['type'],
                    'reason' => $validated['reason'] ?? 'Assigned by Administrator',
                    'created_by' => 'admin',
                ]
            );
            $record->load('staff:id,name,email,username,role,avatar_color');
            $createdRecords[] = $record;
        }

        $count = count($createdRecords);
        $dateText = $count === 1 ? $assignedDates[0] : "{$assignedDates[0]} to " . end($assignedDates);

        return response()->json([
            'status' => 'success',
            'message' => "Successfully assigned {$count} day off(s) for {$staff->name} ({$dateText}).",
            'data' => $createdRecords,
        ], 201);
    }

    /**
     * Remove / cancel an assigned day off.
     */
    public function destroy($id)
    {
        $dayoff = StaffDayoff::findOrFail($id);
        $staffName = $dayoff->staff ? $dayoff->staff->name : 'Staff';
        $date = $dayoff->date;
        $dayoff->delete();

        return response()->json([
            'status' => 'success',
            'message' => "Day off on {$date} for {$staffName} has been cancelled.",
        ]);
    }

    /**
     * Get dayoffs for a specific staff member.
     */
    public function staffDayoffs($staffId)
    {
        $staff = Staff::findOrFail($staffId);
        $dayoffs = $staff->dayoffs()->orderBy('date', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'staff' => [
                'id' => $staff->id,
                'name' => $staff->name,
                'role' => $staff->role,
            ],
            'data' => $dayoffs,
        ]);
    }
}
