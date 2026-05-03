<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Users extends AdminController {
    protected $module_name = 'users';

    const KEY_FREE_MONTH = '1_month_free';
    public $userinfo;
    public function __construct() {
        parent::__construct();
        $this->load->model('dashboard_model');
        $this->load->helper('deduction_helper');
        $this->userinfo = $this->session->userdata('auth_info');
    }

    public function index() {
        $this->data['title']         = 'Manage ' . $this->module_name;
        $status                      = trim($this->input->get('status'));
        $status                      = $this->input->get('status');
        if (empty($status)){
            $this->session->unset_userdata('status');
        }else{
            $this->session->set_userdata('status',  $status );
        }
        $this->data['total_users'] = $this->users_model->get_users_count_by_status(null, "total");
        $this->data['expired_users'] = $this->users_model->get_users_count_by_status(null, "expired");
        $this->data['active_users']  = $this->users_model->get_users_count_by_status(null, "active");
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

        $columns = ['','','', '', 'account', 'mac','full_name','', 'status', 'expires']; // adjust to your table columns
       
        $orderDir="";
        $orderBy="";

        if(!empty($request['order'])){
            $orderColumn = $request['order'][0]['column']; // column index
            $orderDir    = $request['order'][0]['dir'];    
            $orderBy = $columns[$orderColumn]; // convert index to column name
        }
       
        $result = $this->users_model->get_user_by_status(null, $status, $length, $start, $orderBy, $orderDir, $searchValue);
        $users = $result['users'];
        $totalFiltered = $result['filtered_count'];
        $data = [];
       
        foreach ($users as $row) {
            $reseller = $this->db->select("username_owner")->where('username', $row['username'])->get('users')->row();
            $manager = $this->db->select("username_owner")->where('username', $reseller->username_owner)->get('users')->row();
            $data[] = [
                '<td><input type="checkbox" class="row-select" value='.$row['account'].'></td>',
                '<td>' . $manager->username_owner . '</td>',
                '<td>' .$reseller-> username_owner. '</td>',
                '<td>' . $row['username'] . '</td>',
                '<td>' . $row['account'] . '</td>',
                '<td><a href="' . site_url( 'admin/users/edit/' . $row['account']) . '">' . $row['full_name'] . '</a></td>',
                '<td>' . $row['password'] . '</td>',
                '<td><a href="' . site_url('admin/users/edit/' . $row['account']) . '">' . $row['mac'] . '</a></td>',
                '<td>' . (
                    (intval($row['status']) == 0)
                        ? '<span class="label label-sm label-success block">Active</span>'
                        : '<span class="label label-sm label-danger block">INACTIVE</span>'
                ) . '</td>',
                '<td>' .
                    $this->stalker_model->expiry_date($row["expires"]) .
                    ' <a href="javascript:void(0)" onclick="add1Month(this, \'' . $row["account"] . '\')" class="label label-sm button-one-month">+1</a>' .
                    form_open('admin/users/renewOneMonth/' . $row["account"], ['class' => 'form-horizontal']) .
                        '<input type="hidden" name="validity" value="1">' .
                        '<input type="hidden" name="reseller" value="' . htmlspecialchars(get_reseller($row["username"], 'SRSLR'), ENT_QUOTES, 'UTF-8') . '">' .
                        '<input type="hidden" name="dealer" value="' . htmlspecialchars(get_dealer($row["username"], 'RSLR'), ENT_QUOTES, 'UTF-8') . '">' .
                        '<button type="submit" class="label label-sm label-primary" style="display:none;"></button>' .
                    form_close() .
                '</td>',
                '<td>' . $this->button($row["expires"], 'admin', $row["account"]) . '</td>'
            ];
        }
        $response = [
            'draw' => $draw,
            'recordsTotal' => $totalFiltered,
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
            redirect('admin/users', 'refresh');
        }else{
            $this->msg('updat Error successfully!');
            redirect('admin/users', 'refresh');
        }
    }
    public function add() {
        $this->data['title']     = 'Add ' . $this->module_name;
        $this->data['module']    = $this->module_name;
        $this->data['resellers'] = $this->reseller_model->get_all();
        $this->data['deduction'] = arrayDataCreditDeduction();
        // Confif 1 month free
        $config = $this->configs_model->find(self::KEY_FREE_MONTH);
        $this->data['one_month_free_value'] = $config->value ?? 0;

        $this->form_validation->set_rules('name', 'Name', 'trim|alpha_numeric_spaces');
        $this->form_validation->set_rules('username', 'Username', 'trim|strtolower|alpha_numeric|required|valid_login');
        $this->form_validation->set_rules('password', 'Password', 'trim|required|min_length[4]|max_length[100]');
        $this->form_validation->set_rules('mac', 'MAC', 'trim|strtoupper|valid_mac|is_unique_mac');
        //$this->form_validation->set_rules('validity', 'Validity', 'trim|required|numeric|max_length[2]|callback_check_credits');
        $this->form_validation->set_rules('validity', 'Validity', 'trim|required|callback_check_validity');
        $this->form_validation->set_rules('reseller', 'Reseller', 'trim|required');
        if ($this->form_validation->run() == true) {
            $dealer   = $this->input->post('dealer');
            $reseller = $this->input->post('reseller');
            $validity = $this->input->post('validity');
            $username = (empty($dealer)) ? $reseller : $dealer;
            $options  = array(
                'name'           => $this->input->post('name'),
                'account'        => $this->input->post('username'),
                'password'       => $this->input->post('password'),
                'status'         => $this->input->post('status'),
                'mac'            => $this->input->post('mac'),
                'tariff_plan_id' => $this->input->post('package'),
                'username'       => $username,
                'validity'       => $validity,
                'password'       => $this->input->post('password'),
            );
            $is_created = $this->users_model->create($options);
            if ($is_created['status'] == true) {
                // get custom package id from stalker
                $custom_pack_id = $this->stalker_model->get_custom_plan_id();
                if (isset($_POST['packs']) and $tariff = $custom_pack_id) {
                    $packages = $this->input->post('packs[]');
                    $user_id  = $is_created['id'];
                    $this->stalker_model->add_package($user_id, $packages);
                }
                $this->msg('User account was created successfully!');
                redirect('admin/users', 'refresh');
            }
        } else {
            $this->render('users/add');
        }
    }

    /*Edit user account*/
    public function edit($username = NULL) {
        $users = $this->users_model->get_user($username);
        if (empty($username) || $users->num_rows() == 0) {
            show_404();
            exit();
        }
        $current_mac_address = $users->row()->mac;
        $this->data['title']     = 'Edit ' . $this->module_name;
        $this->data['module']    = $this->module_name;
        $this->data['resellers'] = $this->reseller_model->get_all();
        $this->data['row']       = $users->row();
        $this->data['stalker']   = $this->users_model->get_stalker_user($username);
        $this->data['deduction'] = arrayDataCreditDeduction();
        $this->data['type']      = null;
        $this->form_validation->set_rules('name', 'Name', 'trim|alpha_numeric_spaces');
        $this->form_validation->set_rules('password', 'Password', 'trim|required|min_length[4]|max_length[100]');
        //$this->form_validation->set_rules('mac', 'MAC', 'trim|strtoupper|valid_mac|callback_check_mac[' . $username . ']');
        $this->form_validation->set_rules('mac', 'MAC', 'trim|strtoupper|valid_mac|callback_check_edited_mac[' . $username . ',' . $current_mac_address . ']');
        $this->form_validation->set_rules('reseller', 'Reseller', 'trim|required');
        $this->form_validation->set_rules('parent_password', 'Parent Pin', 'trim|required|exact_length[4]|is_numeric');
        if ($this->form_validation->run() == TRUE) {
            $dealer = $this->input->post('dealer');
            $reseller = $this->input->post('reseller');
            $username_owner = (empty($dealer)) ? $reseller : $dealer;
            $options = array(
                'name'              => $this->input->post('name'),
                'account'           => $username,
                'password'          => $this->input->post('password'),
                'status'            => $this->input->post('status'),
                'mac'               => $this->input->post('mac'),
                'tariff_plan_id'    => $this->input->post('package'),
                'username'          => $username_owner,
                'phone'             => $this->input->post('phone'),
                'note'              => $this->input->post('note'),
                'password'          => $this->input->post('password'),
                'parent_password'   => $this->input->post('parent_password'),
            );
            $is_updated = $this->users_model->update($options);
            if ($is_updated['status'] == TRUE) {
                // get custom package id from stalker
                $custom_pack_id = $this->stalker_model->get_custom_plan_id();
                if (isset($_POST['packs']) and $tariff = $custom_pack_id) {
                    $packages = $this->input->post('packs[]');
                    $user_id  = $is_updated['id'];
                    $this->stalker_model->update_package($user_id, $packages);
                }
                $this->msg('User account was updated successfully!');
                redirect('admin/users', 'refresh');
            }
        } else {
            $this->render('users/view');
        }
    }

    public function delete($username = NULL) {
        //delete the user account only permitted by admin
        if ($this->users_model->delete($username)) {
            $this->msg('User account was deleted successfully!');
            redirect('admin/users', 'refresh');
        } else {
            $this->msg('Error Occured , Please try again later!', 'danger', 'fa fa-warning');
            redirect('admin/users', 'refresh');
        }
    }

    /*Ajax Drop down for Resellers Section */
    public function get_dealer_dropdown() {
        $reseller    = $this->input->post('reseller');
        $sql         = $this->db->where('username_owner', $reseller)->order_by('name', 'asc')->get('users');
        echo $prefix = '<select class="form-control" name="dealer">';
        echo '<option value="" selected="selected">Please Select Dealer</option>';
        if ($sql->num_rows() > 0) {
            foreach ($sql->result() as $dealer) {
                echo '<option value="' . $dealer->username . '">' . $dealer->name . '</option>';
            }
        }
        echo $suffix = '</select>';
    }

    /*
    public function check_credits($validity)
    {
        $dealer         = $this->input->post('dealer');
        $reseller       = $this->input->post('reseller');
        $username       = (empty($dealer)) ? $reseller : $dealer;
        $remain_credits = $this->transaction_model->get_credit_balance($username);
        if ($remain_credits < $validity) {
            $this->form_validation->set_message('check_credits', $username . " don't have enough credits to create account!");
            return false;
        } else {
            return true;
        }
    }
    public function check_mac($mac,$username)
    {
        $stalker   = $this->load->database('stalker', true);
        // $edit_mode = $this->uri->segment(4);
        $sql = $stalker->where('login !=', $username)->where('mac', $mac)->get('users');
        if ($sql->num_rows() == 0 || empty($mac)) {
            return true;
        } else {
            $this->form_validation->set_message('check_mac', 'This MAC Address was already exists!');
            return false;
        }
    }
    */

    private function check_validity_format($validity, $callback_name) {
        if ($validity === 'FREE_TRIAL' || $validity === '1_MONTH_FREE') { 
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
        if ($validity === 'FREE_TRIAL' || $validity === '1_MONTH_FREE') { 
            return TRUE;
        }

        $dealer = $this->input->post('dealer');
        $reseller = $this->input->post('reseller');
        $username = (empty($dealer)) ? $reseller : $dealer;
        $remain_credits = $this->transaction_model->get_credit_balance($username);
        if ($remain_credits < $validity) {
            $this->form_validation->set_message($callback_name, $username . " don't have enough credits to create account!");
            return FALSE;
        }

        return TRUE;
    }

    private function check_validity_free_trial($validity, $callback_name) {
        if ($validity !== 'FREE_TRIAL' || $validity === '1_MONTH_FREE') { 
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

    //public function check_edited_mac($mac, $username) {
    public function check_edited_mac($mac, $extra_params) {
        // a bit of a hack to be able to pack more then 2 params on the callback 
        // (see "https://stackoverflow.com/questions/8740973/in-codeigniter-how-to-pass-a-third-parameter-to-a-callback-form-validation")
        $params = preg_split('/,/', $extra_params);
        $username = $params[0];
        $current_mac_address = $params[1];      

        if (FALSE) { // the following code is currently not applicable for admin (thus admin can change the MAC of a Free Trial user)
            if ($this->users_model->is_free_trial_user($username) && $current_mac_address !== $mac) {
                $this->form_validation->set_message('check_edited_mac', 'Cannot change the MAC of a Free Trial user');
                return FALSE;
            }
        }   

        $stalker = $this->load->database('stalker', TRUE);
        // $edit_mode = $this->uri->segment(4);
        $sql = $stalker->where('login !=', $username)->where('mac', $mac)->get('users');
        if ($sql->num_rows() == 0 || empty($mac)) {
            return TRUE;
        } else {
            //$this->form_validation->set_message('check_edited_mac', 'This MAC address is in use');
            $this->form_validation->set_message('check_edited_mac', 'The MAC address \'' . $mac . '\' is in use');
            return FALSE;
        }
    }

    public function renew($username = NULL) {

        log_debug_msg("admin/controllers/users.php/renew(): entering");

        $users = $this->users_model->get_user($username);
        if (empty($username) || $users->num_rows() == 0) {
            show_404();
            exit();
        }

        // Before update user_credit_summarize
        $this->creditsummarize_model->before_update($username);

        $type = $this->input->post('type');

        $this->data['title']   = 'Renew ' . $this->module_name;
        $this->data['module']  = $this->module_name;
        $this->data['row']     = $users->row();
        $this->data['sql']     = $this->users_model->get_transactions($username);
        $this->data['stalker'] = $this->users_model->get_stalker_user($username);
        $this->data['deduction'] = arrayDataCreditDeduction();
        $this->data['type'] = $type;

        if (!is_null($type) && $type == "RENEW") {
            $this->form_validation->set_rules('validity', 'Validity', 'trim|required|callback_check_validity');
        } else {
            $this->form_validation->set_rules('credits', 'Credits', 'trim|required|numeric|max_length[2]|callback_check_renew_validity');
        }

        if ($this->form_validation->run() === true) {
            $credits = $this->input->post('credits');
            $validity = $this->input->post('validity');

            if ($type == "RENEW") {
                $credits = $validity;
            }
            
            if ($type == "RCDT") {
                log_debug_msg("admin/controllers/users.php/renew(): trying to recover credits from user $username");
                if ($this->users_model->recover_credits($username, $credits) === true) {
                    log_debug_msg("admin/controllers/users.php/renew(): $credits successfully recovered");
                    $this->msg($credits . ' credits were successfully recovered');
                    // redirect('admin/users/index/', 'refresh');
                    redirect('admin/users/edit/'.$username, 'refresh');
                } else {
                    log_debug_msg("admin/controllers/users.php/renew(): there was an error while trying to recover $credits credits from user $username");
                    show_error('Error Occured, Please try again later');
                    die();
                }
            } else {
                log_debug_msg("admin/controllers/users.php/renew(): trying to add months to user $username");

                // Validate FREE_TRIAL
                if ($credits === 'FREE_TRIAL') {
                    $user = $users->row();

                    $this->db->where('mac', $user->mac);
                    $countUsingTrial = $this->db->count_all_results('free_trial_users');

                    $isRetryTrial = boolval($this->configs_model->find(Configs_model::KEY_RETRY_TRIAL)->value ?? 0);
                    $numberRetryTrial = intval($this->configs_model->find(Configs_model::KEY_NUMBER_RETRY_TRIAL)->value ?? 0);

                    if (!$isRetryTrial && $countUsingTrial > 0) {
                        log_debug_msg("admin/controllers/users.php/renew(): You have already tried it. You cannot use it again");
                        $this->msg("You have already tried it. You cannot use it again.", 'danger');
                        redirect('admin/users/edit/'.$username, 'refresh');
                    }

                    if ($isRetryTrial && $countUsingTrial >= $numberRetryTrial) {
                        log_debug_msg("admin/controllers/users.php/renew(): $username has exceeded the free trial usage limit.");
                        $this->msg("$username has exceeded the free trial usage limit", 'danger');
                        redirect('admin/users/edit/'.$username, 'refresh');
                    }
                }

                if ($this->users_model->renew($username, $credits) === true) {
                    log_debug_msg("admin/controllers/users.php/renew(): $credits months successfully added to user $username");
                    $this->msg($credits . ' months were successfully added');
                    // redirect('admin/users/index/', 'refresh');
                    redirect('admin/users/edit/'.$username, 'refresh');
                } else {
                    log_debug_msg("admin/controllers/users.php/renew(): there was an error while trying to add $credits months to user $username");
                    show_error('Error Occured, Please try again later');
                    die();
                }

            }
        } else {
            log_debug_msg("admin/controllers/users.php/renew(): in 'else' section of form validation");
            $this->render('users/view');
        }
    }

    /*
    public function check_validity_renew_orig($credits)
    {
        $username  = $this->uri->segment(4);
        $owner_sql = $this->users_model->get_user($username);
        $owner     = $owner_sql->row();
        $balance  = ($type == "RCDT") ? $this->users_model->get_balance($username) : $this->transaction_model->get_credit_balance($owner->username);

        log_debug_msg("admin/controllers/users.php/check_validity(): \$username = $username");
        log_debug_msg("admin/controllers/users.php/check_validity(): \$owner_sql = $owner_sql");
        log_debug_msg("admin/controllers/users.php/check_validity(): \$owner = $owner");
        log_debug_msg("admin/controllers/users.php/check_validity(): \$balance = $balance");

        // $balance   = $this->transaction_model->get_credit_balance($owner->username);
        if ($balance < $credits) {
            $this->form_validation->set_message('check_validity', "Your dealer or reseller have don't have enough credits!");
            return false;
        } else {
            return true;
        }
    }
    */

    public function check_renew_validity($credits) {
        //$username = $this->user['username'];
        $username  = $this->uri->segment(4);
        $owner_sql = $this->users_model->get_user($username);
        $owner     = $owner_sql->row();
        $owner_username = $owner->username;
        $type      = $this->input->post('type');

        $balance   = ($type == "RCDT") ? $this->users_model->get_balance($username) : $this->transaction_model->get_credit_balance($owner_username);

        log_debug_msg("admin/controllers/users.php/check_renew_validity(): \$credits = $credits");
        log_debug_msg("admin/controllers/users.php/check_renew_validity(): \$username = $username");
        log_debug_msg("admin/controllers/users.php/check_renew_validity(): \$type = $type");
        log_debug_msg("admin/controllers/users.php/check_renew_validity(): \$owner_username = $owner_username");
        log_debug_msg("admin/controllers/users.php/check_renew_validity(): \$balance = $balance");

        if ($balance < $credits) {
            if ($type == "RCDT") {
                $validation_message = "Cannot recover $credits credits from user (recover max = $balance)";
            } else {
                $validation_message = "Your dealer or reseller don't have enough credits (remaining credits = $balance)";
            }
            $this->form_validation->set_message('check_renew_validity', $validation_message);
            log_debug_msg("admin/controllers/users.php/check_renew_validity(): returning false");
            return false;
        } else {
            log_debug_msg("admin/controllers/users.php/check_renew_validity(): returning true");
            return true;
        }
    }

    public function message($login = NULL) {
        $this->data['title']  = "Send Message to User";
        $this->data['module'] = "Send Mesage to User";
        $this->data['type'] = null;
        $sql                  = $this->users_model->get_user($login);
        if ($sql->num_rows() == 0 || empty($login)) {
            show_404();
        } else {
            $user = $this->users_model->get_stalker_user($login);
            $this->form_validation->set_rules('message', 'Message', 'trim|required');
            if ($this->form_validation->run() == true) {
                $message  = $this->input->post('message');
                $send_msg = $this->stalker_model->send_message($user->id, $message);
                if ($send_msg == true) {
                    $this->msg('Message was send!');
                    redirect('admin/users/edit/'.$login, 'refresh');
                } else {
                    $this->msg('Message was failed to send, try again!', 'danger');
                    redirect('admin/users/edit/'.$login, 'refresh');
                }
            } else {
                $this->data['events'] = $this->stalker_model->get_events($user->id);
                $this->data['row']    = $sql->row();
                $this->data['stalker']   = $this->users_model->get_stalker_user($login);
                $this->render('users/view');
            }
        }
    }
    public function renew_one_month_bulk(){
        // Before update user_credit_summarize
        $accounts = $this->input->get("checkedData");
        $validity = $this->input->get("validity");

        $data=[];
        // if ($this->check_validity_credits($validity, "check_validity") == TRUE) {
            foreach ($accounts as $account) {
                // Get user information
                $user = $this->users_model->get_user($account)->row();
            
                // Check if user exists
                if (!$user) {
                    $data[$account] = "<div style='display:flex;flex-wrap:wrap;justify-content:center;align-items:center;font-size:1.5rem'><p><h5 style='color:red;margin: 1rem;'>Account: " . htmlspecialchars($account) . "</h5> cannot be processed because the user was not found.</p></div><hr>";
                    continue; // Move to the next account
                }
            
                // Get remaining credits
                $remain_credits = $this->transaction_model->get_credit_balance($user->username);
            
                // Convert validity to an integer for comparison
                $validity_int = intval($validity);
            
                // Check for sufficient credits
                if ($remain_credits < $validity_int) {
                    $data[$account] = "<div style='display:flex;flex-wrap:wrap;justify-content:center;align-items:center;font-size:1.5rem'><p><h5 style='color:red;margin: 1rem;'>Account: " . htmlspecialchars($account) . "</h5> cannot add " . htmlspecialchars($validity) . " months because <h5 style='color:green;margin: 1rem;'>" . htmlspecialchars($user->username) . "</h5> does not have enough credits (remaining: " . htmlspecialchars($remain_credits) . ", required: " . htmlspecialchars($validity_int) . ").</p></div><hr>";
                } else {
                    // Check for free trial restrictions
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
                    } else {
                        // Proceed with renewal
                        $this->creditsummarize_model->before_update($account);
            
                        if ($this->users_model->renew($account, $validity) === true) {
                            $data[$account] = "<div  style='display:flex;flex-wrap:wrap;justify-content:center;align-items:center;font-size:1.5rem'><p><h5 style='color:green;margin: 1rem;'>Success: </h5> " . htmlspecialchars($validity) . " months successfully added to user <h5 style='color:green;margin: 1rem;'> " . htmlspecialchars($account) . "</h5>.</p></div><hr>";
                            log_debug_msg("admin/controllers/users.php/renew(): " . htmlspecialchars($validity) . " months successfully added to user " . htmlspecialchars($account));
                        } else {
                            $data[$account] = "<div><p><h5 style='color:red'>Error:</h5> There was an error while trying to add " . htmlspecialchars($validity) . " months to user <h5 style='color:red'>" . htmlspecialchars($account) . "</h5>.</p></div>";
                            log_debug_msg("admin/controllers/users.php/renew(): there was an error while trying to add " . htmlspecialchars($validity) . " months to user " . htmlspecialchars($account));
                        }
                    }
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
            if ($this->users_model->renew($username, $credits) === true) {
                log_debug_msg("admin/controllers/users.php/renew(): $credits months successfully added to user $username");
                $this->msg('Renewal successfully!');
            } else {
                log_debug_msg("admin/controllers/users.php/renew(): there was an error while trying to add $credits months to user $username");
                $this->msg('Error Occured, Please try again later', 'danger');
            }
        } else {
            $validity_error = form_error('validity');

            $this->msg($validity_error, 'danger');
        }
        
        redirect('admin/users'.(!empty($query) ? '?query=' . $query : ''), 'refresh');
    }

    public function preCheckRenewal() {
        if (isset($_GET["account"])) {
            $username = $_GET['account'];
            $credits  = $_GET['credits'];

            $users = $this->users_model->get_user($username);
            if (empty($username) || $users->num_rows() == 0) {
                echo json_encode([
                    'error' => true,
                    'message' => 'User not found'
                ]);
                exit();
            }

            $balance = $this->users_model->get_balance($username);

            if ($balance < $credits) {
                echo json_encode([
                    'error' => true,
                    'message' => "Cannot recover $credits credits from user (recover max = $balance)"
                ]);
                exit();
            }

            $user = $users->row();

            // Calculate recover date
            $calculate = $this->users_model->calculate_recover_date($username, $credits, $user->expires, false);

            $configBonusCredit = $this->configs_model->find(Configs_model::KEY_RECOVER_BONUS_CREDIT);
            $isRecoverBonusCredit = $configBonusCredit->value ?? 0;

            if (!$isRecoverBonusCredit && $calculate['free_month'] > 0) {
                echo json_encode([
                    'error' => true,
                    'message' => 'You can not recover the credit'
                ]);
                exit();
            }
            
            echo json_encode([
                'error' => false,
                'message' => generateMessageRenewal($username, $calculate['free_month'], $credits, $calculate['expired_date'])
            ]);
            exit();
        }
    }
}
/* End of file Users.php */
/* Location: ./application/modules/admin/controllers/Users.php */
