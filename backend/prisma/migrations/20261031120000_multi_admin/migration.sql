-- Multi admin: super admin, kepemilikan data per admin, peserta di banyak grup.

ALTER TABLE `users` ADD COLUMN `nama` VARCHAR(100) NULL,
    ADD COLUMN `super_admin` BOOLEAN NOT NULL DEFAULT false;

-- Admin yang sudah ada menjadi super admin
UPDATE `users` SET `super_admin` = true WHERE `role` = 'admin';

-- Keanggotaan grup (banyak-ke-banyak), salin dari peserta_profile.group_id
CREATE TABLE `group_members` (
    `group_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,

    INDEX `group_members_user_id_idx`(`user_id`),
    PRIMARY KEY (`group_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `group_members` (`group_id`, `user_id`)
SELECT `group_id`, `user_id` FROM `peserta_profile` WHERE `group_id` IS NOT NULL;

ALTER TABLE `group_members` ADD CONSTRAINT `group_members_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `peserta_profile` DROP FOREIGN KEY `peserta_profile_group_id_fkey`;
ALTER TABLE `peserta_profile` DROP COLUMN `group_id`,
    ADD COLUMN `created_by` INTEGER NULL;

-- Pemilik data: data lama menjadi milik super admin pertama
ALTER TABLE `groups` ADD COLUMN `created_by` INTEGER NULL;
ALTER TABLE `questions` ADD COLUMN `created_by` INTEGER NULL;
ALTER TABLE `question_categories` ADD COLUMN `created_by` INTEGER NULL;

SET @owner = (SELECT MIN(`id`) FROM `users` WHERE `role` = 'admin');
UPDATE `groups` SET `created_by` = @owner;
UPDATE `questions` SET `created_by` = @owner;
UPDATE `question_categories` SET `created_by` = @owner;
UPDATE `peserta_profile` SET `created_by` = @owner;

ALTER TABLE `groups` ADD CONSTRAINT `groups_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX `question_categories_nama_key` ON `question_categories`;
CREATE UNIQUE INDEX `question_categories_nama_created_by_key` ON `question_categories`(`nama`, `created_by`);
