-- Legacy billing/ministra `configs.value` is often VARCHAR(255). Promo bonus JSON can exceed that.
-- The app may auto-run this ALTER when saving bonus rules; run manually if your DB user lacks ALTER privilege.

ALTER TABLE configs MODIFY COLUMN `value` MEDIUMTEXT;
