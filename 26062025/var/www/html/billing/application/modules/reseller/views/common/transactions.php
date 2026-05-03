<!-- Page header -->
  <div class="page-header">
    <div class="page-header-content">
      <div class="page-title">
      
      </div>

      <div class="heading-elements">
        <div class="heading-btn-group">
          <a href="<?= site_url('reseller/dashboard'); ?>" class="btn btn-danger btn-sm"> <i class=" icon-circle-left2"></i> BACK </a>
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

            <!-- Basic responsive configuration -->
        <div class="panel panel-flat">
          <div class="panel-heading">
            <h5 class="panel-title"><?= $title; ?></h5>
            <div class="heading-elements">
             <div class="actiontools"></div>
                    </div>
          </div>

          
           <table class="table table-bordered table-striped datatable-responsive">
            <thead>
              <tr>
                <th width="100">
                  Transaction
                </th>
                <th> Type </th>
                    <th> Credits </th>
                <th> Months </th>
                <th> Sub-account </th>
                <th> Coverage Start </th>
                <th> Coverage End </th>
                <th> Remarks </th>
                <th> Date / Time </th>
              </tr>
            </thead>
            <tbody>
              <?php $total_credits = 0;?>
              <?php  foreach ($sql->result() as $row) :?>
              <?php $total_credits +=$row->periods; ?>
              <tr class="odd gradeX">
                <td><?= (str_pad($row->transaction, 8, "0", STR_PAD_LEFT));?></td>
                <td>
                  <?php if ($row->type == 'CRDT'): ?>
                    <?php if (!empty($row->account)): ?>
                        <span class="label label-sm label-danger block">RECOVERED</span>
                    <?php else: ?>
                        <span class="label label-sm label-success green block">PURCHASED</span>
                    <?php endif; ?>
                  <?php elseif ($row->type=='BONUS'): ?>
                      <span class="label label-sm label-primary block">BONUS</span>
                  <?php else: ?>
                    <?php if (empty($row->account)): ?>
                        <span class="label label-sm label-danger block">REVERSED</span>
                    <?php else: ?>
                        <?php if (empty($this->users_model->get_reseller($row->account))): ?>
                          <span class="label label-sm label-success green block">USED</span>
                        <?php else: ?>
                          <span class="label label-sm label-success green block">TRANSFERRED</span>
                        <?php endif; ?>
                    <?php endif; ?>
                  <?php endif; ?>
                </td>
                <td><?= $row->periods;?></td>
								<td>
                  <?php if (($row->type == 'CRDT' && !empty($row->account)) || ($row->type=='DBIT' && !empty($row->account))): ?>
                    -
                  <?php else: ?>
                    <?= ($row->type == 'DBIT' ? $row->periods : $row->free_month);?>
                  <?php endif; ?>
                </td>
                <td><?= (empty($row->account)) ? '-':$row->account;?></td>
                <td><?= (empty($row->coverage_start)) ? '-':$row->coverage_start;?></td>
                <td><?= (empty($row->coverage_end)) ? '-':$row->coverage_end;?></td>
                <td>
                  <?= (empty($row->remarks)) ? '-':$row->remarks;?> 
                  <?= !empty($row->created_by) && !stripos($row->remarks, $row->created_by) ? 'by '.$row->created_by: ''; ?>
                </td>
                <td><?=  $row->timestamp; ?></td>
              </tr>
              <?php endforeach;?>
            </tbody>
            <tfoot>
            <th><?php echo $sql->num_rows(); ?></th>
            <th>-</th>
            <th>Total <br> <?php echo $total_credits; ?></th>
            <th>-</th>
            <th>-</th>
              <th>-</th>
               <th>-</th>
            <th>-</th>
            <th>-</th>
            </tfoot>
          </table>
        </div>
        <!-- /basic responsive configuration -->

      </div>
      <!-- /main content -->

    </div>
    <!-- /page content -->

  </div>
  <!-- /page container -->