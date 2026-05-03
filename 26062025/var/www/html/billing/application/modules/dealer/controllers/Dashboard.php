<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Dashboard extends DealerController {

    public function __construct(){
      parent::__construct();
    }

    public function index() {
      $this->data['title'] = 'Dashboard';
      $this->data['balance'] = $this->transaction_model->get_credit_balance($this->user['username']);
      $this->data['expired_users'] = $this->users_model->get_users_count_by_status($this->user['username'], "expired");
      $this->data['active_users'] = $this->users_model->get_users_count_by_status($this->user['username'], "active");
      $this->data['total_dealers'] = $this->db->where('username', $this->user['username'])->get('accounts');
      $this->render('common/dashboard');
    }

}

/* End of file Dashboard.php */
