<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Staff extends Model
{
    protected $table = 'staff';

    protected $fillable = [
        'name',
        'email',
        'role',
        'shift_start',
        'shift_end',
        'hourly_rate',
        'status',
        'avatar_color',
    ];

    public function checkins()
    {
        return $this->hasMany(Checkin::class, 'staff_id');
    }
}
