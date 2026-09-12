-- CreateEnum
CREATE TYPE "RiskTier" AS ENUM ('READ_ONLY', 'SENSITIVE', 'DESTRUCTIVE');

-- CreateEnum
CREATE TYPE "ProvenanceKind" AS ENUM ('USER', 'SYSTEM', 'TOOL_RESULT', 'MEMORY', 'WORKER');

-- CreateEnum
CREATE TYPE "AttackSurface" AS ENUM ('DOCUMENT', 'MEMORY', 'MULTI_AGENT', 'MCP_TOOL_DESCRIPTION', 'WEB_SEARCH');

-- CreateEnum
CREATE TYPE "SuiteKind" AS ENUM ('ATTACK', 'BENIGN');

-- CreateEnum
CREATE TYPE "PayloadSource" AS ENUM ('AUTHORED', 'PROMPTFOO', 'GARAK');

-- CreateEnum
CREATE TYPE "GuardMode" AS ENUM ('OFF', 'DETECT_ONLY', 'ENFORCE');

-- CreateEnum
CREATE TYPE "PromptProfile" AS ENUM ('NAIVE', 'HARDENED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CaseOutcome" AS ENUM ('SAFE', 'HIJACKED', 'BLOCKED', 'ERROR');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- CreateTable
CREATE TABLE "TargetAgent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modelId" TEXT NOT NULL,
    "promptProfile" "PromptProfile" NOT NULL DEFAULT 'NAIVE',
    "isSandboxed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suite" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SuiteKind" NOT NULL,
    "surface" "AttackSurface",
    "source" "PayloadSource" NOT NULL DEFAULT 'AUTHORED',
    "isHeldOut" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payload" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "externalRef" TEXT,
    "category" TEXT NOT NULL,
    "surface" "AttackSurface" NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "content" TEXT NOT NULL,
    "expectedTool" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalRun" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "guardMode" "GuardMode" NOT NULL,
    "targetModelId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "notes" TEXT,

    CONSTRAINT "EvalRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalCase" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "payloadId" TEXT NOT NULL,
    "outcome" "CaseOutcome" NOT NULL,
    "hijacked" BOOLEAN NOT NULL DEFAULT false,
    "canaryLeaked" BOOLEAN NOT NULL DEFAULT false,
    "sideEffectFired" BOOLEAN NOT NULL DEFAULT false,
    "calledTools" TEXT[],
    "blockedTools" TEXT[],
    "finalAnswer" TEXT,
    "transcript" JSONB NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardDecision" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "riskTier" "RiskTier" NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "authorizedBy" "ProvenanceKind",
    "taintSources" "ProvenanceKind"[],
    "reason" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunMetric" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "attacksTotal" INTEGER NOT NULL DEFAULT 0,
    "attacksStopped" INTEGER NOT NULL DEFAULT 0,
    "attackStopRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "benignTotal" INTEGER NOT NULL DEFAULT 0,
    "benignPassed" INTEGER NOT NULL DEFAULT 0,
    "benignPassRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "p95GuardLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "totalPromptTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCompletionTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(12,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineResult" (
    "id" TEXT NOT NULL,
    "payloadId" TEXT NOT NULL,
    "detectorModel" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "flagged" BOOLEAN NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaselineResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "toolName" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "surface" "AttackSurface" NOT NULL,
    "category" TEXT NOT NULL,
    "analystModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EvalRunToSuite" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EvalRunToSuite_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "TargetAgent_slug_key" ON "TargetAgent"("slug");

-- CreateIndex
CREATE INDEX "TargetAgent_slug_idx" ON "TargetAgent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Suite_slug_key" ON "Suite"("slug");

-- CreateIndex
CREATE INDEX "Suite_kind_isHeldOut_idx" ON "Suite"("kind", "isHeldOut");

-- CreateIndex
CREATE INDEX "Payload_surface_category_idx" ON "Payload"("surface", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Payload_suiteId_externalRef_key" ON "Payload"("suiteId", "externalRef");

-- CreateIndex
CREATE INDEX "EvalRun_status_startedAt_idx" ON "EvalRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "EvalRun_targetId_guardMode_idx" ON "EvalRun"("targetId", "guardMode");

-- CreateIndex
CREATE INDEX "EvalCase_runId_outcome_idx" ON "EvalCase"("runId", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "EvalCase_runId_payloadId_key" ON "EvalCase"("runId", "payloadId");

-- CreateIndex
CREATE INDEX "GuardDecision_caseId_allowed_idx" ON "GuardDecision"("caseId", "allowed");

-- CreateIndex
CREATE UNIQUE INDEX "RunMetric_runId_key" ON "RunMetric"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineResult_payloadId_detectorModel_threshold_key" ON "BaselineResult"("payloadId", "detectorModel", "threshold");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_requestedAt_idx" ON "ApprovalRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "Finding_runId_severity_idx" ON "Finding"("runId", "severity");

-- CreateIndex
CREATE INDEX "_EvalRunToSuite_B_index" ON "_EvalRunToSuite"("B");

-- AddForeignKey
ALTER TABLE "Payload" ADD CONSTRAINT "Payload_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "Suite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalRun" ADD CONSTRAINT "EvalRun_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "TargetAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalCase" ADD CONSTRAINT "EvalCase_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvalRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalCase" ADD CONSTRAINT "EvalCase_payloadId_fkey" FOREIGN KEY ("payloadId") REFERENCES "Payload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardDecision" ADD CONSTRAINT "GuardDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "EvalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunMetric" ADD CONSTRAINT "RunMetric_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvalRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineResult" ADD CONSTRAINT "BaselineResult_payloadId_fkey" FOREIGN KEY ("payloadId") REFERENCES "Payload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "EvalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvalRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EvalRunToSuite" ADD CONSTRAINT "_EvalRunToSuite_A_fkey" FOREIGN KEY ("A") REFERENCES "EvalRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EvalRunToSuite" ADD CONSTRAINT "_EvalRunToSuite_B_fkey" FOREIGN KEY ("B") REFERENCES "Suite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
