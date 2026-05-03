<?php
defined('BASEPATH') or exit('No direct script access allowed');
class Manager_model extends CI_Model {

    public function __construct() {
        parent::__construct();
    }

    // public function get_all_users($username, $query = null) {
    //     //get all resellers under his account
    //     $resellers    = array();
    //     $reseller_sql = $this->db->where(array('type' => 'SRSLR', 'username_owner' => $username))->get('users');
    //     if ($reseller_sql->num_rows() > 0) {
    //         foreach ($reseller_sql->result() as $reseller) {
    //             $resellers[] = $reseller->username;
    //         }
    //     }
    //     //get all dealers under his reseller's accounts
    //     if (!empty($resellers)) {
    //         $dealer_sql = $this->db->where_in('username_owner', $resellers)->get('users');

    //         if ($dealer_sql->num_rows() > 0) {
    //             foreach ($dealer_sql->result() as $dealers) {
    //                 $resellers[] = $dealers->username;
    //             }
    //         }
    //     }
     
    //     //get all users under the manager
    //     if (!empty($query)) {
    //         $ids = join("','", $resellers);
	// 		//$sql = $this->db->query("select * from accounts where username IN('" . $ids . "') and (account LIKE '%" . $this->db->escape_like_str($query) . "%' or mac LIKE '%" . $this->db->escape_like_str($query) . "%' or ip LIKE '%" . $this->db->escape_like_str($query) . "%' or full_name LIKE '%" . $this->db->escape_like_str($query) . "%' or phone LIKE '%" . $this->db->escape_like_str($query) . "%')");
	// 		$sql = $this->db->query("(select * from accounts where username IN('" . $ids . "') and (account LIKE '%" . $this->db->escape_like_str($query) . "%' or mac LIKE '%" . $this->db->escape_like_str($query) . "%' or ip LIKE '%" . $this->db->escape_like_str($query) . "%' or full_name LIKE '%" . $this->db->escape_like_str($query) . "%' or phone LIKE '%" . $this->db->escape_like_str($query) . "%' or note LIKE '%" . $this->db->escape_like_str($query) . "%')) UNION (select * from accounts where status='" . ACCOUNT_STATUS_OFF . "' and (account LIKE '%" . $this->db->escape_like_str($query) . "%' or mac LIKE '%" . $this->db->escape_like_str($query) . "%' or ip LIKE '%" . $this->db->escape_like_str($query) . "%' or full_name LIKE '%" . $this->db->escape_like_str($query) . "%' or phone LIKE '%" . $this->db->escape_like_str($query) . "%'))");
    //     } else {
    //         if (!empty($resellers)) {
    //             $this->db->where_in('username', $resellers);
    //             $sql = $this->db->get('accounts');
    //         } else {
    //             $sql = null;
    //         }
    //     }

	// 	// $sql = $this->db->get('accounts');
	// 	// echo $this->db->last_query(); exit;
	// 	return $sql;
	// }
    public function get_all_users($username) {
        // Step 1: Collect usernames (resellers and their dealers)
        $usernames = $this->get_reseller_and_dealer_usernames($username);
    
        if (empty($usernames)) {
            return null;
        }
        return $usernames;
        // Step 2: Search or get all accounts under these usernames
        // return $this->fetch_accounts_by_usernames($usernames, $query,$start,  $length);
    }
    
    // private function get_reseller_and_dealer_usernames($manager_username) {
    //     // Fetch both resellers and dealers in one go using a subquery
    //     $this->db->select('username');
    //     $this->db->from('users');
    //     $this->db->where('type', 'SRSLR');
    //     $this->db->where('username_owner', $manager_username);
    //     $reseller_query = $this->db->get();
    
    //     $reseller_usernames = array_column($reseller_query->result_array(), 'username');
    //     if (empty($reseller_usernames)) {
    //         return [];
    //     }
    
    //     // Now get dealers whose owners are these resellers
    //     $this->db->select('username');
    //     $this->db->from('users');
    //     $this->db->where_in('username_owner', $reseller_usernames);
    //     $dealer_query = $this->db->get();
    
    //     $dealer_usernames = array_column($dealer_query->result_array(), 'username');
    
    //     return array_merge($reseller_usernames, $dealer_usernames);
    // }

    private function get_reseller_and_dealer_usernames($manager_username) {
        $usernames = [];
        $queue = [$manager_username];

        while (!empty($queue)) {
            $current = array_shift($queue);

            $this->db->select('username');
            $this->db->from('users');
            $this->db->where('username_owner', $current);
            $this->db->or_where('username', $current);
            $query = $this->db->get();

            $children = array_column($query->result_array(), 'username');

            foreach ($children as $child) {
                if (!in_array($child, $usernames)) {
                    $usernames[] = $child;
                    $queue[] = $child; // continue exploring deeper
                }
            }
        }

        return $usernames;
    }
    
    
    private function fetch_accounts_by_usernames($usernames, $query = null, $start, $length) {
        if ($query) {
            $escaped_query = $this->db->escape_like_str($query);
    
            $like_conditions = "(account LIKE ? ESCAPE '!' OR mac LIKE ? ESCAPE '!' OR full_name LIKE ? ESCAPE '!')";
            $off_conditions = "(account LIKE ? ESCAPE '!' OR mac LIKE ? ESCAPE '!' OR full_name LIKE ? ESCAPE '!')";
    
            $placeholders = implode(',', array_fill(0, count($usernames), '?'));
    
            $sql = "
                (SELECT username, account, password, full_name, mac, expires, status 
                 FROM accounts 
                 WHERE username IN ($placeholders) AND $like_conditions)
                UNION
                (SELECT username, account, password, full_name, mac, expires, status  
                 FROM accounts 
                 WHERE status = ? AND $off_conditions)
            ";
    
            // Parameters for the first SELECT
            $params = array_merge(
                $usernames,
                array_fill(0, 3, "%$escaped_query%")
            );
    
            // Parameters for the second SELECT
            $params[] = ACCOUNT_STATUS_OFF;
            $params = array_merge(
                $params,
                array_fill(0, 3, "%$escaped_query%")
            );
    
            $this->db->limit($length, $start);
            return $this->db->query($sql, $params);
        } else {
            $this->db->select('username, account, password, full_name, mac, expires, status');
            $this->db->limit($length, $start);
            return $this->db->where_in('username', $usernames)->get('accounts');
        }
    }
    
    
	public function get_all_users_expired($username, $query = NULL)	{

		//get all resellers under his account
		$resellers    = array();
		$reseller_sql = $this->db->where(array('type' => 'SRSLR', 'username_owner' => $username))->get('users');
		if ($reseller_sql->num_rows() > 0) {
			foreach ($reseller_sql->result() as $reseller) {
				$resellers[] = $reseller->username;
			}
		}

        if (!empty($resellers)) {
            //get all dealers under his reseller's accounts
		    $dealer_sql = $this->db->where_in('username_owner', $resellers)->get('users');
		    if ($dealer_sql->num_rows() > 0) {
		    	foreach ($dealer_sql->result() as $dealers) {
		    		$resellers[] = $dealers->username;
		    	}
		    }
        }
		
        if (!empty($resellers)) {
            //get all users under the manager
		    $this->db->where('expires <', "NOW()", false);
            $this->db->where_in('username', $resellers);
            $sql = $this->db->get('accounts');
        } else {
            $sql = null;
        }

		// $sql = $this->db->get('accounts');
		// echo $this->db->last_query(); exit;
		return $sql;

	}

    public function count_resellers($username) {
        $this->db->where('username_owner', $username);
        $count = $this->db->count_all_results('users');
        return $count;
    }

    public function get_all_dealers($username) {
        //get all resellers under his account
        $resellers    = array();
        $reseller_sql = $this->db->where(array('type' => 'SRSLR', 'username_owner' => $username))->get('users');
        if ($reseller_sql->num_rows() > 0) {
            foreach ($reseller_sql->result() as $reseller) {
                $resellers[] = $reseller->username;
            }
        }
        if (!empty($resellers)) { 
            //get all dealers under his reseller's accounts
            $dealer_sql = $this->db->where_in('username_owner', $resellers)->get('users');
        }else{
            $dealer_sql = null;
        }
        //get all users under the manager
        $sql = $dealer_sql;
        return $sql;
    }

    public function get_all() {
        $sql = $this->db->where('type', "MNGR")->get('users');
        return $sql;
    }

    public function get_manager_name($username) {
        //check if user exists on db
        $sql = $this->db->where('account', $username)->get('accounts');
        if ($sql->num_rows() > 0) {
            $user = $sql->row();
            //get dealer or reseller
            $onwer_sql = $this->db->where('username', $user->username)->get('users');
            $owner     = $onwer_sql->row();
            if ($owner->type == "SRSLR") {
                $manager = $this->db->where('username', $owner->username_owner)->get('users')->row();
            } else if ($owner->type == "RSLR") {
                $dealer = $this->db->where('username', $owner->username_owner)->get('users')->row();
                // $reseller = $this->db->where('username', $dealer->username_owner)->get('users')->row();
                $manager = $this->db->where('username', $dealer->username_owner)->get('users')->row();
            }
            $name = $manager->username;
            return $name;
        }
    }

    public function is_myuser($username, $manager_login) {
        $sql = $this->db->where('account', $username)->get('accounts');
        if ($sql->num_rows() > 0) {
            $user = $sql->row();
            //get dealer or reseller
            $onwer_sql = $this->db->where('username', $user->username)->get('users');
            $owner     = $onwer_sql->row();
            if ($onwer_sql->num_rows() == 0) {return false;exit;}
            if ($owner->type == "SRSLR") {
                $manager = $this->db->where('username', $owner->username_owner)->get('users')->row();
            } else if ($owner->type == "RSLR") {
                $reseller = $this->db->where('username', $owner->username_owner)->get('users')->row();
                if (empty($reseller->username_owner)) {
                    $manager = $reseller;
                } else {
                    $manager = $this->db->where('username', $reseller->username_owner)->get('users')->row();

                }
                // $manager = $this->db->where('username', $owner->username_owner)->get('users')->row();
            }
            // print_r($reseller); exit;
            if ($manager->username == $manager_login) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    public function is_mydealer($username, $manager_login) {
        $sql = $this->db->where('username', $username)->get('users');
        if ($sql->num_rows() > 0) {
            $user     = $sql->row();
            $reseller = $this->db->where('username', $user->username_owner)->get('users')->row();
            // $manager  = $this->db->where('username', $reseller->username_owner)->get('users')->row();
            if ($reseller->username_owner == $manager_login) {
                return true;
            } else {
                return false;
            }

        } else {
            return false;
        }
    }

}
/* End of file Manager_model.php */
/* Location: ./application/modules/admin/models/Manager_model.php */
