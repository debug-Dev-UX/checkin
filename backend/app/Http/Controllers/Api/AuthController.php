<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Unified Login endpoint for Admin and Staff.
     * Admin credentials: username 'admin', password '123456'
     */
    public function login(Request $request)
    {
        $validated = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $username = trim($validated['username']);
        $password = $validated['password'];

        // 1. Check Admin Credentials
        if (strtolower($username) === 'admin' && $password === '123456') {
            $token = 'admin_' . Str::random(40);
            return response()->json([
                'status' => 'success',
                'message' => 'Welcome back, Administrator!',
                'role' => 'admin',
                'token' => $token,
                'user' => [
                    'id' => 'admin',
                    'name' => 'Administrator',
                    'username' => 'admin',
                    'role' => 'admin',
                    'display_title' => 'System Administrator',
                ],
            ]);
        }

        // 2. Check Staff Credentials
        $staff = Staff::where('username', $username)
            ->orWhere('email', $username)
            ->first();

        if ($staff) {
            $passwordValid = false;

            if (!empty($staff->password)) {
                if (Hash::check($password, $staff->password) || $staff->password === $password) {
                    $passwordValid = true;
                }
            } else {
                // If staff was created without explicit password, allow default '123456'
                if ($password === '123456') {
                    $passwordValid = true;
                    // Auto-hash and save
                    $staff->password = Hash::make('123456');
                    $staff->save();
                }
            }

            if ($passwordValid) {
                // Check if staff has assigned day off today
                $today = now()->format('Y-m-d');
                $todayDayoff = $staff->dayoffs()->where('date', $today)->first();

                // Check active checkin status
                $latestCheckin = $staff->checkins()->latest()->first();
                $isOnShift = $latestCheckin && $latestCheckin->status === 'checked_in';

                $token = 'staff_' . Str::random(40);

                return response()->json([
                    'status' => 'success',
                    'message' => "Welcome back, {$staff->name}!",
                    'role' => 'staff',
                    'token' => $token,
                    'staff' => [
                        'id' => $staff->id,
                        'name' => $staff->name,
                        'email' => $staff->email,
                        'username' => $staff->username ?? strtolower(explode('@', $staff->email)[0]),
                        'role' => $staff->role,
                        'shift_start' => $staff->shift_start,
                        'shift_end' => $staff->shift_end,
                        'hourly_rate' => $staff->hourly_rate,
                        'status' => $staff->status,
                        'avatar_color' => $staff->avatar_color,
                        'is_on_shift' => $isOnShift,
                        'has_dayoff_today' => !is_null($todayDayoff),
                        'dayoff_today' => $todayDayoff,
                        'latest_checkin' => $latestCheckin,
                    ],
                ]);
            }
        }

        return response()->json([
            'status' => 'error',
            'message' => 'Invalid username or password. Please check your credentials.',
        ], 401);
    }

    /**
     * Get current authenticated user profile
     */
    public function me(Request $request)
    {
        $token = $request->header('Authorization') ?? $request->input('token');

        if ($token && str_starts_with($token, 'admin_')) {
            return response()->json([
                'status' => 'success',
                'role' => 'admin',
                'user' => [
                    'id' => 'admin',
                    'name' => 'Administrator',
                    'username' => 'admin',
                    'role' => 'admin',
                ],
            ]);
        }

        return response()->json([
            'status' => 'error',
            'message' => 'Unauthorized',
        ], 401);
    }
}
