-- Normalized storage for Promo 1 / Promo 2 tiers.
-- Replaces large JSON blobs in `configs` for safer writes and easier maintenance.

CREATE TABLE IF NOT EXISTS bonus_promo_tiers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  promo_type ENUM('P1','P2') NOT NULL,
  sort_order INT UNSIGNED NOT NULL,
  ge INT UNSIGNED NOT NULL,
  lt INT UNSIGNED NULL,
  percentage DECIMAL(6,3) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_promo_tiers_type_order (promo_type, sort_order),
  KEY idx_promo_tiers_type_ge (promo_type, ge)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
