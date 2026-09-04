import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "package.json",
  "src/main/index.ts",
  "src/main/live/live-orchestrator.ts",
  "src/main/khepree/khepree-access-service.ts",
  "src/shared/khepree-catalog.ts",
  "src/main/connectors/llm/gemini-worker-provider.ts",
  "src/main/connectors/tiktok/tiktok-worker-provider.ts",
  "src/preload/index.ts",
  "src/renderer/app/App.tsx",
  "workers/gemini_worker/app.py",
  "workers/tiktok_worker/app.py",
  "docs/ARCHITECTURE.md"
];

let failed = false;
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error("MISSING", file);
    failed = true;
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.productName !== "Khepree Livestream AI") {
  console.error("Unexpected productName");
  failed = true;
}
if (!pkg.protocols?.[0]?.schemes?.includes("khepreelivestreamai")) {
  console.error("Missing custom protocol");
  failed = true;
}

const catalog = fs.readFileSync(path.join(root, "src/shared/khepree-catalog.ts"), "utf8");
for (const needle of [
  'productSlug: "khepree-livestream-ai"',
  'clientId: "khepree-livestream-ai-desktop"',
  'redirectUri: "khepreelivestreamai://auth/callback"',
  'accessFeatureKey: "livestream_ai.access"',
  "amountMinor: 299_000",
  "amountMinor: 2_799_000"
]) {
  if (!catalog.includes(needle)) {
    console.error("Catalog contract drift:", needle);
    failed = true;
  }
}

const apiClient = fs.readFileSync(path.join(root, "src/main/khepree/khepree-api-client.ts"), "utf8");
if (!apiClient.includes('"data" in raw') && !apiClient.includes("raw.data")) {
  console.error("API client must unwrap Khepree { data } envelope");
  failed = true;
}
if (!apiClient.includes("/desktop/activate") || !apiClient.includes("/desktop/checkout")) {
  console.error("API client missing activate/checkout paths");
  failed = true;
}

const main = fs.readFileSync(path.join(root, "src/main/index.ts"), "utf8");
if (!main.includes("requestSingleInstanceLock")) {
  console.error("Single-instance boundary missing");
  failed = true;
}

const preload = fs.readFileSync(path.join(root, "src/preload/index.ts"), "utf8");
if (!preload.includes("contextBridge.exposeInMainWorld")) {
  console.error("Preload bridge missing");
  failed = true;
}

if (failed) process.exit(1);

// Production UI must not use browser alert() for errors.
const rendererRoot = path.join(root, "src", "renderer");
function walkTs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTs(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}
for (const file of walkTs(rendererRoot)) {
  const text = fs.readFileSync(file, "utf8");
  if (/\balert\s*\(/.test(text)) {
    console.error("Forbidden alert() in renderer:", path.relative(root, file));
    failed = true;
  }
}

for (const file of [
  "src/shared/errors/index.ts",
  "src/renderer/errors/catalog.ts",
  "src/renderer/errors/sanitize.ts",
  "src/renderer/components/feedback/ErrorDialog.tsx"
]) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error("MISSING", file);
    failed = true;
  }
}

const errorCopy = fs.readFileSync(path.join(root, "src/renderer/errors/catalog.ts"), "utf8");
if (!errorCopy.includes("TIKTOK_CONNECTOR_NOT_ENABLED_IN_FOUNDATION")) {
  console.error("Error catalog missing TikTok foundation code");
  failed = true;
}
if (!errorCopy.includes("Chưa thể kết nối TikTok")) {
  console.error("Error catalog missing Vietnamese TikTok title");
  failed = true;
}

const sanitizeSrc = fs.readFileSync(path.join(root, "src/renderer/errors/sanitize.ts"), "utf8");
if (!sanitizeSrc.includes("[redacted]") || !sanitizeSrc.includes("STACK_LINE")) {
  console.error("sanitize.ts missing redaction guards");
  failed = true;
}

for (const file of [
  "src/shared/product-dna.ts",
  "src/shared/product-import/index.ts",
  "src/shared/product-import/csv.ts",
  "src/renderer/pages/ProductsPage.tsx",
  "src/renderer/components/products/ProductForm.tsx",
  "src/renderer/components/products/ProductList.tsx",
  "src/renderer/components/products/ProductImportPanel.tsx"
]) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error("MISSING", file);
    failed = true;
  }
}

const productDna = fs.readFileSync(path.join(root, "src/shared/product-dna.ts"), "utf8");
for (const needle of [
  "computeProductCompleteness",
  "validateProduct",
  "productHasFact",
  "duplicateProduct",
  "normalizeProduct"
]) {
  if (!productDna.includes(needle)) {
    console.error("product-dna.ts missing:", needle);
    failed = true;
  }
}

const productImport = fs.readFileSync(path.join(root, "src/shared/product-import/index.ts"), "utf8");
for (const needle of [
  "buildImportPreview",
  "CsvProductImporter",
  "PasteTextProductImporter",
  "ProductEnrichmentProvider",
  "assertProductImportHelpers"
]) {
  if (!productImport.includes(needle)) {
    console.error("product-import missing:", needle);
    failed = true;
  }
}

const llmManager = fs.readFileSync(path.join(root, "src/main/connectors/llm/llm-provider-manager.ts"), "utf8");
for (const needle of [
  "class LlmProviderManager",
  "CircuitBreaker",
  "demoModeAcknowledged",
  "gemini-web",
  "assertLlmProviderManagerContract",
  "probe(",
  "testConnection",
  "saveManualSession",
  "FallbackSalesProvider",
  "generateFallback",
  "usingFallbackScript",
  "FALLBACK_SCRIPT"
]) {
  if (!llmManager.includes(needle)) {
    console.error("llm-provider-manager missing:", needle);
    failed = true;
  }
}

for (const file of [
  "resources/sales-scripts/vi.json",
  "resources/sales-scripts/en.json",
  "src/shared/sales-script.ts",
  "src/main/connectors/llm/fallback-sales-provider.ts"
]) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error("MISSING", file);
    failed = true;
  }
}

const salesScript = fs.readFileSync(path.join(root, "src/shared/sales-script.ts"), "utf8");
for (const needle of ["substituteScriptLine", "assertSalesScriptHelpers", "{{product."]) {
  if (!salesScript.includes(needle.replace("{{product.", "product."))) {
    // placeholders live in JSON; helpers must exist
  }
}
for (const needle of ["substituteScriptLine", "assertSalesScriptHelpers", "resolveProductVars"]) {
  if (!salesScript.includes(needle)) {
    console.error("sales-script missing:", needle);
    failed = true;
  }
}

const viPack = fs.readFileSync(path.join(root, "resources/sales-scripts/vi.json"), "utf8");
for (const cat of [
  "WELCOME",
  "PRODUCT_INTRO",
  "FEATURE",
  "BENEFIT",
  "PRICE",
  "CTA",
  "THANK",
  "TRANSITION",
  "IDLE",
  "ORDER_REACTION",
  "GENERIC_REPLY"
]) {
  if (!viPack.includes(`"${cat}"`)) {
    console.error("vi sales script pack missing category:", cat);
    failed = true;
  }
}

if (!fs.existsSync(path.join(root, "src/renderer/components/connections/GeminiOnboardingWizard.tsx"))) {
  console.error("MISSING GeminiOnboardingWizard.tsx");
  failed = true;
}

const geminiProvider = fs.readFileSync(path.join(root, "src/main/connectors/llm/gemini-worker-provider.ts"), "utf8");
if (!geminiProvider.includes("GEMINI_DEPENDENCY_MISSING")) {
  console.error("Gemini provider must fail clearly when dependency missing");
  failed = true;
}

const appContainer = fs.readFileSync(path.join(root, "src/main/app-container.ts"), "utf8");
if (!appContainer.includes("LlmProviderManager") || appContainer.includes("readonly llm = new MockLlmProvider")) {
  console.error("AppContainer must wire LlmProviderManager (keep Mock via manager)");
  failed = true;
}
if (!appContainer.includes("TikTokConnectorManager") || !appContainer.includes("readonly tiktok")) {
  console.error("AppContainer must wire TikTokConnectorManager");
  failed = true;
}

for (const file of [
  "src/main/connectors/tiktok/tiktok-connector-manager.ts",
  "src/shared/tiktok-contracts.ts",
  "src/renderer/components/connections/TikTokConnectorPanel.tsx",
  "src/main/connectors/tiktok/live-manager-manager.ts",
  "src/main/connectors/tiktok/live-manager-observer.ts",
  "src/main/connectors/tiktok/selector-pack-loader.ts",
  "src/shared/live-manager-contracts.ts",
  "src/shared/live-manager-activity.ts",
  "src/renderer/components/connections/LiveManagerPanel.tsx",
  "resources/selector-packs/tiktok-live-manager.foundation.json"
]) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error("MISSING", file);
    failed = true;
  }
}

const tiktokManager = fs.readFileSync(path.join(root, "src/main/connectors/tiktok/tiktok-connector-manager.ts"), "utf8");
for (const needle of [
  "class TikTokConnectorManager",
  "eventBus.publish",
  "lastSequence",
  "BACKOFF_MS",
  "assertTikTokConnectorContract",
  "drainEvents"
]) {
  if (!tiktokManager.includes(needle)) {
    console.error("tiktok-connector-manager missing:", needle);
    failed = true;
  }
}
if (/\.generate\(|llm\.|GeminiWorker/.test(tiktokManager)) {
  console.error("TikTokConnectorManager must not call Gemini/LLM");
  failed = true;
}

const registerTikTok = fs.readFileSync(path.join(root, "src/main/ipc/register.ts"), "utf8");
if (registerTikTok.includes("TIKTOK_CONNECTOR_NOT_ENABLED_IN_FOUNDATION")) {
  console.error("IPC must wire real TikTok connect (not foundation stub)");
  failed = true;
}
if (!registerTikTok.includes("container.tiktok.connect") || !registerTikTok.includes("tiktok: container.tiktok.getPublicState")) {
  console.error("register.ts must expose TikTok connect + snapshot.tiktok");
  failed = true;
}
if (
  !registerTikTok.includes("container.liveManager.open") ||
  !registerTikTok.includes("liveManager: container.liveManager.getPublicState")
) {
  console.error("register.ts must expose LIVE Manager open + snapshot.liveManager");
  failed = true;
}

const liveManagerSrc = fs.readFileSync(
  path.join(root, "src/main/connectors/tiktok/live-manager-observer.ts"),
  "utf8"
);
for (const needle of [
  "launchPersistentContext",
  "captureDiagnosticScreenshot",
  "BROWSER_SESSION_FAILED",
  "waiting_login",
  "ORDER_ACTIVITY",
  "VIOLATION",
  "PRODUCT_ACTIVITY",
  "fingerprints"
]) {
  if (!liveManagerSrc.includes(needle)) {
    console.error("live-manager-observer missing:", needle);
    failed = true;
  }
}
if (/generateSpeech|playAudio|\.speak\(|media\.play/i.test(liveManagerSrc)) {
  console.error("live-manager-observer must not trigger voice/media");
  failed = true;
}

const activityHelpers = fs.readFileSync(
  path.join(root, "src/shared/live-manager-activity.ts"),
  "utf8"
);
for (const needle of [
  "fingerprintLiveManagerActivity",
  "assessOrderActivity",
  "paymentConfirmed",
  "ActivityFingerprintStore",
  "assertLiveManagerActivityHelpers"
]) {
  if (!activityHelpers.includes(needle)) {
    console.error("live-manager-activity missing:", needle);
    failed = true;
  }
}

const liveManagerMgr = fs.readFileSync(
  path.join(root, "src/main/connectors/tiktok/live-manager-manager.ts"),
  "utf8"
);
if (!liveManagerMgr.includes("eventBus.publish") || !liveManagerMgr.includes("pollActivityOnce")) {
  console.error("LiveManagerManager must poll activity and publish to Event Bus");
  failed = true;
}
if (/\.speak|media\.|llm\./i.test(liveManagerMgr)) {
  console.error("LiveManagerManager must not call LLM/media/voice");
  failed = true;
}
if (!liveManagerMgr.includes("async open(profileKey") || !liveManagerMgr.includes("boundProfileKey")) {
  console.error("LiveManagerManager.open must take profileKey");
  failed = true;
}

const liveTypesSrc = fs.readFileSync(path.join(root, "src/shared/live-types.ts"), "utf8");
for (const needle of ["VIOLATION", "PRODUCT_ACTIVITY", "paymentConfirmed", "fingerprint?"]) {
  if (!liveTypesSrc.includes(needle)) {
    console.error("live-types missing activity field:", needle);
    failed = true;
  }
}

if (/password|otp.?bypass|captcha.?bypass/i.test(liveManagerSrc) && /fill\(.*password/i.test(liveManagerSrc)) {
  console.error("live-manager-observer must not collect passwords");
  failed = true;
}

const packJson = fs.readFileSync(
  path.join(root, "resources/selector-packs/tiktok-live-manager.foundation.json"),
  "utf8"
);
if (
  !packJson.includes('"commentRows": []') ||
  !packJson.includes('"orderRows": []') ||
  !packJson.includes('"productActivityRows": []')
) {
  console.error("foundation selector pack must keep empty Activity Feed selectors");
  failed = true;
}

const liveManagerUi = fs.readFileSync(
  path.join(root, "src/renderer/components/connections/LiveManagerPanel.tsx"),
  "utf8"
);
if (!liveManagerUi.includes("liveManager.emptyPack") || !liveManagerUi.includes("openLiveManager")) {
  console.error("LiveManagerPanel must open browser + show empty pack message");
  failed = true;
}

const liveManagerVi = fs.readFileSync(path.join(root, "src/renderer/i18n/vi.ts"), "utf8");
if (
  !liveManagerVi.includes(
    "Phiên bản giao diện TikTok hiện chưa được cấu hình để đọc Activity Feed."
  )
) {
  console.error("vi i18n missing empty Activity Feed message");
  failed = true;
}

for (const file of [
  "src/shared/comment-priority.ts",
  "src/shared/comment-feed.ts",
  "src/main/live/comment-feed-service.ts",
  "src/renderer/pages/CommentsPage.tsx"
]) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error("MISSING", file);
    failed = true;
  }
}

const commentPriority = fs.readFileSync(path.join(root, "src/shared/comment-priority.ts"), "utf8");
for (const needle of ["analyzeComment", "scoreComment", "assertCommentPriorityHelpers"]) {
  if (!commentPriority.includes(needle)) {
    console.error("comment-priority missing:", needle);
    failed = true;
  }
}

const commentsPage = fs.readFileSync(path.join(root, "src/renderer/pages/CommentsPage.tsx"), "utf8");
if (commentsPage.includes("fakeComment") || commentsPage.includes("MOCK_COMMENTS")) {
  console.error("CommentsPage must not ship fake comment fixtures");
  failed = true;
}
if (!commentsPage.includes("matchesCommentFilter") || !commentsPage.includes("comments.emptyBody")) {
  console.error("CommentsPage missing filter/empty-state wiring");
  failed = true;
}

const appComments = fs.readFileSync(path.join(root, "src/main/app-container.ts"), "utf8");
if (!appComments.includes("CommentFeedService") || !appComments.includes("comments.start()")) {
  console.error("AppContainer must start CommentFeedService");
  failed = true;
}

const ipcComments = fs.readFileSync(path.join(root, "src/shared/ipc.ts"), "utf8");
for (const needle of ["COMMENT_PIN", "comments: CommentFeedSnapshot", "pinComment"]) {
  if (!ipcComments.includes(needle)) {
    console.error("ipc.ts missing comment contract:", needle);
    failed = true;
  }
}

for (const file of [
  "src/shared/sales-brain/schema.ts",
  "src/shared/sales-brain/parse.ts",
  "src/shared/sales-brain/grounding.ts",
  "src/shared/sales-brain/prompt.ts",
  "src/shared/sales-brain/fixtures.ts",
  "src/shared/sales-brain/self-check.ts"
]) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error("MISSING", file);
    failed = true;
  }
}

const salesBrain = fs.readFileSync(path.join(root, "src/shared/sales-brain/parse.ts"), "utf8");
for (const needle of [
  "parseAndValidateSalesBrainOutput",
  "askOperatorFromSalesBrainFailure",
  "SALES_BRAIN_MAX_ATTEMPTS",
  "ActionProposalModelSchema"
]) {
  if (!salesBrain.includes(needle) && needle !== "ActionProposalModelSchema") {
    console.error("sales-brain parse missing:", needle);
    failed = true;
  }
}
const salesSchema = fs.readFileSync(path.join(root, "src/shared/sales-brain/schema.ts"), "utf8");
if (!salesSchema.includes("ActionProposalModelSchema") || !salesSchema.includes('from "zod"')) {
  console.error("sales-brain schema must use Zod ActionProposalModelSchema");
  failed = true;
}

const geminiSales = fs.readFileSync(path.join(root, "src/main/connectors/llm/gemini-worker-provider.ts"), "utf8");
for (const needle of [
  "buildSalesBrainPrompt",
  "parseAndValidateSalesBrainOutput",
  "SALES_BRAIN_MAX_ATTEMPTS",
  "askOperatorFromSalesBrainFailure"
]) {
  if (!geminiSales.includes(needle)) {
    console.error("gemini provider must use sales brain pipeline:", needle);
    failed = true;
  }
}

for (const file of [
  "src/shared/live-memory.ts",
  "src/main/live/live-memory.ts"
]) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error("MISSING", file);
    failed = true;
  }
}

const liveMemory = fs.readFileSync(path.join(root, "src/shared/live-memory.ts"), "utf8");
for (const needle of [
  "speechSimilarity",
  "isSpeechTooSimilar",
  "SPEECH_SIMILARITY_THRESHOLD",
  "assertLiveMemoryHelpers",
  "LIVE_MEMORY_CAPS"
]) {
  if (!liveMemory.includes(needle)) {
    console.error("live-memory missing:", needle);
    failed = true;
  }
}

const liveOrch = fs.readFileSync(path.join(root, "src/main/live/live-orchestrator.ts"), "utf8");
for (const needle of [
  "LiveMemory",
  "memory.reset",
  "anti_repetition",
  "isSpeechTooSimilar",
  "onSessionStart"
]) {
  if (!liveOrch.includes(needle)) {
    console.error("live-orchestrator missing live memory wiring:", needle);
    failed = true;
  }
}

const sessionsRepo = fs.readFileSync(path.join(root, "src/main/db/repositories.ts"), "utf8");
if (!sessionsRepo.includes("class LiveSessionRepository") || !sessionsRepo.includes("startWithId")) {
  console.error("LiveSessionRepository with startWithId required");
  failed = true;
}
if (
  !sessionsRepo.includes("class TikTokAccountRepository") ||
  !sessionsRepo.includes("class AccountLiveSettingsRepository")
) {
  console.error("Multi-live account repositories required");
  failed = true;
}

const connectionSrc = fs.readFileSync(path.join(root, "src/main/db/connection.ts"), "utf8");
for (const needle of [
  "CURRENT_SCHEMA_VERSION",
  "migrateV2MultiLive",
  "tiktok_accounts",
  "account_live_settings",
  "schema.version"
]) {
  if (!connectionSrc.includes(needle)) {
    console.error("connection.ts multi-live migration missing:", needle);
    failed = true;
  }
}

for (const file of [
  "src/shared/tiktok-account.ts",
  "src/main/db/multi-live-self-check.ts",
  "src/main/live/live-runtime.ts",
  "src/main/live/live-runtime-self-check.ts",
  "src/main/live/multi-live-runtime-manager.ts",
  "src/main/live/multi-live-manager-self-check.ts",
  "docs/MULTI_LIVE_ARCHITECTURE.md"
]) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error("MISSING", file);
    failed = true;
  }
}

const liveRuntimeSrc = fs.readFileSync(path.join(root, "src/main/live/live-runtime.ts"), "utf8");
for (const needle of [
  "class LiveRuntime",
  "publishEvent",
  "EVENT_ACCOUNT_MISMATCH",
  "setCurrentProduct",
  "setAutomationMode",
  "APPROVAL_SESSION_REQUIRED"
]) {
  if (!liveRuntimeSrc.includes(needle)) {
    console.error("live-runtime missing:", needle);
    failed = true;
  }
}

const multiLiveMgr = fs.readFileSync(
  path.join(root, "src/main/live/multi-live-runtime-manager.ts"),
  "utf8"
);
for (const needle of [
  "class MultiLiveRuntimeManager",
  "Map<",
  "startLive",
  "stopLive",
  "stopAll",
  "CONCURRENCY_LIMIT",
  "ACCOUNT_ID_REQUIRED",
  "getAllSnapshots"
]) {
  if (!multiLiveMgr.includes(needle)) {
    console.error("multi-live-runtime-manager missing:", needle);
    failed = true;
  }
}

const appContainerLive = fs.readFileSync(path.join(root, "src/main/app-container.ts"), "utf8");
if (!appContainerLive.includes("MultiLiveRuntimeManager") || !appContainerLive.includes("multiLive")) {
  console.error("AppContainer must host MultiLiveRuntimeManager");
  failed = true;
}
if (/readonly live:/.test(appContainerLive)) {
  console.error("AppContainer must not keep readonly live singleton");
  failed = true;
}
if (/get currentProductId\(/.test(appContainerLive) && appContainerLive.includes("settings.getCurrentProductId")) {
  console.error("AppContainer must not own global currentProductId");
  failed = true;
}

const ipcSnap = fs.readFileSync(path.join(root, "src/shared/ipc.ts"), "utf8");
if (!ipcSnap.includes("lives: AccountLiveSnapshot[]") && !ipcSnap.includes("lives:")) {
  console.error("AppSnapshot must include lives[]");
  failed = true;
}
for (const needle of [
  "getAccountSnapshot(accountId: string)",
  "getMultiLiveSnapshot()",
  "startLive(accountId: string)",
  "stopLive(accountId: string)",
  "setAutomationMode(accountId: string, mode: AutomationMode)",
  "resolveApproval(",
  "connectTikTok(accountId: string)",
  "setCurrentProduct(accountId: string",
  "interface MultiLiveSnapshot",
  "setFocusedAccount(",
  "createTikTokAccount(",
  "updateTikTokAccount(",
  "deleteTikTokAccount(",
  "ACCOUNT_FOCUS",
  "ACCOUNT_CREATE",
  "ACCOUNT_UPDATE",
  "ACCOUNT_DELETE"
]) {
  if (!ipcSnap.includes(needle)) {
    console.error("ipc.ts account-aware API missing:", needle);
    failed = true;
  }
}

const registerIpcAware = fs.readFileSync(path.join(root, "src/main/ipc/register.ts"), "utf8");
if (!registerIpcAware.includes("requireValidAccountId")) {
  console.error("register.ts must validate accountId via requireValidAccountId");
  failed = true;
}
if (registerIpcAware.includes("resolveLiveAccountId")) {
  console.error("register.ts must not use legacy omit-accountId shim");
  failed = true;
}
if (!registerIpcAware.includes("account.profileKey")) {
  console.error("LIVE_MANAGER_OPEN must pass account.profileKey");
  failed = true;
}

if (!liveManagerSrc.includes("browser-profiles") || !liveManagerSrc.includes("profileKey")) {
  console.error("LiveManagerObserver must bind browser-profiles/<profileKey>");
  failed = true;
}

for (const file of [
  "src/main/ipc/account-id.ts",
  "src/main/ipc/account-aware-ipc-self-check.ts",
  "src/renderer/components/connections/TikTokAccountsPanel.tsx"
]) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error("MISSING", file);
    failed = true;
  }
}

const liveTypesSnap = fs.readFileSync(path.join(root, "src/shared/live-types.ts"), "utf8");
if (!liveTypesSnap.includes("interface AccountLiveSnapshot")) {
  console.error("AccountLiveSnapshot type required");
  failed = true;
}

const liveTypesMulti = fs.readFileSync(path.join(root, "src/shared/live-types.ts"), "utf8");
for (const needle of [
  "interface TikTokAccount",
  "interface AccountLiveSettings",
  "interface LiveSession",
  "accountId: string",
  "UNASSIGNED_ACCOUNT_ID"
]) {
  if (!liveTypesMulti.includes(needle)) {
    console.error("live-types multi-live field missing:", needle);
    failed = true;
  }
}

const approvalEngine = fs.readFileSync(path.join(root, "src/main/live/approval-engine.ts"), "utf8");
for (const needle of [
  "NEVER_AUTO_RISK_TAGS",
  "medical",
  "refund_dispute",
  "warranty_dispute",
  "unknown_fact",
  "cancelNearestAutoApprove",
  "assertApprovalEngineContract"
]) {
  if (!approvalEngine.includes(needle)) {
    console.error("approval-engine missing:", needle);
    failed = true;
  }
}

const approvalCard = fs.readFileSync(path.join(root, "src/renderer/components/live/ApprovalCard.tsx"), "utf8");
for (const needle of [
  "approval.speakNow",
  "approval.edit",
  "approval.skip",
  "approval.stopAuto",
  "approval.cancelAuto",
  "approval.speakEdited",
  "approvalCountdown"
]) {
  if (!approvalCard.includes(needle)) {
    console.error("ApprovalCard missing UX:", needle);
    failed = true;
  }
}

const approvalQueue = fs.readFileSync(path.join(root, "src/renderer/components/live/ApprovalQueue.tsx"), "utf8");
if (!approvalQueue.includes("Escape") || !approvalQueue.includes("cancelNearestApprovalAuto")) {
  console.error("ApprovalQueue must handle Esc → cancelNearestApprovalAuto");
  failed = true;
}

const ipcApproval = fs.readFileSync(path.join(root, "src/shared/ipc.ts"), "utf8");
for (const needle of [
  "APPROVAL_CANCEL_AUTO",
  "APPROVAL_CANCEL_NEAREST_AUTO",
  "APPROVAL_STOP_AUTOMATION"
]) {
  if (!ipcApproval.includes(needle)) {
    console.error("ipc missing approval control:", needle);
    failed = true;
  }
}

const ipcSrc = fs.readFileSync(path.join(root, "src/shared/ipc.ts"), "utf8");
for (const needle of ["PRODUCT_DELETE", "PRODUCT_SELECT", "currentProductId", "deleteProduct", "selectProduct"]) {
  if (!ipcSrc.includes(needle)) {
    console.error("ipc.ts missing product contract:", needle);
    failed = true;
  }
}

const registerSrc = fs.readFileSync(path.join(root, "src/main/ipc/register.ts"), "utf8");
for (const needle of ["PRODUCT_DELETE", "PRODUCT_SELECT", "validateProduct"]) {
  if (!registerSrc.includes(needle)) {
    console.error("register.ts missing product handler:", needle);
    failed = true;
  }
}

const liveTypes = fs.readFileSync(path.join(root, "src/shared/live-types.ts"), "utf8");
for (const needle of ["sizes:", "colors:", "stockText?", "shippingText?", "warrantyText?", "aiNotes?", "materials?"]) {
  if (!liveTypes.includes(needle)) {
    console.error("ProductDNA field missing:", needle);
    failed = true;
  }
}

if (failed) process.exit(1);

console.log(`Foundation check PASS (${required.length} critical files).`);
