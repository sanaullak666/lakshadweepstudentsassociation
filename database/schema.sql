-- Lakshadweep Students Association (LSA) Database Schema
-- Database Name: lsa_membership

CREATE DATABASE IF NOT EXISTS lsa_membership CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lsa_membership;

-- 1. Central Committee Table
CREATE TABLE IF NOT EXISTS central_committee (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  designation VARCHAR(255) NOT NULL,
  photo_url LONGTEXT DEFAULT NULL,
  display_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  access_password VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Members Table
CREATE TABLE IF NOT EXISTS members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  membership_id VARCHAR(50) UNIQUE DEFAULT NULL,
  full_name VARCHAR(255) NOT NULL,
  gender ENUM('Male', 'Female', 'Other', 'Prefer not to say') NOT NULL,
  island VARCHAR(100) NOT NULL,
  contact_number VARCHAR(15) NOT NULL,
  email VARCHAR(255) NOT NULL,
  blood_group VARCHAR(10) NOT NULL,
  present_address TEXT DEFAULT NULL,
  permanent_address TEXT DEFAULT NULL,
  designation VARCHAR(255) DEFAULT 'Member',
  wants_physical_card TINYINT(1) DEFAULT 0,
  payment_status ENUM('PENDING', 'PAID', 'FAILED') DEFAULT 'PENDING',
  registration_status ENUM('PENDING', 'ACTIVE', 'INACTIVE') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_contact (contact_number),
  INDEX idx_membership_id (membership_id),
  INDEX idx_island (island),
  INDEX idx_payment_status (payment_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  payment_id VARCHAR(255) DEFAULT NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 3.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status ENUM('PENDING', 'PAID', 'FAILED') DEFAULT 'PENDING',
  payment_method VARCHAR(50) DEFAULT 'razorpay',
  paid_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  INDEX idx_order_id (order_id),
  INDEX idx_payment_id (payment_id),
  INDEX idx_member_id (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Admins Table
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
