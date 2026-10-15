/*
  Warnings:

  - You are about to drop the column `jadwal_mulai` on the `exams` table. All the data in the column will be lost.
  - You are about to drop the column `jadwal_selesai` on the `exams` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `exams` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `exams` DROP COLUMN `jadwal_mulai`,
    DROP COLUMN `jadwal_selesai`,
    DROP COLUMN `token`,
    ADD COLUMN `aktif` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `exam_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked_at` DATETIME(3) NULL,
    `created_by` INTEGER NULL,

    INDEX `exam_tokens_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `exam_tokens` ADD CONSTRAINT `exam_tokens_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
