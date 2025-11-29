/*
  Warnings:

  - A unique constraint covering the columns `[traccarDeviceId]` on the table `Bus` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Bus" ADD COLUMN     "traccarDeviceId" INTEGER;

-- CreateTable
CREATE TABLE "IntegrationState" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationState_key_key" ON "IntegrationState"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_traccarDeviceId_key" ON "Bus"("traccarDeviceId");
