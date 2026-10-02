<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('checkins', function (Blueprint $table) {
            $table->string('type')->default('employee')->after('email'); // employee, visitor, contractor, guest
            $table->string('department')->nullable()->after('type');
            $table->string('badge_no')->nullable()->after('department');
            $table->string('location')->nullable()->after('badge_no');
            $table->timestamp('check_in_at')->nullable()->after('status');
            $table->timestamp('check_out_at')->nullable()->after('check_in_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('checkins', function (Blueprint $table) {
            $table->dropColumn(['type', 'department', 'badge_no', 'location', 'check_in_at', 'check_out_at']);
        });
    }
};
