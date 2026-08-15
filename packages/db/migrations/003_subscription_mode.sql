-- Add mode column to subscriptions (follow = ongoing copy, snapshot = one-time copy)
ALTER TABLE subscriptions
  ADD COLUMN mode ENUM('follow', 'snapshot') NOT NULL DEFAULT 'follow'
  AFTER max_drawdown_percent;
