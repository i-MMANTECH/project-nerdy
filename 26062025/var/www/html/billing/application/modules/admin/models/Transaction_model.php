<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Transaction_model extends CI_Model {
    public $userinfo;
    public function __construct() {
        parent::__construct();
        $this->load->helper('deduction_helper');
        $this->userinfo = $this->session->userdata('auth_info');
    }
    public function add($credits, $type, $username, $account = null, $expires = null, $coverageStart = null, $numberFree = 0) {
        $arrayDeductions = arrayDataCreditDeduction();
        
        $remarks = null;
        $isBonus = false;

        // $type = 'CRDT';
        // $transaction_id = $this->db->query("select max(transaction) + 1 from transactions where username = '" . $username . "'")->row();
        $transaction_id = $this->db->select_max('transaction')->where('username', $username)->get('transactions')->row();
        $transaction    = $transaction_id->transaction + 1;

        if (isset($arrayDeductions[$credits]) && $type != "CRDT" && !is_null($account)) {
            $numberFree = $credits - $arrayDeductions[$credits];
            $credits = $arrayDeductions[$credits];
            $isBonus = true;
        }

        if ($type != "CRDT" && !is_null($account)) {
            $remarks = "Credit <strong>From</strong>: $username <strong>To</strong>: $account";
        }

        if ($type == "CRDT" && !is_null($account)) {
            $remarks = "$username reversed $credits credits to $account";
        }

        $options = array(
            'username'    => $username,
            'type'        => $type,
            "transaction" => (int) $transaction,
            "periods"     => (int) $credits,
            "timestamp"   => date("Y-m-d H:i:s"),
            "coverage_start" => $coverageStart,
            "coverage_end" => $expires,
            "remarks" => $remarks,
            "free_month" => $numberFree,
            "user_transaction" => true
        );
        if (!empty($account)) {
            $options['account'] = $account;
        }

        if ($this->db->insert('transactions', $options)) {
            if ($isBonus && $type != "CRDT" && !is_null($account)) {
                // Handle Insert Transaction Bonus
                $this->db->insert('transactions', [
                    'username'    => $username,
                    'account'     => $account,
                    'type'        => 'BONUS',
                    "transaction" => (int) $transaction + 1,
                    "periods"     => 0,
                    "timestamp"   => date("Y-m-d H:i:s"),
                    "coverage_start" => $coverageStart,
                    "coverage_end" => $expires,
                    "remarks" => "Credit <strong>From</strong>: $username <strong>To</strong>: $account ($numberFree credits free)",
                    "free_month" => $numberFree,
                    "user_transaction" => true
                ]);
            }

            return true;
        } else {
            return false;
        }

    }
    public function credit_manage($credits, $type, $username, $account = null, $expires = null, $coverageStart = null, $numberFree = 0) {

        $arrayDeductions = arrayDataCreditDeduction();        
        $remarks = null;
        $isBonus = false;
       
        // $type = 'CRDT';
        // $transaction_id = $this->db->query("select max(transaction) + 1 from transactions where username = '" . $username . "'")->row();
        $transaction_id = $this->db->select_max('transaction')->where('username', $username)->get('transactions')->row();

        $transaction    = $transaction_id->transaction + 1;

        if (isset($arrayDeductions[$credits]) && $type != "CRDT" && !is_null($account)) {
            if($credits>5){
                $numberFree = $credits - $arrayDeductions[$credits];
            }else{
                 $numberFree = 0;
            }

            $credits = $arrayDeductions[$credits];
            $isBonus = true;
        }

        if ($type != "CRDT" && !is_null($account)) {
            $remarks = "Credit <strong>From</strong>: $username <strong>To</strong>: $account";
        }

        if ($type == "CRDT" && !is_null($account)) {
            $remarks = "$username reversed $credits credits to $account";
        }
        $this->db->order_by('timestamp', 'DESC');
        $this->db->limit(1);
        $query = $this->db->get('transactions')->row();

        if(is_null($account) && $type == "CRDT" && $this->session->userdata('credit_type')==1){
            $remarks = $credits . " credits added to " . $username . " by " . $this->userinfo['username'];
        }else if (is_null($account) && $type == "DBIT" && $this->session->userdata('credit_type') == 2){
            $remarks = $credits . " credit added for " . $query->username;
        }else if (is_null($account) && $type == "CRDT" && $this->session->userdata('credit_type') == 2){
            $remarks = $credits . " credit added from " . $query->username;
        }else if (is_null($account) && $type == "DBIT" && $this->session->userdata('credit_type') == 1){
            $remarks = $credits . " credits recovered from " . $username;
        }

        $options = array(
            'username'    => $username,
            'type'        => $type,
            "transaction" => (int) $transaction,
            "periods"     => (int) $credits,
            "timestamp"   => date("Y-m-d H:i:s"),
            "coverage_start" => $coverageStart,
            "coverage_end" => $expires,
            "remarks" => $remarks,
            "free_month" => $numberFree
        );
        if (!empty($account)) {
            $options['account'] = $account;
        } else if (is_null($account) && $type == "DBIT" && $this->session->userdata('credit_type') == 2){
             $options['account'] =  $query->username;
        }else if (is_null($account) && $type == "CRDT" && $this->session->userdata('credit_type') == 2){
             $options['account'] =  $query->username;
        }

        if ($this->db->insert('transactions', $options)) {
            if ($isBonus && $type != "CRDT" && !is_null($account)) {
                // Handle Insert Transaction Bonus
                $this->db->insert('transactions', [
                    'username'    => $username,
                    'account'     => $account,
                    'type'        => 'BONUS',
                    "transaction" => (int) $transaction + 1,
                    "periods"     => 0,
                    "timestamp"   => date("Y-m-d H:i:s"),
                    "coverage_start" => $coverageStart,
                    "coverage_end" => $expires,
                    "remarks" => "Credit <strong>From</strong>: $username <strong>To</strong>: $account ($numberFree credits free)",
                    "free_month" => $numberFree
                ]);
            }

            return true;
        } else {
            return false;
        }

    }
    public function credit_manage_admin($credits, $type, $sender, $receiver = null, $expires = null, $coverageStart = null, $numberFree = 0) {

        $remarks = null;
        $isBonus = false;    
        $username = "";
        $sub_account = "";
        if( $type == "CRDT") {
            $transaction_id = $this->db->select_max('transaction')->where('username', $sender)->get('transactions')->row();
        }else{
            $transaction_id = $this->db->select_max('transaction')->where('username', $receiver)->get('transactions')->row();
        }

        $transaction    = $transaction_id->transaction + 1;

        $this->db->order_by('timestamp', 'DESC');
        $this->db->limit(1);
        $query = $this->db->get('transactions')->row();
       
        if($type == "CRDT" && $this->session->userdata('credit_type')==1){
            // $remarks =  $sender . " transferred " . $credits . " amount credit to " . $receiver . " by " . $this->userinfo['username'];
            $remarks =  $receiver . " received " . $credits . " credits";
            $username = $sender;
            $type = "DBIT";
            $sub_account = $receiver;
        }else if ($type == "DBIT" && $this->session->userdata('credit_type') == 2){
            // $remarks = $credits . " credit added for " . $receiver . " from " . $sender . " by " . $this->userinfo['username'];
          
            $remarks =  $credits . " credits" . " received by " . $this->userinfo['username'];
            $username = $receiver;
            $type = "CRDT";
        }else if ($type == "CRDT" && $this->session->userdata('credit_type') == 2){
            $tmp = $receiver;
            $receiver = $sender;
            $sender = $tmp;
            $username = $receiver;
            $type = "CRDT";
            $sub_account = $sender;
            // $remarks = $credits . " credit added for " . $receiver . " from " . $sender . " by " . $this->userinfo['username'];
             $remarks =  $credits . " credits" . " recovered from " . $sender ;
        // $remarks =  $credits . " credits" . " recovered from " . $sender;
        }else if ($type == "DBIT" && $this->session->userdata('credit_type') == 1){
            $tmp = $receiver;
            $receiver = $sender;
            $sender = $tmp;
            $username = $sender;
            $type = "DBIT";
            // $remarks =  $sender . " transferred " . $credits . " amount credit to " . $receiver . " by " . $this->userinfo['username'];
              
                $remarks =  $credits . " credits" . " recovered by " . $this->userinfo['username'] ;
        }

        $options = array(
            'username'    => $username,
            'type'        => $type,
            "transaction" => (int) $transaction,
            "periods"     => (int) $credits,
            "timestamp"   => date("Y-m-d H:i:s"),
            "coverage_start" => $coverageStart,
            "coverage_end" => $expires,
            "remarks" => $remarks,          
            "account" => $sub_account
        );

        if ($this->db->insert('transactions', $options)) {
            return true;
        } else {
            return false;
        }

    }
    public function credit_manage_by_manager($credits, $type, $sender, $receiver = null, $expires = null, $coverageStart = null, $numberFree = 0) {

        $remarks = null;
        $isBonus = false;    
        $username = "";
        $sub_account = "";
        $created_by = $this->userinfo['username'];
        if( $type == "CRDT") {
            $transaction_id = $this->db->select_max('transaction')->where('username', $sender)->get('transactions')->row();
        }else{
            $transaction_id = $this->db->select_max('transaction')->where('username', $receiver)->get('transactions')->row();
        }

        $transaction    = $transaction_id->transaction + 1;

        if($type == "CRDT" && $this->session->userdata('credit_type')==1){
            $remarks =  $sender . " transferred " . $credits . " credits to " . $receiver;
            $username = $sender;
            $type = "DBIT";
            $sub_account = $receiver;
        }else if ($type == "DBIT" && $this->session->userdata('credit_type') == 2){
            $remarks =  $credits . " credits" . " received by " . $sender;
            $username = $receiver;
            $type = "CRDT";
        }else if ($type == "DBIT" && $this->session->userdata('credit_type') == 1){
            $tmp = $receiver;
            $receiver = $sender;
            $sender = $tmp;
            $username = $sender;
            $type = "DBIT";
            $remarks =  $credits . " credits" . " recovered by " . $receiver ;
        }else if ($type == "CRDT" && $this->session->userdata('credit_type') == 2){
            $tmp = $receiver;
            $receiver = $sender;
            $sender = $tmp;
            $username = $receiver;
            $type = "CRDT";
            $sub_account = $sender;
            $remarks =  $credits . " credits" . " recovered from " . $sender ;
        }

        $options = array(
            'username'    => $username,
            'type'        => $type,
            "transaction" => (int) $transaction,
            "periods"     => (int) $credits,
            "timestamp"   => date("Y-m-d H:i:s"),
            "coverage_start" => $coverageStart,
            "coverage_end" => $expires,
            "remarks" => $remarks,          
            "account" => $sub_account,
            "created_by" => $created_by
        );

        if ($this->db->insert('transactions', $options)) {
            return true;
        } else {
            return false;
        }

    }
     public function credit_manage_by_manager_dealer($credits, $type, $sender, $receiver = null, $expires = null, $coverageStart = null, $numberFree = 0) {

        $remarks = null;
        $isBonus = false;    
        $username = "";
        $sub_account = "";
        if( $type == "CRDT") {
            $transaction_id = $this->db->select_max('transaction')->where('username', $sender)->get('transactions')->row();
        }else{
            $transaction_id = $this->db->select_max('transaction')->where('username', $receiver)->get('transactions')->row();
        }

        $transaction    = $transaction_id->transaction + 1;

        if($type == "CRDT" && $this->session->userdata('credit_type')==1){
            // $remarks =  $sender . " transferred " . $credits . " amount credit to " . $receiver . " by " . $this->userinfo['username'];
            // $remarks =  $receiver . " received " . $credits . " credits";
            $remarks =  $sender . " transferred " . $credits . " credits to " . $receiver;
            $username = $sender;
            $type = "DBIT";
            $sub_account = $receiver;
        }else if ($type == "DBIT" && $this->session->userdata('credit_type') == 2){
            // $remarks = $credits . " credit added for " . $receiver . " from " . $sender . " by " . $this->userinfo['username'];
            $remarks =  $credits . " credits" . " received by " . $this->userinfo['username'];
            $username = $receiver;
            $type = "CRDT";
        }else if ($type == "DBIT" && $this->session->userdata('credit_type') == 1){
            $tmp = $receiver;
            $receiver = $sender;
            $sender = $tmp;
            $username = $sender;
            $type = "DBIT";
            // $remarks =  $sender . " transferred " . $credits . " amount credit to " . $receiver . " by " . $this->userinfo['username'];
              
            $remarks =  $credits . " credits" . " recovered by " . $this->userinfo['username'] ;
        }else if ($type == "CRDT" && $this->session->userdata('credit_type') == 2){
            $tmp = $receiver;
            $receiver = $sender;
            $sender = $tmp;
            $username = $receiver;
            $type = "CRDT";
            $sub_account = $sender;
            // $remarks = $credits . " credit added for " . $receiver . " from " . $sender . " by " . $this->userinfo['username'];
             $remarks =  $credits . " credits" . " recovered from " . $sender ;
        // $remarks =  $credits . " credits" . " recovered from " . $sender;
        
        }

        $options = array(
            'username'    => $username,
            'type'        => $type,
            "transaction" => (int) $transaction,
            "periods"     => (int) $credits,
            "timestamp"   => date("Y-m-d H:i:s"),
            "coverage_start" => $coverageStart,
            "coverage_end" => $expires,
            "remarks" => $remarks,          
            "account" => $sub_account
        );

        if ($this->db->insert('transactions', $options)) {
            return true;
        } else {
            return false;
        }

    }
    public function get_credit_balance($username) {
        $sql = $this->db->query("select sum(case when type = 'CRDT' then periods else -periods end) as balance from transactions where username = '" . $username . "';");
        $row = $sql->row();
        return (int) $row->balance;
    }

    public function get_all($username) {
        $sql = $this->db->query("select transaction,username, type, " .
            "case when type = 'CRDT' then periods else -periods end as periods, amount, account, coverage_start,coverage_end,remarks,free_month,timestamp,created_by from transactions where username = '" . $username . "' order by timestamp DESC");
        $result = $sql;
        return $result;
    }
    public function get_all_admin($username) {
        $sql = $this->db->query("select transaction,username, type, " .
            "case when type = 'CRDT' then -periods else periods end as periods, amount, account, coverage_start,coverage_end,remarks,free_month,timestamp,created_by from transactions where username = '" . $username . "' order by timestamp DESC");
        $result = $sql;
        return $result;
    }
}

/* End of file Transaction_model.php */
/* Location: ./application/modules/admin/models/Transaction_model.php */
