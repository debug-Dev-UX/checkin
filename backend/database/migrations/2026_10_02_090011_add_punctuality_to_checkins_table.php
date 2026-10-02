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
            $table->unsignedBigInteger('staff_id')->nullable()->after('id');
            $table->string('punctuality_status')->default('standard')->after('status'); // on_time, late, early, standard
            $table->integer('late_minutes')->default(0)->after('punctuality_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('checkins', function (Blueprint $table) {
            $table->dropColumn(['staff_id', 'punctuality_status', 'late_minutes']);
        });
    }
};
