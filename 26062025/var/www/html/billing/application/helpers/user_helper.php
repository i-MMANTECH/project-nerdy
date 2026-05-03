<?php
defined('BASEPATH') or exit('No direct script access allowed');

function generateMessageRenewal($username, $bonusMonths, $recoverMonths, $newExpiryDate) {
    $message = "";

    if ($bonusMonths > 0) {
        $message .= "$username has $bonusMonths months of bonus credit. ";
    }

    $message .= "If you recover $recoverMonths months of credits, then $username will lose ";

    if ($bonusMonths > 0) {
        $message .= "$bonusMonths bonus months and ";
    }

    $message .= "$recoverMonths recovered months. The updated expiration date will be $newExpiryDate";

    return $message;
}
