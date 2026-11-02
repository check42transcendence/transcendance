-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('OWNER', 'MEMBER');

-- CreateTable
CREATE TABLE "trip" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(120) NOT NULL,
    "destination" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_member" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "member_role" NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_day" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "day_number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itinerary_day_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_member_user_id_idx" ON "trip_member"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_member_trip_id_user_id_key" ON "trip_member"("trip_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "itinerary_day_trip_id_day_number_key" ON "itinerary_day"("trip_id", "day_number");

-- CreateIndex
CREATE UNIQUE INDEX "itinerary_day_trip_id_date_key" ON "itinerary_day"("trip_id", "date");

-- AddForeignKey
ALTER TABLE "trip" ADD CONSTRAINT "trip_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_member" ADD CONSTRAINT "trip_member_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_member" ADD CONSTRAINT "trip_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_day" ADD CONSTRAINT "itinerary_day_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prevent trips from ending before they start.
ALTER TABLE "trip"
ADD CONSTRAINT "trip_date_range_check"
CHECK ("end_date" >= "start_date");

-- Require day numbers to start at 1.
ALTER TABLE "itinerary_day"
ADD CONSTRAINT "itinerary_day_number_check"
CHECK ("day_number" >= 1);

-- Allow at most one owner per trip.
CREATE UNIQUE INDEX "trip_member_one_owner_per_trip"
ON "trip_member" ("trip_id")
WHERE "role" = 'OWNER';
