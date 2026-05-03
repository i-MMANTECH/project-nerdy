<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Configs_model extends CI_Model
{
    protected $table = 'configs';

    const KEY_RECOVER_BONUS_CREDIT = 'is_recover_bonus_credit';
    const KEY_PIN_DEFAULT = 'pin_default';
    const KEY_LIMIT_RESELLER_CREDIT = 'limit_reseller_credit';
    const KEY_LIMIT_DEALER_CREDIT = 'limit_dealer_credit';
    const KEY_RETRY_TRIAL = 'is_retry_trial';
    const KEY_NUMBER_RETRY_TRIAL = 'number_retry_trial';

    public function __construct()
    {
        parent::__construct();
    }

    public function find($key)
    {
        return $this->db->where('key', $key)->get($this->table)->row();
    }

    public function findMultiple($arrayKey)
    {
        return $this->db->where_in('key', $arrayKey)->get($this->table)->result();
    }

    public function update($data, $key) 
    {
        if (empty($data) || empty($key)) {
            return false;
        }

        $this->db->where('key', $key);
        return $this->db->update($this->table, $data);
    }
}