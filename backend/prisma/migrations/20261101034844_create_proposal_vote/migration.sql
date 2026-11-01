-- CreateEnum
CREATE TYPE "proposal_status" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "vote_decision" AS ENUM ('AGREE', 'REJECT');

-- CreateTable
CREATE TABLE "proposal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "status" "proposal_status" NOT NULL DEFAULT 'PENDING',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_vote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proposal_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "decision" "vote_decision" NOT NULL,
    "voted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposal_trip_id_idx" ON "proposal"("trip_id");

-- CreateIndex
CREATE INDEX "proposal_vote_user_id_idx" ON "proposal_vote"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_vote_proposal_id_user_id_key" ON "proposal_vote"("proposal_id", "user_id");

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_vote" ADD CONSTRAINT "proposal_vote_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_vote" ADD CONSTRAINT "proposal_vote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
