-- InvestSync v2 migration: notifications, paper orders, user profiles,
-- intent hashes, merkle leaves

-- User profile settings (volatility, risk, leverage)
CREATE TABLE user_profiles (
  user_id VARCHAR(64) PRIMARY KEY,
  volatility_tolerance DECIMAL(8,2) NOT NULL DEFAULT 15.00,
  risk_score INT NOT NULL DEFAULT 50,
  leverage DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Paper trading orders (persisted)
CREATE TABLE paper_orders (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  side ENUM('buy', 'sell') NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  price DECIMAL(18,4) NOT NULL,
  total DECIMAL(18,2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'filled',
  filled_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_paper_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Trade notifications (master trade → follower approval flow)
CREATE TABLE trade_notifications (
  id VARCHAR(64) PRIMARY KEY,
  master_user_id VARCHAR(64) NOT NULL,
  follower_user_id VARCHAR(64) NOT NULL,
  subscription_id VARCHAR(64) NOT NULL,
  trade_id VARCHAR(64) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  side ENUM('buy', 'sell') NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  price DECIMAL(18,4) NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
  intent_hash VARCHAR(128) NOT NULL,
  timeout_sec INT NOT NULL DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP NULL,
  CONSTRAINT fk_notif_master FOREIGN KEY (master_user_id) REFERENCES users(id),
  CONSTRAINT fk_notif_follower FOREIGN KEY (follower_user_id) REFERENCES users(id),
  CONSTRAINT fk_notif_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

-- Trade intent hashes for crypto handshake
CREATE TABLE trade_intents (
  id VARCHAR(64) PRIMARY KEY,
  master_user_id VARCHAR(64) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  side ENUM('buy', 'sell') NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  price DECIMAL(18,4) NOT NULL,
  nonce VARCHAR(64) NOT NULL,
  hash VARCHAR(128) NOT NULL,
  ttl_ms INT NOT NULL DEFAULT 60000,
  status ENUM('pending', 'approved', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL,
  CONSTRAINT fk_intent_master FOREIGN KEY (master_user_id) REFERENCES users(id)
);

-- Merkle tree leaves for audit trail
CREATE TABLE merkle_leaves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trade_id VARCHAR(64) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  side ENUM('buy', 'sell') NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  price DECIMAL(18,4) NOT NULL,
  leaf_hash VARCHAR(128) NOT NULL,
  trade_timestamp VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Merkle root snapshots (Proof-of-Execution)
CREATE TABLE merkle_roots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  root_hash VARCHAR(128) NOT NULL,
  leaf_count INT NOT NULL,
  tree_depth INT NOT NULL,
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
