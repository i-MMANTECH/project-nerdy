<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Settings extends AdminController
{
    protected $module_name = 'Settings';
    
    public function __construct()
    {
        parent::__construct();
    }

    public function index()
    {
        $this->data['title']    = $this->module_name;
        $this->data['module']   = $this->module_name;
        $setting                = $this->db->order_by('id', 'desc')->get('settings')->row();
        $this->data['settings'] = $setting;
        // Config pin default, limit reseller credit, limit dealer credit
        $configs = $this->configs_model->findMultiple([
            Configs_model::KEY_PIN_DEFAULT, 
            Configs_model::KEY_LIMIT_RESELLER_CREDIT, 
            Configs_model::KEY_LIMIT_DEALER_CREDIT,
            Configs_model::KEY_RETRY_TRIAL,
            Configs_model::KEY_NUMBER_RETRY_TRIAL,
        ]);
        $this->data['configs'] = $configs;

        if (count($configs) > 0) {
            foreach ($configs as $config) {
                switch ($config->key) {
                    case Configs_model::KEY_LIMIT_RESELLER_CREDIT:
                        $this->form_validation->set_rules($config->key, 'Limit reseller credit', 'trim|required|numeric|greater_than[0]|less_than_equal_to[2000]');
                        break;
                    case Configs_model::KEY_LIMIT_DEALER_CREDIT:
                        $this->form_validation->set_rules($config->key, 'Limit dealer credit', 'trim|required|numeric|greater_than[0]|less_than_equal_to[2000]');
                        break;
                    case Configs_model::KEY_PIN_DEFAULT:
                        $this->form_validation->set_rules($config->key, "Default User's PIN", 'trim|required|exact_length[4]|is_numeric');
                        break;
                    case Configs_model::KEY_NUMBER_RETRY_TRIAL:
                        $this->form_validation->set_rules($config->key, 'Number retry trial', 'trim|required|numeric');
                        break;
                }
            }
        }

        $this->form_validation->set_rules('title', 'App Title', 'trim|required|min_length[3]|max_length[50]');

        if ($this->form_validation->run() === true) {
            $options = array(
                'title'      => $this->input->post('title'),
                'email'      => $this->input->post('email'),
                'global_msg' => $this->input->post('global_msg'),
            );
            $this->db->where('id', $setting->id);
            $this->db->update('settings', $options);

            // Update Configs
            if (count($configs) > 0) {
                foreach ($configs as $config) {
                    $value = $this->input->post($config->key);

                    if ($config->key == Configs_model::KEY_RETRY_TRIAL) {
                        $value = $value ?? 0;
                    }

                    $this->configs_model->update([
                        'value' => $value,
                        'updated_at' => date('Y-m-d H:i:s')
                    ], $config->key);
                }
            }

            $this->msg('Setting was saved successfully!');
            redirect('admin/settings', 'refresh');
        } else {
            $this->render('accounts/settings');
        }
    }
}
/* End of file Settings.php */
/* Location: ./application/modules/admin/controllers/Settings.php */
