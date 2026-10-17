-- AlterTable
ALTER TABLE `exams` ADD COLUMN `jumlah_soal_tampil` INTEGER NULL;

-- CreateTable
CREATE TABLE `attempt_questions` (
    `attempt_id` INTEGER NOT NULL,
    `question_id` INTEGER NOT NULL,
    `urutan` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`attempt_id`, `question_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attempt_questions` ADD CONSTRAINT `attempt_questions_attempt_id_fkey` FOREIGN KEY (`attempt_id`) REFERENCES `exam_attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attempt_questions` ADD CONSTRAINT `attempt_questions_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
