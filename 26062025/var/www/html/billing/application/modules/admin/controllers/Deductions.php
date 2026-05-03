<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Deductions extends AdminController
{
    protected $module_name = 'credit deductions';

    const KEY_FREE_MONTH = '1_month_free';

    public function __construct()
    {
        parent::__construct();
        $this->load->model('deduction_model');
    }

    public function index()
    {
        $this->data['title'] = 'Manage ' . $this->module_name;

        // Get all data credit deduction
        $deductions = $this->deduction_model->get_all();
        $this->data['deductions'] = $deductions;
        // Find config 1_free_month
        $config = $this->configs_model->find(self::KEY_FREE_MONTH);
        $this->data['one_month_free_value'] = $config->value ?? 0;
        // Find config is_recover_bonus_credit
        $configBonusCredit = $this->configs_model->find(Configs_model::KEY_RECOVER_BONUS_CREDIT);
        $this->data['is_recover_bonus_credit'] = $configBonusCredit->value ?? 0;

        $arrayMonth = [];

        if (count($deductions) > 0) {
            foreach ($deductions as $value) {
                $this->form_validation->set_rules("month_{$value->id}", 'month', 'required');
                $this->form_validation->set_rules("month_deduction_{$value->id}", 'credit deduction', 'required|integer');

                // Validate unique month
                if (isset($arrayMonth[$this->input->post("month_{$value->id}")])) {
                    $this->msg('Updated credit deductions failed due to overlapping months!', 'danger');
                    redirect('admin/deductions/index', 'refresh');
                }

                $arrayMonth[$this->input->post("month_{$value->id}")] = $this->input->post("month_{$value->id}");
            }
        }

        if ($this->form_validation->run() == true) {
            // Remmove all deduction
            $this->deduction_model->delete_all();

            foreach ($deductions as $value) {
                // Insert deduction
                $this->deduction_model->create([
                    'month' => $this->input->post("month_{$value->id}"),
                    'month_deduction' => $this->input->post("month_deduction_{$value->id}"),
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
            }

            if (!is_null($config)) {
                // Update config 1_free_month
                $one_month_free_value = $this->input->post('one_month_free') ?? 0;
                $this->configs_model->update([
                    'value' => $one_month_free_value,
                    'updated_at' => date('Y-m-d H:i:s')
                ], self::KEY_FREE_MONTH);
                // Update config is_recover_bonus_credit
                $isRecoverBonusCredit = $this->input->post('is_recover_bonus_credit') ?? 0;
                $this->configs_model->update([
                    'value' => $isRecoverBonusCredit,
                    'updated_at' => date('Y-m-d H:i:s')
                ], Configs_model::KEY_RECOVER_BONUS_CREDIT);
            }

            $this->msg('Credit deductions was updated successfully!');
            redirect('admin/deductions/index', 'refresh');
        } else {
            $this->render('deductions/index');
        }
    }
}
