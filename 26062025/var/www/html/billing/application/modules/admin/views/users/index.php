<!-- Page header -->
  <div class="page-header">
    <div class="page-header-content">
      <div class="page-title">
       

         <a href="<?= site_url('admin/users/add');?>" class="btn btn-primary btn-sm"> <i class="icon-add"></i> ADD NEW </a>
      </div>

      <div class="heading-elements">
        <div class="heading-btn-group">
          <a href="<?= site_url('admin/dashboard'); ?>" class="btn btn-danger btn-sm"> <i class=" icon-circle-left2"></i> BACK </a>
        </div>
      </div>
    </div>
  </div>
  <!-- /page header -->


  <!-- Page container -->
  <div class="page-container">

    <!-- Page content -->
    <div class="page-content">

      <!-- Main content -->
      <div class="content-wrapper">
<div class="row">
        <div class="col-md-12">
          <div class="panel panel-flat">
            <div class="panel-heading">
              <h5 class="panel-title"><?=$title;?></h5>
              <div class="heading-elements">
             
              </div>
            </div>
            <!-- Panel Body -->
            <div class="panel-body">
              <?=validation_errors('<div class="alert alert-danger">', '</div>');?>
              <div class="form-group">
                <label class="control-label col-md-5">Enter Query</label>
                <div class="col-md-3">
                  <input type="text" name="query" class="form-control" id="searchvalue" value="<?php echo set_value('query'); ?>">
                </div>
              </div>
              <div class="form-group">
                <div class="col-md-3 col-md-offset-5">
                  <!-- <button class="btn btn-sm btn-success" type="submit"><i class=" icon-search4"></i> Search</button> -->
                  <a href="javascript:void(0)" onclick="searchdata()" class="btn btn-sm btn-success" style="    margin-top: 20px;"><i class=" icon-search4"></i> Search</a>' .
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-md-12">
          <!-- BEGIN EXAMPLE TABLE PORTLET-->
            <!-- Basic responsive configuration -->
        <div class="panel panel-flat">
          <div class="panel-heading">
            <h5 class="panel-title"><?= $title; ?></h5>
            <div class="heading-elements">
            <div style="display: none;" class="actiontools">
                  <?php $q = $this->input->get('status');?>
                  <a href="<?=site_url('admin/users/index');?>" class="btn <?php if (empty($q)) {?>active <?php }?> btn-default btn-sm"> <span class="text-primary">ALL (<?=$total_users;?>)</span> </a>
                  <a href="<?=site_url('admin/users/index?status=active');?>" class="btn btn-default <?php if (!empty($q) && $q == 'active') {?>active <?php }?>  btn-sm"><span class="text-success"> ACTIVE (<?=$active_users;?>) </span> </a>
                  <a href="<?=site_url('admin/users/index?status=expired');?>" class="btn btn-default <?php if (!empty($q) && $q == 'expired') {?>active <?php }?> btn-sm"> <span class="text-danger"> EXPIRED (<?=$expired_users;?>) </span> </a>
                  <a href="javascript:void(0)" onclick="showReNewModal()" class="btn btn-default text-info btn-sm">Renew Selected (<span class="selected-count">0</span>)</a>
                </div>
              </div>
          </div>

           <table class="table table-bordered table-striped" id="admin_user_table"  data-url="<?= site_url('admin/users/data_list'); ?>">
            <thead>
              <tr>
                <th><input type="checkbox" id="select-all"></th>
                <th> Manager </th>
                <th> Reseller </th>
                <th> Dealer </th>
                <th> Login ID </th>
                <th> Name </th>
                <th> Password </th>
                <th class="text-center"> MAC </th>
                <th class="text-center"> Status </th>
                <th class="text-center"> Expiry </th>
                <th class="text-center"> Actions </th>
              </tr>
            </thead>
            <tbody>
            
            </tbody>
          </table>
          </div>
        <!-- /basic responsive configuration -->
        </div>
      </div>
      </div>
      <!-- /main content -->

    </div>
    <!-- /page content -->

  </div>
  <div id="renewbulk" title="Bulk Renew" style="display: none;">
  <?php $type = "RENEW" ?>
  <div class="panel-body" style="min-width:500px">
        <?= form_open('dealer/users/renew/',array('class'=>'form-horizontal'));?>       
        <div class="form-group <?php if(form_error('credits')): echo 'has-error'; endif;?> form-credit" style="display:<?php echo $type != "RENEW" && !is_null($type) ? 'block': 'none';?>">
            <label class="control-label col-md-5">Select Credits</label>
            <div class="col-md-3 ">
                <select class="form-control" name="credits">
                    <?php 
                        for ($i=1; $i <=2000; $i++) {
                            echo '<option value="'.$i.'">'.$i.'</option>';
                        } 
                    ?>
                </select>
                <?php echo form_error('credits', '<span class="help-block">', '</span>'); ?>
            </div>
        </div>
        <div class="form-group <?php if(form_error('validity')): echo 'has-error'; endif; ?> form-validity" style="display:<?php echo $type == "RENEW" || is_null($type) ? 'block': 'none';?>;">
            <label class="col-md-5 control-label">Validity</label>
            <div class="col-md-5">
              <select name="validity" class="form-control">
                <option value="FREE_TRIAL" >2 Days Trial</option>

                <?php for ($i = 1; $i <= 24; $i++) {?>
                  <option value="<?php echo $i;?>" <?php if($i==1): echo 'selected="selected"'; endif;?> >
                    <?php echo $i;?> Months
                
                    <?php if (isset($deduction[$i]) && $deduction[$i] > 0):?>
                      (<?php echo $deduction[$i] > 1 ? $deduction[$i] . ' credits used,': $i - $deduction[$i] . ' credit used,';?>
                      <?php echo $i - $deduction[$i] > 1 ? $i - $deduction[$i] . ' months': $i - $deduction[$i] . ' month';?> bonus credit)
                    <?php endif;?>
                  </option>
                <?php }?>
                    
              </select>
              <?php echo form_error('validity','<span class="help-block">','</span>');?>
            </div>
        </div>
       
        <div class="form-group" style=" justify-content: center;display: flex; text-align: center;">
            <div class="col-md-6 ">
                <button class="btn btn-sm btn-success btn-transaction" type="submit" style="display:none;"><i class="icon-floppy-disk"></i> Submit </button>
                <a class="btn btn-sm btn-success btn-pre-transaction" href="javascript:void(0)" onclick="comfrimRenew()"><i class="icon-floppy-disk"></i> Submit</a>
                <a class="btn btn-sm btn-danger" href="javascript:void(0)" onclick="closeModal()" ><i class="icon-blocked"></i> Cancel </a>
            </div>
        </div>
        <?= form_close();?>
    </div>
</div>
  <!-- /page container -->
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <script>
      var csrfName = '<?= $this->security->get_csrf_token_name(); ?>';
     var csrfHash = '<?= $this->security->get_csrf_hash(); ?>';
    function add1Month(element, account) {
      Swal.fire({
        title: `Please confirm renew of account ${account} for a month?`,
        showCancelButton: true,
        confirmButtonText: "OK",
      }).then((result) => {
        if (result.isConfirmed) {
          let form = element.closest('a').nextElementSibling;
          if (form && form.tagName.toLowerCase() === 'form') {
            form.submit(); // Submit form
          }
        }
      });
    }
    function reset(element, account) {
      if (confirm(`Do you really want to reset this device MAC data?`)) {
          window.location.replace("<?= site_url('admin/users/reset/') ?>"+ account);
      } 
    }
    function searchdata(){
      $('#admin_user_table').DataTable().search($("#searchvalue").val()).draw();
    }
    function renewselected() {
        var table = $('#admin_user_table').DataTable();
        var checkedRows = table.rows().nodes().to$().find('input.row-select:checked');
        var validity = $('select[name="validity"]').val();
        var checkedData = [];
       
        checkedRows.each(function () {
          checkedData.push($(this).val());        
        });
        $.ajax({
          url: '<?= site_url("admin/users/renew_one_month_bulk"); ?>',
          method: 'GET',
          data: { checkedData: checkedData, validity: validity },
          success: function(response) {
              const data = JSON.parse(response);
              let content = ""; // Start with a heading or introductory text
              if (data && data.data && typeof data.data === 'object') {
                  for (const [key, value] of Object.entries(data.data)) {
                      content += value; // Example formatting
                  }
              } else {
                  content += "<p>No data to display.</p>"; // Handle cases where data.data is not an object or is empty
              }
              Swal.fire({
                  title: `Update Results`,
                  html: content, // Use html property to display the formatted content
                  // showCancelButton: true, // Uncomment if you want a cancel button
                  width: 600,
                  confirmButtonText: "OK",
              }).then((result) => {
                  if (result.isConfirmed) {
                      window.location.href = '<?= site_url("admin/users"); ?>';
                  }
              });
          },
          error: function(err) {
              console.error(err);
              // Optionally show an error message to the user
              Swal.fire({
                  title: 'Error',
                  text: 'An error occurred while processing your request.',
                  icon: 'error',
                  confirmButtonText: 'OK'
              });
          }
    });
        
    }
    $(document).ready(()=>{
      var table = $('#admin_user_table').DataTable();
      // Optional: Check all toggle
      $('#select-all').on('change', function () {
        $('.row-select').prop('checked', this.checked); 
        updateSelectedCount();
      });
      $('#admin_user_table tbody').on('change', 'input.row-select', function () {
        updateSelectedCount();
      });
      function updateSelectedCount() {
        var selectedCount = $('input.row-select:checked', table.rows().nodes()).length;
        $('.selected-count').text(selectedCount)
      }
      $('#renewbulk').dialog({
        autoOpen: false,
        modal: true,
        width: 600, 
        open: function(event, ui) {
          $(".ui-dialog-titlebar-close", ui.dialog | ui).hide(); // hide the X button
        },
      });
    });
    function closeModal(){
      $('#renewbulk').dialog('close');
    }
    function showReNewModal(){
      var table = $('#admin_user_table').DataTable();
      var checkedRows = table.rows().nodes().to$().find('input.row-select:checked');
      if(checkedRows.length==0){
        alert("Select accounts for renew!");
        return;
      }
      $('#renewbulk').dialog('open');
    }
    function comfrimRenew(element){
      $('#renewbulk').dialog('close');
      var validity = $('select[name="validity"]').val();
      Swal.fire({
        title: `Please confirm renew of selected accounts for ${validity} month?`,
        showCancelButton: true,
        confirmButtonText: "OK",
      }).then((result) => {
        if (result.isConfirmed) {
          renewselected()
        }
      });
    }
  </script>