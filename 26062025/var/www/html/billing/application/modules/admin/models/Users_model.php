<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Users_model extends CI_Model {

    protected $stb;
    const KEY_PIN_DEFAULT = 'pin_default';

    public function __construct() {
        parent::__construct();
        $this->stb = $this->load->database('stalker', true);
        $this->load->helper('deduction_helper');
    }

    public function get_user($account) {
        $sql = $this->db->where('account', $account)->get('accounts');
        return $sql;
    }
    public function get_user_by_status($userid, $status=null, $length, $start, $orderBy, $orderDir,$searchValue){
        $this->db->reset_query();
        $this->db->from('accounts');
        if(!empty($userid)){
            if (is_array($userid) && count($userid) > 1) {
                $this->db->where_in('username', $userid);
            }else{
                $this->db->where('username', is_array($userid) ? $userid[0] : $userid);
            }
        }
        $this->db->select("username, account, password, full_name, mac, expires, status, created");
        
        if ($status == "active") {
            $this->db->where("status", ACCOUNT_STATUS_ON);
        } else if ($status == "inactive") {
            $this->db->where("status", ACCOUNT_STATUS_OFF);
        } else if ($status == "expired") {
            $this->db
                ->where('expires !=', '0000-00-00 00:00:00')
                ->where('expires < NOW()', null, false);
        }
        if (!empty($searchValue)) {
            $this->db->group_start(); // Start the group
            $this->db->like('full_name', $searchValue);
            $this->db->or_like('mac', $searchValue);
            $this->db->or_like('account', $searchValue);
            $this->db->group_end(); // End the group
        }
        if (!empty($orderBy) && !empty($orderDir)){
            $this->db->order_by($orderBy, $orderDir);
        }

        $totalFiltered = $this->db->count_all_results('', FALSE); // no reset

        $this->db->limit($length, $start);
        $data['users'] = $this->db->get()->result_array();;
        $data['filtered_count'] =  $totalFiltered;
        return $data;
        
    }
    public function get_user_by_status_and_manager($usernames, $status=null, $length, $start, $orderBy, $orderDir,$searchValue){

        $this->db->from('accounts');
        $this->db->where_in('username', $usernames);
        $this->db->select("id, username, account, password, full_name, mac, expires, status");
        
        if ($status == "active") {
            $this->db->where("status", ACCOUNT_STATUS_ON);
        } else if ($status == "inactive") {
            $this->db->where("status", ACCOUNT_STATUS_OFF);
        } else if ($status == "expired") {
            $this->db
                ->where('expires !=', '0000-00-00 00:00:00')
                ->where('expires < NOW()', null, false);
        }
        if (!empty($searchValue)) {
            $this->db->group_start(); // Start the group
            $this->db->like('full_name', $searchValue);
            $this->db->or_like('mac', $searchValue);
            $this->db->or_like('account', $searchValue);
            $this->db->group_end(); // End the group
        }
        if (!empty($orderBy) && !empty($orderDir)){
            $this->db->order_by($orderBy, $orderDir);
        }

        $totalFiltered = $this->db->count_all_results('', FALSE); // no reset

        $this->db->limit($length, $start);
        $data['users'] = $this->db->get()->result_array();;
        $data['filtered_count'] =  $totalFiltered;
        return $data;
        
    }
    public function is_free_trial_user($account) {
        $this->db->where('TIMESTAMPDIFF(HOUR, created, expires) BETWEEN 47 AND 49')->where('account', $account);
        if ($this->db->get('accounts')->num_rows() == 1) {
            return TRUE;
        }        
        return FALSE;
    }

    public function get_stalker_user($login) {
        $sql = $this->stb
        ->from('users')
        ->where('login', $login)
        ->get();
        $data = $sql->row();
        return $data;
    }
    public function get_stalker_user_select_column($login) {
        $sql = $this->stb
        ->from('users')
        ->where('login', $login)
        ->get();
        $data = $sql->row();
        return $data;
    }
    public function create($options) {
        $created = get_current_datetime();
        $expires = get_expiry_date($options['validity'] === '1_MONTH_FREE' ? 1 : $options['validity']);
        $account_status = ($options['status'] === ACCOUNT_STATUS_OFF) ?  ACCOUNT_STATUS_OFF : ACCOUNT_STATUS_ON;
        $using_free_trial = ($options['validity'] === 'FREE_TRIAL') ? TRUE : FALSE;
        // Config pin default
        $configPinDefault = $this->configs_model->find(self::KEY_PIN_DEFAULT);

        //extract the values and insert into stalker database
        $stalker_options = array(
            'fname'          => $options['name'],
            'login'          => $options['account'],
            'mac'            => $options['mac'],
            'status'         => $account_status, 
            // 'comment'        => $options['note'],
            'tariff_plan_id' => $options['tariff_plan_id'],
            'created'        => date('Y-m-d H:i:s'),
            'expire_billing_date' => $expires,
            'parent_password' => $configPinDefault->value ?? '9090'
        );
        if ($this->stb->insert('users', $stalker_options)) { // todo: check for errors
            $id = $this->stb->insert_id();
            $password = md5(md5($options['password']) . $id);
            $this->stb->set('password', $password);
            $this->stb->where('id', $id);
            if ($this->stb->update('users')) { // todo: check for errors 
                 $expires = get_expiry_date($options['validity'] === '1_MONTH_FREE' ? 1 : $options['validity']);
                 $accounts_options = array(
                     'full_name' => $options['name'],
                     'account'   => $options['account'],
                     'mac'       => $options['mac'],
                     'status'    => $account_status,
                     'created'   => $created,
                     'expires'   => $expires,
                     // 'note'      => $options['note'],
                     'username'  => $options['username'],
                     'password'  => $options['password'],
                );
                if ($this->db->insert('accounts', $accounts_options)) {
                    if ($using_free_trial == TRUE) {
                        $free_trial_data = array(
                            'mac' => $options['mac'],
                            'free_trial_end_date' => $expires,
                        ); 
                        $this->db->insert('free_trial_users', $free_trial_data);                         
                        // Insert user credit summarize
                        $this->creditsummarize_model->create($options['account'], date("Y-m-d H:i:s"), $expires, 0);
                        // todo: check for errors
                    } else {
                        $numberFree = 0;
                        $type = "DBIT";
                        if ($options['validity'] === '1_MONTH_FREE') {
                            $options['validity'] = 0;
                            $type = "BONUS";
                            $numberFree = 1;
                        }

                        // Debit credits from dealer or reseller account
                        $this->transaction_model->add($options['validity'], $type, $options['username'], $options['account'], $expires, date("Y-m-d H:i:s"), $numberFree);
                        // Insert user credit summarize
                        $this->creditsummarize_model->create($options['account'], date("Y-m-d H:i:s"), $expires, $options['validity']);
                        // todo: check for errors
                    }
                    $result = array('id' => $id, 'status' => TRUE);
                    return $result;
                } 
                $result = array('id' => NULL, 'status' => FALSE);
                return $result;
            }
        } else {
            $result = array('id' => NULL, 'status' => FALSE);
            return $result;
        }
    }

    public function change_status($status, $username) {
        log_debug_msg("admin/models/Users_model.php/change_status(): [username: $username, status: $status]: entering");
        $user          = $this->get_user($username)->row();
        $expiry_status = $this->stalker_model->check_expired($user->expires);
        if (! ($expiry_status == "Expired" && $status == ACCOUNT_STATUS_ON) ) { // won't allow to activate an expired user
            $user_info = $this->get_stalker_user($username);
            $id = $user_info->id;
            if ($user_info->status != $status) { // no need to change if the status is already set as requested
                if ($status == ACCOUNT_STATUS_ON) {
                    log_debug_msg("admin/models/Users_model.php/change_status(): [username: $username, status: $status]: trying to cut_on()");
                    $this->stalker_model->cut_on($id);
                    //$this->stalker_model->restore_package($id);
                } else if ($status == ACCOUNT_STATUS_OFF) {
                    log_debug_msg("admin/models/Users_model.php/change_status(): [username: $username, status: $status]: trying to cut_off()");
                    $this->stalker_model->cut_off($id);
                    //$this->stalker_model->remove_package($id);
                }
            } else {
                log_debug_msg("admin/models/Users_model.php/change_status(): [username: $username, status: $status]: nothing done (\$user_info->status == \$status)");
            }
        } else {
            log_debug_msg("admin/models/Users_model.php/change_status(): [username: $username, status: $status]: nothing done (\$expiry_status == 'Expired' && \$status == ACCOUNT_STATUS_ON)");
        }
        log_debug_msg("admin/models/Users_model.php/change_status(): [username: $username, status: $status]: returning to caller");
    }

    public function check_expired($account) {
        $sql = $this->db->where('account', $account)->get('accounts');
        $row = $sql->row();
        $d1  = strtotime($row->expires);
        if ($d1 < time()) {
            return 'Expired';
        } else {

            $date1 = date_create(date('Y-m-d H:i:s'));
            $date2 = date_create($row->expires);
            $diff  = date_diff($date1, $date2);
            return $diff->format("%a");
        }

    }

    public function update($options) {
        //extract the values and insert into stalker database
        //check if expired or not
        $status = ($this->check_expired($options['account']) == "Expired")
        ? $this->get_stalker_user($options['account'])->status
        : $options['status'];
        $stalker_options = [
            'fname'            => $options['name'],
            'mac'              => $options['mac'],
            'status'           => $status,
            'phone'            => $options['phone'],
            'comment'          => $options['note'],
            'tariff_plan_id'   => $options['tariff_plan_id'],
            'parent_password'  => $options['parent_password'],
        ];
        // Update user basic info
        $this->change_status($options['status'], $options['account']);
        $this->stb->where('login', $options['account'])->update('users', $stalker_options);
        $user = $this->get_stalker_user($options['account']);
        if (!$user) {
            return false;
        }
        $id = $user->id;
        $password = md5(md5($options['password']) . $id);
        // Update user password
        $this->stb->where('id', $id)->update('users', ['password' => $password]);
        // Update accounts table
        $accounts_options = [
            'full_name' => $options['name'],
            'mac'       => $options['mac'],
            'phone'     => $options['phone'],
            'note'      => $options['note'],
            'status'    => $status,
            'username'  => $options['username'],
            'password'  => $options['password'],
        ];
        if ($this->db->where('account', $options['account'])->update('accounts', $accounts_options)) {
            return ['id' => $id, 'status' => true];
        }
        return false;
    }

    public function delete($account) {

        $this->stb->where('login', $account);
        // $this->stb->delete('users');
        if ($this->stb->delete('users')) {
            $this->db->where('account', $account);
            if ($this->db->delete('accounts')) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    public function get_reseller($username) {
        $sql = $this->db->where('username', $username)->get('users');
        if ($sql->num_rows() == 0) {
            return '';
        } else {
            $data = $sql->row();
            return $data->username_owner;
        }
    }

    public function get_owner($username) {
        $sql  = $this->db->where('username', $username)->get('users');
        $user = $sql->row();
        return $user->type;
    }

    public function get_transactions($username) {
        $sql = $this->db->where('account', $username)->order_by('timestamp', 'DESC')->get('transactions');
        return $sql;
    }

    public function renew($username, $credits, $login_user=null) {

        log_debug_msg("admin/models/Users_model.php/renew(): [username: $username]: entering");

        $user_sql            = $this->db->where('account', $username)->get('accounts');
        $user                = $user_sql->row();
        $userCredit          = $this->db->where('account', $username)->get('user_credit_summarize')->row();
        $stalker_user        = $this->get_stalker_user($username);
        $is_expired = ($this->stalker_model->check_expired($user->expires) == "Expired")? true: false;
        $coverage_start_date = ($this->stalker_model->check_expired($user->expires) == "Expired") ? date('Y-m-d H:i:s') : $user->expires;
        $expiry_date = get_expiry_date($credits, $coverage_start_date);
        $using_free_trial = ($credits === 'FREE_TRIAL') ? TRUE : FALSE;
        if($login_user!=null){
            $operater = $login_user;
        }else{
            $operater = $user->username;
        }

        if ($using_free_trial) {
            $free_trial_data = array(
                'mac' => $stalker_user->mac,
                'free_trial_end_date' => $expiry_date,
            ); 
            $this->db->insert('free_trial_users', $free_trial_data);  
            
            // Update expired account
            $this->db->set('expires', $expiry_date);
            $this->db->where('account', $username);
            $this->db->update('accounts');

            // Update user_credit_summarize
            $this->db->set('expiry_date', $expiry_date);
            $this->db->where('account', $username);
            $this->db->update('user_credit_summarize');

            return true;
        }

        if ($this->transaction_model->add($credits, "DBIT", $operater, $username, $expiry_date, $coverage_start_date) == true) {
            //first update expiry date
            $this->db->set('expires', $expiry_date);
            $this->db->where('account', $username);
            if (!$this->db->update('accounts')) {
                log_debug_msg("admin/models/Users_model.php/renew(): [username: $username]: \$this->db->update() has failed to set the expires field");
                // todo: handle this error
            }

            // Update user_credit_summarize
            $arrayDeductions = arrayDataCreditDeduction();
            $credits = $arrayDeductions[$credits] ?? $credits;
            $expiredDateOld = new DateTime($userCredit->start_date);
            $currentDate = new DateTime();
          
            if ($expiredDateOld > $currentDate) {
                $this->db->set('start_date', date('Y-m-d H:i:s'));
                $userCredit->max_credit_recoverable = 0;
            }

            if ($userCredit->max_credit_recoverable == 0) {
                if ((new DateTime())>(new DateTime($coverage_start_date))){
                    $credits = max(0, $credits - 1);
                }
            }
            $this->db->set('expiry_date', $expiry_date);
            $this->db->set('max_credit_recoverable', ($userCredit->max_credit_recoverable + intval($credits)));
            $this->db->where('account', $username);
            $this->db->update('user_credit_summarize');
			// Update on Stalker database
			$this->stb->set('expire_billing_date', $expiry_date);
			$this->stb->where('login', $username);
    		if (!$this->stb->update('users')) {
                log_debug_msg("admin/models/Users_model.php/renew(): [username: $username]: \$this->stb->update() has failed to set the expire_billing_date field");
                // todo: handle this error
            }


            //$this->stalker_model->cut_on($stalker_user->id);
			$this->db->set('status', ACCOUNT_STATUS_ON);
			$this->db->where('account', $username);
			if (!$this->db->update('accounts')) {
                log_debug_msg("admin/models/Users_model.php/renew(): [username: $username]: \$this->db->update() has failed to set the status field");
                // todo: handle this error
            }

            log_debug_msg("admin/models/Users_model.php/renew(): [username: $username]: calling \$this->users_model->change_status(" . ACCOUNT_STATUS_ON . ", $username)");
			$this->users_model->change_status(ACCOUNT_STATUS_ON, $username);

            log_debug_msg("admin/models/Users_model.php/renew(): [username: $username]: calling \$this->stalker_model->cut_on(" . $stalker_user->id . ")");
			$this->stalker_model->cut_on($stalker_user->id);

            //log_debug_msg("admin/models/Users_model.php/renew(): [username: $username]: calling \$this->stalker_model->restore_package(" . $stalker_user->id . ")");
			//$this->stalker_model->restore_package($stalker_user->id);

            return true;
        } else {
            log_debug_msg("admin/models/Users_model.php/renew(): [username: $username]: \$this->transaction_model->add() has failed");
            return false;
        }
    }
    public function get_users_count_by_status($userid, $status=null, $role=null){

        if($userid!=null){
            $this->db->reset_query();
            $this->db->select('username');
            $this->db->from('users');
            $this->db->where('username_owner', $userid);
            $this->db->or_where('username', $userid);
            $query1 = $this->db->get();
    
            $usernames = [];
            $count_by_manager = 0 ;
            foreach ($query1->result() as $row) {
                $usernames[] = $row->username;
                $count_by_manager +=1;
            }
    
            if (!empty($usernames)) {
                $this->db->select('username');
                $this->db->from('users');
                $this->db->where_in('username_owner', $usernames);
                // return $this->db->count_all_results() +$count_by_manager;
                $query2 = $this->db->get();
                foreach ($query2->result() as $row) {
                    $usernames[] = $row->username;
                }
            }
            $this->db->reset_query();
            if(!empty($usernames) ||  $role == "manager"){
                $this->db->where_in('username', $usernames);
            } else {
                $this->db->where('username', $userid);
            }
        }
        $this->db->from('accounts');
        if($status == "active"){
            $this->db->where("status", ACCOUNT_STATUS_ON);
        }else if ($status == "expired"){
            $this->db
                ->where('expires !=', '0000-00-00 00:00:00')
                ->where('expires < NOW()', null, false);
        }
        return $this->db->count_all_results();
    }

    public function get_expired_users($dealer = NULL) {
         $this->db
            ->where('expires !=', '0000-00-00 00:00:00')
            ->where('expires < NOW()', null, false);
        if (!is_null($dealer)) {
            $this->db->where('username', $dealer);
        }

        return $this->db->get('accounts');
    }

    public function get_active_users($dealer = NULL) {
        $this->db->where('status', ACCOUNT_STATUS_ON);
        if (!is_null($dealer)) {
            $this->db->where('username', $dealer);
        }
        $sql = $this->db->get('accounts');
        return $sql;
    }

    // public function recover_credits($account, $credits) {
    //     $sql     = $this->db->where('account', $account)->get('accounts');
    //     $user    = $sql->row();
    //     $userCredit = $this->db->where('account', $account)->get('user_credit_summarize')->row();
    //     $balance = $userCredit->max_credit_recoverable;

    //     // $check_trial = $this->db->select('free_trial_end_date')->where(array('mac' => $user->mac))->get('free_trial_users');
    //     // $row = $check_trial->row();

    //     // $current_date = new DateTime();

    //     // if ($row && isset($row->free_trial_end_date)) {
    //     //     $trial_date = new DateTime($row->free_trial_end_date);
    //     // } else {
    //     //     // Set to a date in the past to indicate no active trial
    //     //     $trial_date = new DateTime("-1 day");
    //     // }
    //     $expired_date = new DateTime($user->expires);
    //     $current_date = new DateTime();
    //     // Calculate the difference
    //     $interval = $expired_date->diff($current_date);
    //     // Get the total number of months
    //     $months = ($interval->y * 12) + $interval->m;

    //     // if (($balance > 0 && $balance >= $credits) || ($trial_date > $current_date && $credits == 1)) {
    //     if ($months >= $credits) {
    //         $calculateRecover = $this->calculate_recover_date($account, $credits, $user->expires);

    //         $expiry_date = $calculateRecover['expired_date'];
    //         //add credits back to dealer
    //         // $this->transaction_model->add($credits, "CRDT", $user->username);
    //         //add history to user
    //         $this->transaction_model->add($credits, "CRDT", $user->username, $account, $expiry_date, $userCredit->start_date, ($calculateRecover['free_month'] + $calculateRecover['credits']));
    //         // Update expired date
    //         $this->db->where('account', $account);
    //         $this->db->set('expires', $expiry_date);
    //         // Update on Stalker database 
    //         $this->stb->set('expire_billing_date', $expiry_date);
    //         $this->stb->where('login', $account);
    //         $this->stb->update('users');
    //         if ($this->db->update('accounts')) {
    //             // Update user_credit_summarize
    //             $this->db->set('expiry_date', $expiry_date);
    //             $this->db->set('max_credit_recoverable', ($userCredit->max_credit_recoverable - $credits));
    //             $this->db->where('account', $account);
    //             $this->db->update('user_credit_summarize');

    //             return true;
    //         } else {
    //             return false;
    //         }
    //     } else {
    //         return false;
    //     }

    // }
    public function recover_credits($account, $credits) {
        $sql     = $this->db->where('account', $account)->get('accounts');
        $user    = $sql->row();
        $userCredit = $this->db->where('account', $account)->get('user_credit_summarize')->row();
        $balance = $userCredit->max_credit_recoverable;
        if ($balance > 0 && $balance >= $credits) {
            $calculateRecover = $this->calculate_recover_date($account, $credits, $user->expires);

            $expiry_date = $calculateRecover['expired_date'];
            //add credits back to dealer
            //$this->transaction_model->add($credits, "CRDT", $user->username);
            //add history to user
            $this->transaction_model->add($credits, "CRDT", $user->username, $account, $expiry_date, $userCredit->start_date, ($calculateRecover['free_month'] + $calculateRecover['credits']));
            // Update expired date
            $this->db->where('account', $account);
            $this->db->set('expires', $expiry_date);
            // Update on Stalker database 
            $this->stb->set('expire_billing_date', $expiry_date);
            $this->stb->where('login', $account);
            $this->stb->update('users');
            if ($this->db->update('accounts')) {
                // Update user_credit_summarize
                $this->db->set('expiry_date', $expiry_date);
                $this->db->set('max_credit_recoverable', ($userCredit->max_credit_recoverable - $credits));
                $this->db->where('account', $account);
                $this->db->update('user_credit_summarize');

                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }

    }

    public function get_balance($account) {
        $sql     = $this->db->where('account', $account)->get('user_credit_summarize');
        $user    = $sql->row();
        $balance = (int) ($user->max_credit_recoverable ?? 0);
        return $balance;
    }

    public function calculate_recover_date($account, $credits, $userExpired, $isSubmitCheck = true) {
        // isSubmitCheck = true when confirm renewal
        $freeMonth = 0;
        $baseCredits = $credits;

        // Total recover of account
        $getRecover = $this->db
             ->query("select sum(periods) as credit_recover from transactions where account = '" . $account . "' and type = 'CRDT';")
             ->row();

        $credits +=  (int) ($getRecover->credit_recover ?? 0);

        $transactions = $this->db
            ->where('account', $account)
            ->where('type', 'DBIT')
            ->order_by('timestamp', 'desc')
            ->get('transactions')->result();
        
        if (count($transactions) > 0) {
            foreach ($transactions as $transaction) {
                if (!$transaction->is_subtract_free_month) {
                    $freeMonth += $transaction->free_month;
                    
                    if ($isSubmitCheck) {
                        // Update subtract free month
                        $this->db->set('is_subtract_free_month', 1);
                        $this->db->where('account', $account)->where('transaction', $transaction->transaction);
                        $this->db->update('transactions');
                    }
                }
                
                if ($credits <= $transaction->periods) {
                    break;
                }
                
                $credits -= $transaction->periods;
            }
        }

        $datetime = new DateTime($userExpired);
        $datetime->modify('-' . ($freeMonth + $baseCredits) . ' month');
        $finale = $datetime->format('Y-m-d H:i:s');

        return [
            'expired_date' => $finale,
            'free_month' => $freeMonth,
            'credits' => $baseCredits,
        ];
    }
}

/* End of file Users_model.php */
/* Location: ./application/modules/admin/models/Users_model.php */
