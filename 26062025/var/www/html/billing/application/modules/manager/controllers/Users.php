<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Users extends ManagerController {
    protected $module_name = 'users';
    public $userinfo;
    public function __construct() {
        parent::__construct();
        $this->userinfo = $this->session->userdata('auth_info');
    }

    public function index() {
        $this->data['title']  = 'Manage ' . $this->module_name;
        // $this->data['module'] = $this->module_name;
        // $query                = trim($this->input->get('query'));
        $status                      = trim($this->input->get('status'));
        if (empty($status)){
            $this->session->unset_userdata('status');
        }else{
            $this->session->set_userdata('status',  $status );
        }
        $userid = $this->userinfo['username']; // cleaner reference
        // if (!empty($query)) {
        //     $sql = $this->manager_model->get_all_users($this->user['username'],$query);
        // } else {
        //    $sql = '';
        // }
        // $this->data['sql'] = $sql;

		// $sql_expired = $this->manager_model->get_all_users_expired($this->user['username']);
		// $this->data['sql_expired'] = $sql_expired;
        // $this->data['query'] = $query;
		$this->data['total_users'] = $this->users_model->get_users_count_by_status($userid, "total");
        $this->data['expired_users'] = $this->users_model->get_users_count_by_status($userid, "expired");
        $this->data['active_users']  = $this->users_model->get_users_count_by_status($userid, "active");
        $this->data['deduction'] = arrayDataCreditDeduction();
        $this->render('users/index');
    }
    public function data_list(){
        $request = $this->input->post();
        $draw   = intval($request['draw']);
        $start  = intval($request['start']);
        $length = intval($request['length']);
        $searchValue = $request['search']['value'];
        $status = $this->session->userdata('status');

        $columns = ['', 'account', 'mac', 'full_name', '', '', 'username', 'status', 'created', '', 'expires'];

        $orderDir="";
        $orderBy="";
        if(!empty($request['order'])){
            $orderColumn = $request['order'][0]['column']; // column index
            $orderDir    = $request['order'][0]['dir'];    
            $orderBy = $columns[$orderColumn]; // convert index to column name
        }

        $usernames = $this->manager_model->get_all_users($this->user['username']);

        $result = $this->users_model->get_user_by_status($usernames, $status, $length, $start, $orderBy, $orderDir, $searchValue);
        $users = $result['users'];
        $totalFiltered = $result['filtered_count'];
        $data = [];
        
        foreach ($users as $row) {
            $reseller = $this->db->select("username_owner")->where('username', $row['username'])->get('users')->row();
            $created  = substr($row["created"], 0, 10);
            $data[] = [
                '<td><input type="checkbox" class="row-select" value='.$row['account'].'></td>',
                '<td>' . $row['account'] . '</td>',
                '<td><a href="' . site_url('manager/users/edit/' . $row['account']) . '">' . $row['mac'] . '</a></td>',
                '<td><a href="' . site_url('manager/users/edit/' . $row['account']) . '">' . $row['full_name'] . '</a></td>',
                '<td>' . $row['password'] . '</td>',
                '<td>' .$reseller-> username_owner. '</td>',
                '<td>' . $row['username'] . '</td>',
                '<td>' . (
                    (intval($row['status']) == 0)
                        ? '<span class="label label-sm label-success block">Active</span>'
                        : '<span class="label label-sm label-danger block">INACTIVE</span>'
                ) . '</td>',
                '<td>' .$created . '</td>',
                '<td>' . $this->stalker_model->receiver_staus($row['account']) . '</td>',
                '<td>' .
                    $this->stalker_model->expiry_date($row["expires"]) .
                    ' <a href="javascript:void(0)" onclick="add1Month(this, \'' . $row["account"] . '\')" class="label label-sm button-one-month">+1</a>' .
                    form_open('manager/users/renewOneMonth/' . $row["account"], ['class' => 'form-horizontal']) .
                        '<input type="hidden" name="validity" value="1">' .
                        '<input type="hidden" name="reseller" value="' . htmlspecialchars(get_reseller($row["username"], 'SRSLR'), ENT_QUOTES, 'UTF-8') . '">' .
                        '<input type="hidden" name="dealer" value="' . htmlspecialchars(get_dealer($row["username"], 'RSLR'), ENT_QUOTES, 'UTF-8') . '">' .
                        '<button type="submit" class="label label-sm label-primary" style="display:none;"></button>' .
                    form_close() .
                '</td>',
                '<td>' . $this->button($row["expires"], 'manager', $row["account"]) . '</td>'
            ];
            
        }
        $response = [
            'draw' => $draw,
            'recordsFiltered' => $totalFiltered,
            'data' => $data,
            'csrfHash' => $this->security->get_csrf_hash(), // CSRF hash for next request
        ];
        echo json_encode($response);
    }
    public function expired_data(){
        $request = $this->input->post();
        $draw   = intval($request['draw']);
        $start  = intval($request['start']);
        $length = intval($request['length']);
        $searchValue = $request['search']['value'];
        $status = $this->session->userdata('status');
        // Build query
        $usernames = $this->manager_model->get_all_users($this->user['username']);
        if (!empty($searchValue)) {
            $this->db->group_start(); // Start the group
            $this->db->like('full_name', $searchValue);
            $this->db->or_like('mac', $searchValue);
            $this->db->or_like('account', $searchValue);
            $this->db->group_end(); // End the group
        }
       
        
        $this->db->where('expires < NOW()', null, false);
        $this->db->limit($length, $start);
        $this->db->where_in('username', $usernames);
       
        $sql = $this->db->get('accounts');
        // var_dump($this->db->last_query());
        $users = $sql->result_array();
        // var_dump($sql);
        $data = [];
        $module='';
        if ($this->user['type']== "RSLR"){
            $module='dealer';
        }else if($this->user['type']== "SRSLR"){
            $module='reseller';
        
        }else if($this->user['type']== "MNGR"){
            $module='manager';
        }else{
            $module='admin';
        }
       
        foreach ($users as $row) {
            // var_dump($row);die();
            $reseller = $this->db->select("username_owner")->where('username', $row['username'])->get('users')->row();
            $data[] = [
                '<td>' . $row['account'] . '</td>',
                '<td><a href="' . site_url($module . '/users/edit/' . $row['account']) . '">' . $row['mac'] . '</a></td>',
                '<td><a href="' . site_url($module . '/users/edit/' . $row['account']) . '">' . $row['full_name'] . '</a></td>',
                '<td>' . $row['password'] . '</td>',
               '<td>' .$reseller-> username_owner. '</td>',
                '<td>' . $row['username'] . '</td>',
                '<td>' . (
                    (intval($row['status']) == 0)
                        ? '<span class="label label-sm label-success block">Active</span>'
                        : '<span class="label label-sm label-danger block">INACTIVE</span>'
                ) . '</td>',
                '<td>' . $this->stalker_model->receiver_staus($row['account']) . '</td>',
                '<td>' .
                    $this->stalker_model->expiry_date($row["expires"]) .
                    ' <a href="javascript:void(0)" onclick="add1Month(this, \'' . $row["account"] . '\')" class="label label-sm button-one-month">+1</a>' .
                    form_open($module.'/users/renewOneMonth/' . $row["account"], ['class' => 'form-horizontal']) .
                        '<input type="hidden" name="validity" value="1">' .
                        '<input type="hidden" name="reseller" value="' . htmlspecialchars(get_reseller($row["username"], 'SRSLR'), ENT_QUOTES, 'UTF-8') . '">' .
                        '<input type="hidden" name="dealer" value="' . htmlspecialchars(get_dealer($row["username"], 'RSLR'), ENT_QUOTES, 'UTF-8') . '">' .
                        '<button type="submit" class="label label-sm label-primary" style="display:none;"></button>' .
                    form_close() .
                '</td>',
                '<td>' . $this->button($row["expires"], $module, $row["account"]) . '</td>'
            ];
            
        }

        // // Total records without filter
        // // $totalRecords = $this->db->count_all('accounts');
        $this->db->where('expires < NOW()', null, false);
        $totalFiltered = $this->db
            ->where_in('username', $usernames)
            ->count_all_results('accounts');
        // // Prepare response
        $response = [
            'draw' => $draw,
            // 'recordsTotal' => $totalFiltered,
            'recordsFiltered' => $totalFiltered,
            'data' => $data,
            'csrfHash' => $this->security->get_csrf_hash(), // CSRF hash for next request
        ];
        echo json_encode($response);
    }
    public function button($expired, $module, $account){
        $button = '';
        $d1  = strtotime($expired);
        if ($d1 < time()) {
            $expired_status = 'Expired';
        } else {

            $date1 = date_create(date('Y-m-d H:i:s'));
            $date2 = date_create($expired);
            $diff  = date_diff($date1, $date2);
            $expired_status =  $diff->format("%a");
        }
        
        $button .= edit_button($module . '/users/edit/' . $account);
        $button .= '<a href="javascript:void(0)" class="btn btn-xs button-one-month action-left blue-steel text-white" onclick="reset(this, \'' . $account . '\')"  data-popup="tooltip" title="Reset"><i class="icon-reset"></i> Reset </a>';
        
        if ($expired_status !== "Expired") {
            if ($module == 'manager' or $module == 'admin') {
                $onclick           = "return confirm('This account still active, Do you want really delete this user account?');";
                $button .=  '<a href="'.site_url($module . '/users/delete/' . $account).'" onclick="' . $onclick . '" class="btn  action-right btn-xs btn-danger bg-danger-300 tooltips" data-container="body" data-popup="tooltip" title="this account still active" ><i class="icon-trash"></i> Del </a>';
            } else {
                $button .= del_dis_button("You can't delete active user account");
            }
        } else {
            $button .= del_button($module . "/users/delete/" . $account, 'User');
        }

        return $button;
    }
    public function reset($account){
        $data = [
            'device_id'    => NULL,
            'device_id2'   => NULL,
            'access_token' => NULL
        ];
        // Update table
        if($this->stalker_model->reset_data($account, $data)){
            $this->msg('User account was updated successfully!');
            redirect('manager/users', 'refresh');
        }else{
            $this->msg('updat Error successfully!');
            redirect('manager/users', 'refresh');
        }
    }
    public function delete($username = NULL) {
        //delete the user account only permitted by admin
        if (empty($username)) {
            show_404();
            exit;
        }
        if ($this->manager_model->is_myuser($username, $this->user['username']) == false) {
            show_404();
            exit;
        }
        if ($this->users_model->delete($username)) {
            $this->msg('User account was deleted successfully!');
            redirect('manager/users', 'refresh');
        } else {
            $this->msg('Error Occured , Please try again later!', 'danger');
            redirect('manager/users', 'refresh');
        }
    }

    public function edit($login = NULL) {
        $this->data['title']  = "Send Message to User";
        $this->data['module'] = "Send Mesage to User";

        $sql = $this->users_model->get_user($login);
        if ($sql->num_rows() == 0 || empty($login)) {
            show_404();
        } else {
            if ($this->manager_model->is_myuser($login, $this->user['username']) !== true) {show_404();exit;}
            $user = $this->users_model->get_stalker_user($login);
            $this->form_validation->set_rules('message', 'Message', 'trim|required');
            if ($this->form_validation->run() == true) {
                $message  = $this->input->post('message');
                $send_msg = $this->stalker_model->send_message($user->id, $message);
                if ($send_msg == true) {
                    $this->msg('Message was send!');
                    redirect('manager/users/index/', 'refresh');
                } else {
                    $this->msg('Message was failed to send, try again!', 'danger');
                    redirect('manager/users/index/', 'refresh');
                }
            } else {
                $this->data['events'] = $this->stalker_model->get_events($user->id);
                $this->data['row']    = $sql->row();
                $this->render('users/edit');
            }
        }
    }

    public function activate($login = NULL) {
        if (empty($login)) {
            show_404();
            exit;
        } else {
            $is_match = $this->manager_model->is_myuser($login, $this->user['username']);
            if ($is_match == false) {
                show_404();
                exit;
            }
            $sql = $this->users_model->get_user($login);
            if ($sql->num_rows() > 0) {
                $user         = $sql->row();
                $stalker_user = $this->users_model->get_stalker_user($login);
                if ($this->stalker_model->check_expired($user->expires) == "Expired") {
                    show_error("You can't activate expired box");
                    die;
                } else {
                    if ($user->status == ACCOUNT_STATUS_ON) {
                        show_error("The Box was already Active!");
                        die;
                    } else {

                        $this->db->set('status', ACCOUNT_STATUS_ON);
                        $this->db->where('account', $login);
                        $this->db->update('accounts');

                        $this->users_model->change_status(ACCOUNT_STATUS_ON, $login);
                        $this->stalker_model->cut_on($stalker_user->id);
                        //$this->stalker_model->restore_package($stalker_user->id);
                        $this->msg('STB Box was activated successfully!');
                        redirect('manager/users', 'refresh');
                    }

                }
            } else {
                show_404();
                exit;
            }
        }
    }

    public function block($login = NULL) {
        if (empty($login)) {
            show_404();
            exit;
        } else {
            $is_match = $this->manager_model->is_myuser($login, $this->user['username']);
            if ($is_match == false) {
                show_404();
                exit;
            }
            $sql = $this->users_model->get_user($login);
            if ($sql->num_rows() > 0) {
                $user         = $sql->row();
                $stalker_user = $this->users_model->get_stalker_user($login);
                if ($this->stalker_model->check_expired($user->expires) == "Expired") {
                    show_error("You can't change expired box");
                    die;
                } else {
                    if ($user->status == ACCOUNT_STATUS_OFF) {
                        show_error("The Box was already blocked or expired!");
                        die;
                    } else {
                        $this->db->set('status', ACCOUNT_STATUS_OFF);
                        $this->db->where('account', $login);
                        $this->db->update('accounts');

                        $this->users_model->change_status(ACCOUNT_STATUS_OFF, $login);
                        $this->stalker_model->cut_off($stalker_user->id);
                        // $this->stalker_model->restore_package($stalker_user->id);
                        $this->msg('STB Box was blocked successfully!');
                        redirect('manager/users', 'refresh');
                    }

                }
            } else {
                show_404();
                exit;
            }
        }
    }
    public function renew_one_month_bulk(){

        // Before update user_credit_summarize
        $accounts = $this->input->post("checkedData");
        $validity = $this->input->post("validity");
        $count=0;
        $data=[];
        foreach($accounts as $account){    
            $remain_credits = $this->transaction_model->get_credit_balance($this->userinfo['username']);
            $validity_int = intval($validity);
            if ($remain_credits > $validity_int) {
                $user = $this->users_model->get_user($account)->row();
                $mac_db_data = $this->db->where(array('mac' => $user->mac))->get('free_trial_users');

                // Improved condition for free trial check (Free trial)
                if ($validity === 'FREE_TRIAL') {
                    $this->db->where('mac', $user->mac);
                    $countUsingTrial = $this->db->count_all_results('free_trial_users');
                    $isRetryTrial = boolval($this->configs_model->find(Configs_model::KEY_RETRY_TRIAL)->value ?? 0);
                    $numberRetryTrial = intval($this->configs_model->find(Configs_model::KEY_NUMBER_RETRY_TRIAL)->value ?? 0);
                    if (!$isRetryTrial && $countUsingTrial > 0) {
                        $data[$account] = "<div  style='display:flex;flex-wrap:wrap;justify-content:center;align-items:center;font-size:1.5rem'><p><h5 style='color:red;margin: 1rem;'>Account: " . htmlspecialchars($account) . "</h5> cannot add " . htmlspecialchars($validity) . " because the specified MAC (" . htmlspecialchars($user->mac) . ") has already used a free trial.</p></div><hr>";
                        continue;
                    }
                    
                    if ($isRetryTrial && $countUsingTrial >= $numberRetryTrial) {
                        $data[$account] = "<div  style='display:flex;flex-wrap:wrap;justify-content:center;align-items:center;font-size:1.5rem'><p><h5 style='color:red;margin: 1rem;'>Account: " . htmlspecialchars($account) . "</h5> cannot add " . htmlspecialchars($validity) . " because the specified MAC (" . htmlspecialchars($user->mac) . ") has exceeded the free trial usage limit.</p></div><hr>";
                        continue;
                    }
                }   

                // Improved condition for free trial check (1 month free)
                $is_free_trial_attempt = ($validity === '1_MONTH_FREE');
                $has_existing_free_trial = ($mac_db_data->num_rows() > 0);

                if ($is_free_trial_attempt && $has_existing_free_trial) {
                    $data[$account] = "<div  style='display:flex;flex-wrap:wrap;justify-content:center;align-items:center;font-size:1.5rem'><p><h5 style='color:red;margin: 1rem;'>Account: " . htmlspecialchars($account) . "</h5> cannot add " . htmlspecialchars($validity) . " because the specified MAC (" . htmlspecialchars($user->mac) . ") has already used a free trial.</p></div><hr>";
                }else{
                    $this->creditsummarize_model->before_update($account);               
                    if ($this->users_model->renew($account, $validity, $this->userinfo["username"]) === true) {
                        $data[$account] = "<div  style='display:flex;flex-wrap:wrap;justify-content:center;align-items:center;font-size:1.5rem'><p><h5 style='color:green;margin: 1rem;'>Success: </h5> " . htmlspecialchars($validity) . " months successfully added to user <h5 style='color:green;margin: 1rem;'> " . htmlspecialchars($account) . "</h5>.</p></div><hr>";
                        log_debug_msg("admin/controllers/users.php/renew(): " . htmlspecialchars($validity) . " months successfully added to user " . htmlspecialchars($account));
                    } else {
                        $data[$account] = "<div><p><h5 style='color:red'>Error:</h5> There was an error while trying to add " . htmlspecialchars($validity) . " months to user <h5 style='color:red'>" . htmlspecialchars($account) . "</h5>.</p></div>";
                        log_debug_msg("admin/controllers/users.php/renew(): there was an error while trying to add " . htmlspecialchars($validity) . " months to user " . htmlspecialchars($account));
                    }
                }
            }else{
                $data["finish"] = "<div style='display:flex;flex-wrap:wrap;justify-content:center;align-items:center;font-size:1.5rem'><p><h5 style='color:red;margin: 1rem;'>You consumed all credits, please charge credits</h5></p></div><hr>";
                break;
            }

        }          
      
        echo json_encode(["result"=> true, "data" =>$data]);
    }
    public function renewOneMonth($username = NULL)
    {
        $users = $this->users_model->get_user($username);
        if (empty($username) || $users->num_rows() == 0) {
            show_404();
            exit();
        }

        // Before update user_credit_summarize
        $this->creditsummarize_model->before_update($username);

        $this->form_validation->set_rules('validity', 'Validity', 'trim|required|callback_check_validity');

        // Param query
        $query = $this->input->post('query');
        $credits = $this->input->post('validity');

        if ($this->form_validation->run() == TRUE) {
            if ($this->users_model->renew($username, $credits, $this->userinfo['username']) === true) {
                log_debug_msg("manager/controllers/users.php/renew(): $credits months successfully added to user $username");
                $this->msg('Renewal successfully!');
            } else {
                log_debug_msg("manager/controllers/users.php/renew(): there was an error while trying to add $credits months to user $username");
                $this->msg('Error Occured, Please try again later', 'danger');
            }
        } else {
            $validity_error = form_error('validity');

            $this->msg($validity_error, 'danger');
        }
        
        redirect('manager/users'.(!empty($query) ? '?query=' . $query : ''), 'refresh');
    }

    private function check_validity_format($validity, $callback_name) {
        if ($validity === 'FREE_TRIAL') { 
            return TRUE;
        }

        if (is_numeric($validity)) {
            $validity = intval($validity);
        } else {
            $this->form_validation->set_message($callback_name, "The specified option is not valid");
            return FALSE;
        }

        if ($validity < 1 or $validity > 24) {
            $this->form_validation->set_message($callback_name, "The specified period is not valid");
            return FALSE;
        }

        return TRUE;
    }

    private function check_validity_credits($validity, $callback_name) {
        if ($validity === 'FREE_TRIAL') { 
            return TRUE;
        }

        $dealer = $this->input->post('dealer');
        $reseller = $this->input->post('reseller');
        $username = (empty($dealer)) ? $reseller : $dealer;
        $remain_credits = $this->transaction_model->get_credit_balance($this->userinfo['username']);
        if ($remain_credits < $validity) {
            $this->form_validation->set_message($callback_name, $username . " don't have enough credits to create account!");
            return FALSE;
        }

        return TRUE;
    }

    private function check_validity_free_trial($validity, $callback_name) {
        if ($validity !== 'FREE_TRIAL') { 
            return TRUE;
        }

        $mac = $this->input->post('mac');
        $mac_db_data = $this->db->where(array('mac' => $mac))->get('free_trial_users');
        if ($mac_db_data->num_rows() != 0) {
            $this->form_validation->set_message($callback_name, "The specified MAC cannot use another free trial");
            return FALSE;
        }

        return TRUE;
    }

    public function check_validity($validity) {

        $callback_name = 'check_validity';

        if (!$this->check_validity_format($validity, $callback_name)) {
            return FALSE;
        }
       
        if (!$this->check_validity_credits($validity, $callback_name)) {
            return FALSE;
        }
        if (!$this->check_validity_free_trial($validity, $callback_name)) {
            return FALSE;
        }

        return TRUE;
    }
}
/* End of file Users.php */
/* Location: ./application/modules/admin/controllers/Users.php */
