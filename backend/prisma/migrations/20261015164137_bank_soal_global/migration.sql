-- Bank soal menjadi umum: soal tidak lagi dimiliki satu ujian.
-- Keterkaitan lama (questions.exam_id) disalin ke exam_questions sebelum kolom dihapus.

-- CreateTable
CREATE TABLE `exam_questions` (
    `exam_id` INTEGER NOT NULL,
    `question_id` INTEGER NOT NULL,
    `bobot` DECIMAL(6, 2) NULL,
    `urutan` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`exam_id`, `question_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `exam_questions` ADD CONSTRAINT `exam_questions_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_questions` ADD CONSTRAINT `exam_questions_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Salin data lama: bobot memakai bobot bawaan soal (NULL), urutan mengikuti id soal dalam ujian
INSERT INTO `exam_questions` (`exam_id`, `question_id`, `bobot`, `urutan`)
SELECT q.`exam_id`, q.`id`, NULL,
       (SELECT COUNT(*) FROM `questions` q2 WHERE q2.`exam_id` = q.`exam_id` AND q2.`id` < q.`id`)
FROM `questions` q;

-- DropForeignKey
ALTER TABLE `questions` DROP FOREIGN KEY `questions_exam_id_fkey`;

-- DropIndex
DROP INDEX `questions_exam_id_fkey` ON `questions`;

-- AlterTable
ALTER TABLE `questions` DROP COLUMN `exam_id`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `kategori` VARCHAR(80) NULL;
