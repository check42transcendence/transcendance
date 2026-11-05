-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "trip_invitation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "invited_by" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(6),

    CONSTRAINT "trip_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_invitation_trip_id_idx" ON "trip_invitation"("trip_id");

-- CreateIndex
CREATE INDEX "trip_invitation_invitee_id_idx" ON "trip_invitation"("invitee_id");

-- AddForeignKey
ALTER TABLE "trip_invitation" ADD CONSTRAINT "trip_invitation_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_invitation" ADD CONSTRAINT "trip_invitation_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_invitation" ADD CONSTRAINT "trip_invitation_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Allow at most one pending invitation per trip and invitee.
-- Preserve historical accepted and rejected invitations.
CREATE UNIQUE INDEX "trip_invitation_one_pending_per_trip_invitee"
ON "trip_invitation" ("trip_id", "invitee_id")
WHERE "status" = 'PENDING';