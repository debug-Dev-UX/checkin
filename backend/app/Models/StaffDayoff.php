<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffDayoff extends Model
{
    protected $table = 'staff_dayoffs';

    protected $fillable = [
        'staff_id',
        'date',
        'type',
        'reason',
        'created_by',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
    ];

    public function staff()
    {
        return $this->belongsTo(Staff::class, 'staff_id');
    }
}
