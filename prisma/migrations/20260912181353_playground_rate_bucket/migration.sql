-- CreateTable
CREATE TABLE "PlaygroundRateBucket" (
    "clientKey" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaygroundRateBucket_pkey" PRIMARY KEY ("clientKey")
);
