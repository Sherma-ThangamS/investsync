CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  role ENUM('master', 'follower', 'both') NOT NULL,
  initial_capital DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE master_profiles (
  user_id VARCHAR(64) PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  performance_fee_percent DECIMAL(5,2) NOT NULL,
  monthly_subscription_fee DECIMAL(18,2) NOT NULL,
  strategy_description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_master_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  follower_user_id VARCHAR(64) NOT NULL,
  master_user_id VARCHAR(64) NOT NULL,
  allocated_capital DECIMAL(18,2) NOT NULL,
  start_equity DECIMAL(18,2) NOT NULL,
  high_water_mark DECIMAL(18,2) NOT NULL,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  max_drawdown_percent DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscriptions_follower FOREIGN KEY (follower_user_id) REFERENCES users(id),
  CONSTRAINT fk_subscriptions_master FOREIGN KEY (master_user_id) REFERENCES users(id)
);

CREATE TABLE trade_events (
  id VARCHAR(64) PRIMARY KEY,
  type ENUM('master_trade', 'mirrored_trade') NOT NULL,
  source_trade_id VARCHAR(64) NULL,
  master_user_id VARCHAR(64) NOT NULL,
  follower_user_id VARCHAR(64) NULL,
  subscription_id VARCHAR(64) NULL,
  symbol VARCHAR(32) NOT NULL,
  side ENUM('buy', 'sell') NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  price DECIMAL(18,4) NOT NULL,
  notional DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fee_ledger (
  id VARCHAR(64) PRIMARY KEY,
  subscription_id VARCHAR(64) NOT NULL,
  fee_type ENUM('performance', 'subscription') NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fee_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE TABLE user_credentials (
  user_id VARCHAR(64) PRIMARY KEY,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_credentials_user FOREIGN KEY (user_id) REFERENCES users(id)
);
