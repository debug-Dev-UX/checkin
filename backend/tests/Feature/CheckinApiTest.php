<?php

namespace Tests\Feature;

use App\Models\Checkin;
use App\Models\Staff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CheckinApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_mysql_database_connection(): void
    {
        $pdo = DB::connection()->getPdo();
        $this->assertNotNull($pdo);
        $this->assertEquals('mysql', config('database.default'));
    }

    public function test_status_endpoint_returns_success_and_db_info(): void
    {
        $response = $this->getJson('/api/status');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'online')
            ->assertJsonPath('database.connected', true);
    }

    public function test_stats_endpoint_returns_kpi_counts(): void
    {
        Checkin::create([
            'name' => 'Active Person',
            'email' => 'active@example.com',
            'type' => 'employee',
            'department' => 'Engineering',
            'status' => 'checked_in',
            'check_in_at' => now(),
        ]);

        $response = $this->getJson('/api/stats');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.total_all', 1)
            ->assertJsonPath('data.active_now', 1);
    }

    public function test_can_create_a_checkin_via_api(): void
    {
        $payload = [
            'name' => 'Alice Johnson',
            'email' => 'alice@example.com',
            'type' => 'visitor',
            'department' => 'Research',
            'location' => 'Executive Suite',
            'note' => 'Visiting headquarters',
        ];

        $response = $this->postJson('/api/checkins', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.name', 'Alice Johnson')
            ->assertJsonPath('data.status', 'checked_in');

        $this->assertDatabaseHas('checkins', [
            'email' => 'alice@example.com',
            'status' => 'checked_in',
        ]);
    }

    public function test_can_checkout_an_active_checkin(): void
    {
        $checkin = Checkin::create([
            'name' => 'Checking Out User',
            'email' => 'checkout@example.com',
            'status' => 'checked_in',
            'check_in_at' => now()->subHours(2),
        ]);

        $response = $this->postJson('/api/checkins/' . $checkin->id . '/checkout');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', 'checked_out');

        $this->assertDatabaseHas('checkins', [
            'id' => $checkin->id,
            'status' => 'checked_out',
        ]);
    }

    public function test_bulk_checkout(): void
    {
        Checkin::create([
            'name' => 'Occupant 1',
            'email' => 'occ1@example.com',
            'status' => 'checked_in',
        ]);

        Checkin::create([
            'name' => 'Occupant 2',
            'email' => 'occ2@example.com',
            'status' => 'checked_in',
        ]);

        $response = $this->postJson('/api/checkins/bulk-checkout');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('count', 2);

        $this->assertEquals(0, Checkin::where('status', 'checked_in')->count());
    }

    public function test_can_create_and_list_staff(): void
    {
        $payload = [
            'name' => 'Maya Lin',
            'email' => 'maya.test@chafe.co',
            'role' => 'Senior Latte Artist',
            'shift_start' => '07:30',
            'shift_end' => '16:00',
            'hourly_rate' => 22.50,
        ];

        $response = $this->postJson('/api/staff', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.name', 'Maya Lin');

        $this->assertDatabaseHas('staff', [
            'email' => 'maya.test@chafe.co',
            'role' => 'Senior Latte Artist',
        ]);

        $listResponse = $this->getJson('/api/staff');
        $listResponse->assertStatus(200)
            ->assertJsonPath('status', 'success');
    }

    public function test_staff_performance_analytics(): void
    {
        $staff = Staff::create([
            'name' => 'Liam Test',
            'email' => 'liam.test@chafe.co',
            'role' => 'Head Barista',
            'shift_start' => '07:00',
            'shift_end' => '15:30',
        ]);

        Checkin::create([
            'staff_id' => $staff->id,
            'name' => 'Liam Test',
            'email' => 'liam.test@chafe.co',
            'type' => 'employee',
            'punctuality_status' => 'on_time',
            'status' => 'checked_in',
            'check_in_at' => now(),
        ]);

        $response = $this->getJson('/api/performance');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.overall_punctuality', 100);
    }

    public function test_control_today_and_qr_endpoints(): void
    {
        $todayRes = $this->getJson('/api/control/today');
        $todayRes->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $qrRes = $this->getJson('/api/control/qr?type=guest');
        $qrRes->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.title', 'Chafé Guest Self Check-In');
    }

    public function test_settings_endpoint(): void
    {
        $getRes = $this->getJson('/api/settings');
        $getRes->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.cafe_name', 'Chafé');

        $postRes = $this->postJson('/api/settings', [
            'cafe_name' => 'Chafé Signature',
            'operating_hours' => '07:00 - 23:00',
            'late_grace_period_mins' => 15,
            'seating_capacity' => 60,
        ]);

        $postRes->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.cafe_name', 'Chafé Signature');
    }
}
