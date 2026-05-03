-- Tickets DB hardening checklist (safe, additive where possible).
-- Review in staging first; adjust table engine/collation to your environment.

-- 1) Helpful indexes for current query patterns.
ALTER TABLE tickets
  ADD INDEX idx_tickets_status_updated (status_id, updated_at),
  ADD INDEX idx_tickets_user_status_updated (user_id, status_id, updated_at),
  ADD INDEX idx_tickets_updated (updated_at),
  ADD INDEX idx_tickets_category (category_id);

ALTER TABLE tickets_comments
  ADD INDEX idx_ticket_comments_ticket_created (ticket_id, created_at),
  ADD INDEX idx_ticket_comments_user (user_id);

-- 2) Optional cleanup queries (run manually before adding strict constraints).
-- SELECT COUNT(*) FROM tickets WHERE status_id NOT IN (1,2,3);
-- SELECT COUNT(*) FROM tickets WHERE priority_id NOT IN (1,2,3);
-- SELECT COUNT(*) FROM tickets_comments tc LEFT JOIN tickets t ON t.id = tc.ticket_id WHERE t.id IS NULL;

-- 3) Optional constraints (enable only after cleanup and compatibility checks).
-- MySQL 8 CHECK constraints:
-- ALTER TABLE tickets
--   ADD CONSTRAINT chk_tickets_status CHECK (status_id IN (1,2,3)),
--   ADD CONSTRAINT chk_tickets_priority CHECK (priority_id IN (1,2,3));

-- 4) Optional FK constraints (ensure matching types + InnoDB first).
-- ALTER TABLE tickets_comments
--   ADD CONSTRAINT fk_ticket_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
