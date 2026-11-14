-- ============================================================
-- DATABASE DUMP & SKEMA MYSQL RESMI PPDB YAYASAN AR-RISALAH ACEH
-- Website: arrisalahaceh.or.id / ppdb.arrisalahaceh.or.id
-- Jenjang: TKIT (TK01), SDIT (SD01), SMPIT (SMP01), SMAIT (SMA01)
-- ============================================================

-- 1. Tabel Kuota & Biaya Unit Sekolah
CREATE TABLE IF NOT EXISTS `units` (
  `id` VARCHAR(10) NOT NULL PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `short_name` VARCHAR(20) NOT NULL,
  `total_quota` INT NOT NULL DEFAULT 100,
  `filled_quota` INT NOT NULL DEFAULT 0,
  `offline_count` INT NOT NULL DEFAULT 0,
  `form_fee` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `rereg_fee` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `is_open` BOOLEAN NOT NULL DEFAULT TRUE,
  `closed_notice` TEXT NULL,
  `facilities` TEXT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel Akun Staf & Pengguna (ditempatkan sebelum students agar FK parent_user_id valid)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `phone` VARCHAR(30) NULL,
  `school_id` VARCHAR(10) NOT NULL DEFAULT 'MASTER',
  `role` VARCHAR(100) NOT NULL,
  `permissions_json` TEXT NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `email_verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `children_ids_json` TEXT NULL,
  `password_hash` VARCHAR(255) NULL,
  `last_login` VARCHAR(50) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Calon Siswa (Pendaftar) - Terelasi dengan Akun Wali (users.id) & Dinamis Form
CREATE TABLE IF NOT EXISTS `students` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `registration_number` VARCHAR(50) NOT NULL UNIQUE,
  `parent_user_id` VARCHAR(50) NULL, -- Explicit Relational Foreign Key to `users.id`
  `full_name` VARCHAR(200) NOT NULL,
  `nisn` VARCHAR(20) NULL,
  `unit` VARCHAR(10) NOT NULL,
  `gender` ENUM('Laki-laki', 'Perempuan') NOT NULL DEFAULT 'Laki-laki',
  `birth_place` VARCHAR(100) NULL,
  `birth_date` DATE NULL,
  `address` TEXT NULL,
  `parent_name` VARCHAR(150) NULL,
  `parent_phone` VARCHAR(30) NULL,
  `parent_job` VARCHAR(100) NULL,
  `parent_income` VARCHAR(100) NULL,
  `status` ENUM('verifikasi', 'tes', 'lulus', 'tidak_lulus', 'terdaftar') NOT NULL DEFAULT 'verifikasi',
  `registered_at` DATETIME NOT NULL,
  `documents_json` LONGTEXT NULL, -- Flexible JSON object for uploaded documents (KK, Akta, Pas Foto, SOT, Rapor, Ijazah, dll)
  `dynamic_answers_json` LONGTEXT NULL, -- Flexible JSON object for custom dynamic form responses per unit
  `verification_notes` TEXT NULL,
  `test_score` INT NULL,
  `test_schedule_id` VARCHAR(50) NULL,
  `test_published` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_offline` BOOLEAN NOT NULL DEFAULT FALSE,
  `track` VARCHAR(50) NULL,
  `school_origin` VARCHAR(150) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_parent_user` (`parent_user_id`),
  INDEX `idx_unit` (`unit`),
  INDEX `idx_status` (`status`),
  INDEX `idx_reg_num` (`registration_number`),
  CONSTRAINT `fk_students_parent_user` FOREIGN KEY (`parent_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Pembayaran & Bukti Transfer
CREATE TABLE IF NOT EXISTS `payments` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `registration_id` VARCHAR(50) NOT NULL,
  `registration_number` VARCHAR(50) NOT NULL,
  `student_name` VARCHAR(150) NOT NULL,
  `unit` VARCHAR(10) NOT NULL,
  `type` ENUM('Formulir', 'Daftar Ulang') NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `status` ENUM('pending', 'verifikasi', 'lunas', 'ditolak') NOT NULL DEFAULT 'pending',
  `payment_date` DATETIME NOT NULL,
  `proof_url` LONGTEXT NULL,
  `verified_by` VARCHAR(150) NULL,
  `verification_notes` TEXT NULL,
  `bank_account` VARCHAR(150) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_reg_id` (`registration_id`),
  INDEX `idx_pay_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Jadwal Tes & Observasi
CREATE TABLE IF NOT EXISTS `test_schedules` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `title` VARCHAR(150) NOT NULL,
  `unit` VARCHAR(10) NOT NULL,
  `test_date` DATE NOT NULL,
  `start_time` VARCHAR(10) NOT NULL,
  `end_time` VARCHAR(10) NOT NULL,
  `room` VARCHAR(100) NOT NULL,
  `examiner` VARCHAR(150) NOT NULL,
  `quota` INT NOT NULL DEFAULT 40,
  `filled` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel Form Builder Dinamis per Unit
CREATE TABLE IF NOT EXISTS `form_schemas` (
  `unit_id` VARCHAR(10) NOT NULL PRIMARY KEY,
  `sections_json` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabel Hak Akses & Role Pengguna
CREATE TABLE IF NOT EXISTS `roles` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `school_id` VARCHAR(10) NOT NULL DEFAULT 'MASTER',
  `permissions_json` TEXT NOT NULL,
  `description` TEXT NULL,
  `user_count` INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabel Periode Tahun Ajaran (users sudah dibuat di atas)
CREATE TABLE IF NOT EXISTS `academic_years` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `year_label` VARCHAR(50) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Tabel Pengaturan Landing Page
CREATE TABLE IF NOT EXISTS `landing_config` (
  `id` INT NOT NULL PRIMARY KEY DEFAULT 1,
  `app_name` VARCHAR(100) NOT NULL,
  `app_tagline` VARCHAR(150) NULL,
  `hero_title` TEXT NOT NULL,
  `hero_subtitle` TEXT NOT NULL,
  `stats_total` INT NOT NULL DEFAULT 800,
  `flow_steps_json` LONGTEXT NOT NULL,
  `requirements_json` LONGTEXT NOT NULL,
  `contact_json` LONGTEXT NOT NULL,
  `hero_slides_json` LONGTEXT NULL,
  `logo_url` TEXT NULL,
  `favicon_url` TEXT NULL,
  `help_title` VARCHAR(255) NULL,
  `help_subtitle` TEXT NULL,
  `full_config_json` LONGTEXT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Tabel Security Audit Log (Audit Trail)
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `timestamp_str` VARCHAR(30) NOT NULL,
  `user_email` VARCHAR(150) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `school_id` VARCHAR(10) NOT NULL,
  `details` TEXT NOT NULL,
  `ip_address` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_timestamp` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Tabel Konfigurasi Sistem Terenkripsi (SMTP, Pengaturan Sistem, dll)
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` VARCHAR(50) NOT NULL PRIMARY KEY,
  `setting_value` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DATA AWAL (SEED INITIAL DATA - HANYA JIKA BARIS BELUM ADA)
-- ============================================================

INSERT IGNORE INTO `units` (`id`, `name`, `short_name`, `total_quota`, `filled_quota`, `form_fee`, `rereg_fee`, `is_open`, `sort_order`, `facilities`)
VALUES
('TK01', 'TKIT Ar-Risalah Aceh', 'TKIT', 150, 129, 250000.00, 3500000.00, 1, 1, '[\"Sentra Bermain Islami\", \"Kolam Renang Anak\", \"Pojok Tahfidz Balita\", \"Pemeriksaan Tumbuh Kembang\"]'),
('SD01', 'SDIT Ar-Risalah Aceh', 'SDIT', 600, 563, 300000.00, 5500000.00, 1, 2, '[\"Laboratorium Sains & Robotik\", \"Masjid Al-Washliyah\", \"Perpustakaan Digital\", \"Outbound Area\"]'),
('SMP01', 'SMPIT Ar-Risalah Aceh (Boarding/Full Day)', 'SMPIT', 180, 134, 350000.00, 7500000.00, 1, 3, '[\"Asrama Ber-AC & Sanitasi Bersih\", \"Program Tahfidz 15 Juz\", \"Language Laboratory\", \"Klinik Siswa 24 Jam\"]'),
('SMA01', 'SMAIT Ar-Risalah Aceh (Boarding School)', 'SMAIT', 120, 89, 400000.00, 8500000.00, 1, 4, '[\"Persiapan PTN & Luar Negeri\", \"Tahfidz Mutqin 30 Juz\", \"Sport Center\", \"Bimbingan OSN\"]');

INSERT IGNORE INTO `academic_years` (`id`, `year_label`, `start_date`, `end_date`, `is_active`)
VALUES
('ay-2026', '2026/2027', '2026-10-01', '2027-02-28', 1),
('ay-2025', '2025/2026', '2025-10-01', '2026-02-28', 0);

-- ============================================================
-- QUERY MIGRASI OTOMATIS UNTUK DATABASE MYSQL DENGAN TABEL PRE-EXISTING
-- ============================================================
CREATE TABLE IF NOT EXISTS `form_schemas` (
  `unit_id` VARCHAR(10) NOT NULL PRIMARY KEY,
  `sections_json` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `units` ADD COLUMN `is_open` BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE `units` ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0;
ALTER TABLE `units` ADD COLUMN `offline_count` INT NOT NULL DEFAULT 0;
ALTER TABLE `units` ADD COLUMN `closed_notice` TEXT NULL;
ALTER TABLE `students` ADD COLUMN `parent_user_id` VARCHAR(50) NULL AFTER `registration_number`;
ALTER TABLE `students` ADD COLUMN `documents_json` LONGTEXT NULL AFTER `registered_at`;
ALTER TABLE `students` ADD COLUMN `dynamic_answers_json` LONGTEXT NULL AFTER `documents_json`;
ALTER TABLE `students` ADD COLUMN `is_offline` BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE `students` ADD COLUMN `track` VARCHAR(50) NULL;
ALTER TABLE `students` ADD COLUMN `school_origin` VARCHAR(150) NULL;
ALTER TABLE `students` ADD INDEX `idx_parent_user` (`parent_user_id`);
ALTER TABLE `students` MODIFY COLUMN `full_name` VARCHAR(200) NOT NULL;
ALTER TABLE `students` MODIFY COLUMN `birth_place` VARCHAR(100) NULL;
ALTER TABLE `students` MODIFY COLUMN `birth_date` DATE NULL;
ALTER TABLE `students` MODIFY COLUMN `parent_name` VARCHAR(150) NULL;
ALTER TABLE `students` MODIFY COLUMN `parent_phone` VARCHAR(30) NULL;
ALTER TABLE `students` MODIFY COLUMN `parent_income` VARCHAR(100) NULL;
ALTER TABLE `payments` MODIFY COLUMN `proof_url` LONGTEXT NULL;
