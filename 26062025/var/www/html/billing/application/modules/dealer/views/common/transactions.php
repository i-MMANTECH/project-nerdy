<!-- Page header -->
  <div class="page-header">
    <div class="page-header-content">
      <div class="page-title">
      
      </div>

      <div class="heading-elements">
        <div class="heading-btn-group">
          <a href="<?= site_url('dealer/dashboard'); ?>" class="btn btn-danger btn-sm"> <i class=" icon-circle-left2"></i> BACK </a>
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
                <th>Remarks</th>
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
				  <?php if ($row->type=='CRDT' && empty($row->account)): ?>
					<span class="label label-sm label-success green block">PURCHASED</span>
				  <?php elseif ($row->type=='DBIT' && empty($row->account)): ?>
					  <span class="label label-sm label-success green block">REVERSED</span>
                  <?php elseif ($row->type=='CRDT'): ?>
                      <span class="label label-sm label-success green block">PURCHASED</span>
                  <?php elseif ($row->type=='BONUS'): ?>
                      <span class="label label-sm label-primary block">BONUS</span>
                  <?php else: ?>
                      <span class="label label-sm label-success green block">USED</span>
                  <?php endif; ?>
                </td>
                <td><?= $row->periods;?></td>
                <td>
                  <?= ($row->type == 'DBIT' ? $row->periods : $row->free_month);?>
                </td>
                <td><?= (empty($row->account)) ? '-':$row->account;?></td>
                <td><?= (empty($row->coverage_start)) ? '-':$row->coverage_start;?></td>
                <td><?= (empty($row->coverage_end)) ? '-':$row->coverage_end;?></td>
                <td>
                  <?php 
                      $is_dealer = $this->dealer_model->is_dealer($row->username);
                      $parent = ($is_dealer==true) ? $this->users_model->get_reseller($row->username): $row->username;
                  ?>

                  <?php if ($row->type=='CRDT' && empty($row->account)): ?>
                    <?php
                      echo $row->periods.' credits received by '.$parent;
                      echo !empty($row->created_by) ? 'by '.$row->created_by : '';
                    ?>
                  <?php elseif ($row->type=='DBIT' && empty($row->account)): ?>
                    <?php 
                      echo -$row->periods.' credits  recovered by '.$parent;
                      echo !empty($row->created_by) ? 'by '.$row->created_by : '';
                    ?>
                  <?php else: ?>
                    <?= (empty($row->remarks)) ? '-':$row->remarks;?>
                  <?php endif; ?>
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
