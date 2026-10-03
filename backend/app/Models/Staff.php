<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Staff extends Model
{
    protected $table = 'staff';

    protected $fillable = [
        'name',
        'email',
        'username',
        'password',
        'role',
        'shift_start',
        'shift_end',
        'hourly_rate',
        'status',
        'avatar_color',
    ];

    protected $hidden = [
        'password',
    ];

    public function checkins()
    {
        return $this->hasMany(Checkin::class, 'staff_id');
    }

    public function dayoffs()
    {
        return $this->hasMany(StaffDayoff::class, 'staff_id');
    }
}
