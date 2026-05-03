<!-- Page header -->
<div class="page-header">
    <div class="page-header-content">
        <div class="page-title">

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

                    </div>
                </div>
                <div class="panel-body">
                    <!-- BEGIN FORM-->
                    <?php echo form_open('admin/deductions/index', array('class' => 'form-horizontal', 'id' => 'form_sample_3')); ?>
                    <div class="form-body">
                        <?php for ($i = 0; $i < count($deductions); $i++): ?>
                            <div class="form-group <?= (form_error("month_deduction_{$deductions[$i]->id}")) ? 'has-error' : ''; ?>">
                                <div class="col-sm-3">
                                    <select name="month_<?= $deductions[$i]->id ?>" class="form-control">
                                        <?php for ($m = 1; $m <= 24; $m++) { ?>
                                            <option value="<?php echo $m; ?>" <?php if($m==$deductions[$i]->month): echo 'selected="selected"'; endif;?> >
                                                <?php echo $m?> Month
                                            </option>
                                        <?php } ?>
                                    </select>
                                </div>

                                <div class="col-sm-3">
                                    <input type="number" class="form-control" placeholder="1" name="month_deduction_<?= $deductions[$i]->id ?>" value="<?= $deductions[$i]->month_deduction; ?>" />
                                    <?= form_error("month_deduction_{$deductions[$i]->id}", '<span class="help-block">', '</span>'); ?>
                                </div>
                            </div>
                            <!-- /.form-group -->
                        <?php endfor; ?>

                        <div class="form-group">
							<div class="form-check form-check-info col-sm-3">
								<label class="form-check-label">
									<input type="checkbox" class="form-check-input" name="one_month_free" <?php echo $one_month_free_value ? 'checked': '';?> value="1">
									    1 Month For Free
									<i class="input-helper"></i>
                                </label>
							</div>
						</div>
                        <div class="form-group">
							<div class="form-check form-check-info col-sm-3">
								<label class="form-check-label">
									<input type="checkbox" class="form-check-input" name="is_recover_bonus_credit" <?php echo $is_recover_bonus_credit ? 'checked': '';?> value="1">
									    Recover Bonus Credit
									<i class="input-helper"></i>
                                </label>
							</div>
						</div>
                    </div>
                    <div class="form-actions">
                        <div class="row">
                            <div class="col-md-9">
                                <button type="submit" class="btn btn-sm btn-success"><i class="icon-floppy-disk"></i> Submit </button>
                            </div>
                        </div>
                    </div>
                    </form>
                </div>
            </div>
            <!-- /basic responsive configuration -->
        </div>
        <!-- /main content -->
    </div>
    <!-- /page content -->
</div>
<!-- /page container -->