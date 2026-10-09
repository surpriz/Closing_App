-- CreateTable
CREATE TABLE "extension_pairings" (
    "id" TEXT NOT NULL,
    "pollHash" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "tokenCiphertext" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extension_pairings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extension_pairings_pollHash_key" ON "extension_pairings"("pollHash");

-- CreateIndex
CREATE UNIQUE INDEX "extension_pairings_userCode_key" ON "extension_pairings"("userCode");
