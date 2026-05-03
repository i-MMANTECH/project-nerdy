<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Dashboard extends ManagerController {

    public function __construct() {
        parent::__construct();
    }

    public function index() {
        $this->data['title']     = 'Dashboard';
        $this->data['balance']   = $this->transaction_model->get_credit_balance($this->user['username']);
        
        $users     = $this->manager_model->get_all_users($this->user['username']);
        $dealers   = $this->manager_model->get_all_dealers($this->user['username']);
        $resellers = $this->db->where('username_owner', $this->user['username'])->get('users');
        
        $this->data['users']     = is_array($users) ? count($users) : 0;
        $this->data['dealers']   = is_array($dealers) ? count($dealers) : 0;
        $this->data['resellers'] = $resellers;
        
        $this->render('common/dashboard');
        
    }

}

/* End of file Dashboard.php */
