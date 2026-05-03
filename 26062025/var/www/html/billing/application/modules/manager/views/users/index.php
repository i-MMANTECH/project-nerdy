<div class="page-header">
  <div class="page-header-content">
    <div class="page-title"></div>
    <div class="heading-elements">
      <div class="heading-btn-group">
        <a href="<?=site_url('manager/resellers/index');?>" class="btn btn-danger btn-sm">
          <i class="icon-circle-left2"></i> BACK
        </a>
      </div>
    </div>
  </div>
</div>

<div class="page-container">
  <div class="page-content">
    <div class="content-wrapper">
      <div class="row">
        <div class="col-md-12">
          <div class="panel panel-flat">
            <div class="panel-heading">
              <h5 class="panel-title"><?=$title;?></h5>
            </div>
            <div class="panel-body">
              <?=validation_errors('<div class="alert alert-danger">', '</div>');?>
              <div class="form-group row">
                <label class="control-label col-md-2">Enter Query</label>
                <div class="col-md-4">
                  <input type="text" name="query" class="form-control" id="searchvalue" value="<?php echo set_value('query'); ?>">
                </div>
                <div class="col-md-2">
                  <a href="javascript:void(0)" onclick="searchdata()" class="btn btn-sm btn-success">
                    <i class="icon-search4"></i> Search
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row" id="userdata">
        <div class="col-md-12">
          <div class="panel panel-flat">
            <div class="panel-heading">
              <h5 class="panel-title"><?=$title;?></h5>
              <div class="heading-elements">
                <div style="display: none;" class="actiontools">
                  <?php $q = $this->input->get('status'); ?>
                  <a href="<?= site_url('manager/users/index'); ?>" class="btn btn-default btn-sm text-primary <?php if(empty($q)) echo 'active'; ?>">ALL (<?= $total_users; ?>)</a>
                  <a href="<?= site_url('manager/users/index?status=active'); ?>" class="btn btn-default btn-sm text-success <?php if($q=='active') echo 'active'; ?>">ACTIVE (<?= $active_users; ?>)</a>
                  <a href="<?= site_url('manager/users/index?status=expired'); ?>" class="btn btn-default btn-sm text-danger <?php if($q=='expired') echo 'active'; ?>">EXPIRED (<?= $expired_users; ?>)</a>
                  <span class="btn" style="cursor:auto">Bulk:</span>
                  <a href="javascript:void(0)" onclick="showReNewModal()" class="btn btn-default btn-sm text-info">Renew Selected (<span class="selected-count">0</span>)</a>
                </div>
              </div>
            </div>
            <table class="table table-striped table-bordered" id="manager_table" data-url="<?= site_url('manager/users/data_list'); ?>">
              <thead>
                <tr>
                  <th><input type="checkbox" id="select-all"></th>
                  <th>Login ID</th>
                  <th class="text-center">MAC</th>
                  <th>Name</th>
                  <th>Password</th>
                  <th width="100">Reseller</th>
                  <th>Dealer</th>
                  <th class="text-center">Status</th>
                  <th class="text-center"> Created Date </th>
                  <th class="text-center">Receiver</th>
                  <th class="text-center">Expiry</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
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
          form.submit();
        }
      }
    });
  }

  function reset(element, account) {
    if (confirm(`Do you really want to reset this device MAC data?`)) {
      window.location.replace("<?= site_url('manager/users/reset/') ?>" + account);
    }
  }

  function searchdata() {
    $('#manager_table').DataTable().search($("#searchvalue").val()).draw();
  }

  function renewselected() {
    var table = $('#manager_table').DataTable();
    var checkedRows = table.rows().nodes().to$().find('input.row-select:checked');
    var validity = $('select[name="validity"]').val();
    var checkedData = [];
    checkedRows.each(function () {
      checkedData.push($(this).val());
    });
    $.ajax({
      url: '<?= site_url("/manager/users/renew_one_month_bulk"); ?>',
      method: 'POST',
      data: { checkedData: checkedData, validity: validity,[csrfName]: csrfHash}, 
      success: function (response) {
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
                window.location.href = '<?= site_url("/manager/users"); ?>';
            }
        });
      },
      error: function (err) {
        console.error(err);
      }
    });
  }

  $(document).ready(() => {
    var table = $('#manager_table').DataTable();

    $('#select-all').on('change', function () {
      $('.row-select').prop('checked', this.checked);
      updateSelectedCount();
    });

    $('#manager_table tbody').on('change', 'input.row-select', function () {
      updateSelectedCount();
    });

    function updateSelectedCount() {
      var selectedCount = $('input.row-select:checked', table.rows().nodes()).length;
      $('.selected-count').text(selectedCount);
    }

    $('#renewbulk').dialog({
        autoOpen: false,
        modal: true,
        width: 600, 
        open: function(event, ui) {
          $(".ui-dialog-titlebar-close", ui.dialog | ui).hide(); // hide the X button
        },
        // buttons: {
        //   "RENEW": function() {
        //     // Do your logic here
        //     $(this).dialog("close");
        //   },
        //   "CANCEL": function() {
        //     $(this).dialog("close");
        //   }
        // }
      });
    });
  function closeModal() {
    $('#renewbulk').dialog('close');
  }

  function showReNewModal() {
    var table = $('#manager_table').DataTable();
    var checkedRows = table.rows().nodes().to$().find('input.row-select:checked');
    if (checkedRows.length == 0) {
      alert("Select accounts for renew!");
      return;
    }
    $('#renewbulk').dialog('open');
    
  }

  function comfrimRenew() {
    $('#renewbulk').dialog('close');
    var validity = $('select[name="validity"]').val();
    Swal.fire({
      title: `Please confirm renew of selected accounts for ${validity} month(s)?`,
      showCancelButton: true,
      confirmButtonText: "OK",
    }).then((result) => {
      if (result.isConfirmed) {
        renewselected();
      }
    });
  }

  const creditInput = document.querySelector('input[name="credits"]');
  const typeRadios = document.querySelectorAll('input[name="type"]');

  typeRadios.forEach(radio => {
      radio.addEventListener('change', function () {
          if (this.value === 'CRDT') {
              creditInput.min = 2000;
          } else if (this.value === 'DBIT') {
              creditInput.min = 1;
          }
          
          if (parseInt(creditInput.value) < creditInput.min) {
              creditInput.value = creditInput.min;
          }
      });
  });
</script>