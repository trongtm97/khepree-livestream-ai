import type { AppLocale } from "../../shared/locale";
import { ERROR_CODES } from "../../shared/errors";

export type LocalizedText = Record<AppLocale, string>;
export type LocalizedLines = Record<AppLocale, string[]>;

export type ErrorCopy = {
  title: LocalizedText;
  userMessage: LocalizedText;
  recommendedActions: LocalizedLines;
};

function L(vi: string, en: string): LocalizedText {
  return { vi, en };
}

function A(vi: string[], en: string[]): LocalizedLines {
  return { vi, en };
}

const retryCheck = A(
  ["Thử lại", "Kiểm tra hệ thống", "Xem chi tiết kỹ thuật"],
  ["Try again", "Check system status", "View technical details"]
);

const signInKhepree = A(
  ["Đăng nhập Khepree", "Mở Kết nối", "Xem chi tiết kỹ thuật"],
  ["Sign in to Khepree", "Open Connections", "View technical details"]
);

/** Offline VI/EN copy keyed by technical code. */
export const ERROR_COPY: Record<string, ErrorCopy> = {
  [ERROR_CODES.TIKTOK_CONNECTOR_NOT_ENABLED_IN_FOUNDATION]: {
    title: L("Chưa thể kết nối TikTok", "Cannot connect TikTok yet"),
    userMessage: L(
      "Thành phần TikTok hiện chưa được khởi động trong bản nền tảng này.",
      "The TikTok connector is not started in this foundation build."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.TIKTOK_UNIQUE_ID_REQUIRED]: {
    title: L("Thiếu TikTok ID", "TikTok ID required"),
    userMessage: L(
      "Nhập unique ID (tên người dùng TikTok) trước khi kết nối.",
      "Enter a TikTok unique ID (username) before connecting."
    ),
    recommendedActions: A(
      ["Nhập unique ID", "Thử lại", "Xem chi tiết kỹ thuật"],
      ["Enter unique ID", "Try again", "View technical details"]
    )
  },
  [ERROR_CODES.TIKTOK_DISCONNECTED]: {
    title: L("Mất kết nối TikTok", "TikTok disconnected"),
    userMessage: L(
      "Luồng comment hoặc LIVE Manager đã ngắt. Kiểm tra mạng và kết nối lại.",
      "Comment feed or LIVE Manager dropped. Check the network and reconnect."
    ),
    recommendedActions: A(
      ["Kết nối lại", "Mở Kết nối", "Xem chi tiết kỹ thuật"],
      ["Reconnect", "Open Connections", "View technical details"]
    )
  },
  [ERROR_CODES.TIKTOK_DEPENDENCY_MISSING]: {
    title: L("Thiếu TikTokLive", "TikTokLive missing"),
    userMessage: L(
      "Worker TikTok chưa cài thư viện TikTokLive. Cài dependency cho workers/tiktok_worker rồi thử lại.",
      "The TikTok worker does not have TikTokLive installed. Install worker dependencies, then retry."
    ),
    recommendedActions: A(
      ["Cài dependency worker", "Thử lại", "Xem chi tiết kỹ thuật"],
      ["Install worker deps", "Try again", "View technical details"]
    )
  },
  [ERROR_CODES.TIKTOK_CONNECT_FAILED]: {
    title: L("Không kết nối được TikTok", "Could not connect TikTok"),
    userMessage: L(
      "Không kết nối được livestream. Kiểm tra username đang live và mạng rồi thử lại.",
      "Could not connect to the livestream. Check the username is live and your network, then retry."
    ),
    recommendedActions: A(
      ["Thử lại", "Mở Kết nối", "Xem chi tiết kỹ thuật"],
      ["Try again", "Open Connections", "View technical details"]
    )
  },
  [ERROR_CODES.COMMENT_ID_REQUIRED]: {
    title: L("Thiếu ID bình luận", "Comment ID required"),
    userMessage: L(
      "Thao tác cần một bình luận hợp lệ.",
      "This action needs a valid comment."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.COMMENT_NOT_FOUND]: {
    title: L("Không tìm thấy bình luận", "Comment not found"),
    userMessage: L(
      "Bình luận có thể đã bị giới hạn khỏi danh sách. Làm mới trang Bình luận khách.",
      "The comment may have scrolled out of the capped list. Refresh Customer comments."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.COMMENT_ACCOUNT_ID_MISSING]: {
    title: L("Bình luận thiếu tài khoản", "Comment missing account"),
    userMessage: L(
      "Bình luận không có accountId nên bị bỏ qua để tránh lẫn shop.",
      "A comment without accountId was dropped to prevent cross-shop mix-ups."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.COMMENT_ACCOUNT_MISMATCH]: {
    title: L("Bình luận không thuộc tài khoản", "Comment account mismatch"),
    userMessage: L(
      "Thao tác đã chỉ sai tài khoản TikTok cho bình luận này.",
      "That action targeted the wrong TikTok account for this comment."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.KHEPREE_ACCESS_REQUIRED]: {
    title: L("Cần bản quyền Khepree", "Khepree license required"),
    userMessage: L(
      "Cần đăng nhập và có bản quyền đang hiệu lực để làm việc này.",
      "Sign in with an active Khepree license to continue."
    ),
    recommendedActions: signInKhepree
  },
  [ERROR_CODES.KHEPREE_FEATURE_NOT_ALLOWED]: {
    title: L("Gói chưa hỗ trợ tính năng này", "Plan does not include this feature"),
    userMessage: L(
      "Gói hiện tại không cho phép thao tác này. Kiểm tra gói trên Khepree hoặc nâng cấp.",
      "Your current plan does not allow this action. Check your Khepree plan or upgrade."
    ),
    recommendedActions: A(
      ["Mở thanh toán Khepree", "Làm mới trạng thái", "Xem chi tiết kỹ thuật"],
      ["Open Khepree billing", "Refresh status", "View technical details"]
    )
  },
  [ERROR_CODES.KHEPREE_SIGNING_KEY_MISSING]: {
    title: L("Thiếu khóa xác thực Khepree", "Khepree signing key missing"),
    userMessage: L(
      "Ứng dụng chưa cấu hình khóa xác thực lease. Liên hệ hỗ trợ hoặc kiểm tra cấu hình môi trường.",
      "Lease verification key is not configured. Contact support or check environment setup."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.NO_AUTH_TRANSACTION]: {
    title: L("Chưa bắt đầu đăng nhập", "Sign-in not started"),
    userMessage: L(
      "Hãy bấm đăng nhập Khepree trước, rồi hoàn tất trong trình duyệt.",
      "Start Khepree sign-in first, then finish in the browser."
    ),
    recommendedActions: signInKhepree
  },
  [ERROR_CODES.AUTH_TRANSACTION_EXPIRED]: {
    title: L("Phiên đăng nhập hết hạn", "Sign-in expired"),
    userMessage: L(
      "Thời gian đăng nhập đã hết. Hãy đăng nhập lại từ đầu.",
      "The sign-in window expired. Start sign-in again."
    ),
    recommendedActions: signInKhepree
  },
  [ERROR_CODES.AUTH_STATE_MISMATCH]: {
    title: L("Đăng nhập không khớp", "Sign-in mismatch"),
    userMessage: L(
      "Phản hồi đăng nhập không khớp phiên hiện tại. Thử đăng nhập lại.",
      "The sign-in response did not match this session. Try signing in again."
    ),
    recommendedActions: signInKhepree
  },
  [ERROR_CODES.AUTH_CODE_MISSING]: {
    title: L("Thiếu mã đăng nhập", "Missing sign-in code"),
    userMessage: L(
      "Khepree không trả mã đăng nhập. Thử lại hoặc kiểm tra redirect URI.",
      "Khepree did not return a sign-in code. Retry or check the redirect URI."
    ),
    recommendedActions: signInKhepree
  },
  [ERROR_CODES.INVALID_AUTH_CALLBACK]: {
    title: L("Callback đăng nhập không hợp lệ", "Invalid sign-in callback"),
    userMessage: L(
      "Liên kết quay lại app không đúng định dạng. Bắt đầu đăng nhập lại.",
      "The return link into the app was invalid. Start sign-in again."
    ),
    recommendedActions: signInKhepree
  },
  [ERROR_CODES.ACCESS_TOKEN_MISSING]: {
    title: L("Chưa có phiên đăng nhập", "No signed-in session"),
    userMessage: L(
      "Bạn chưa đăng nhập hoặc phiên đã mất. Đăng nhập Khepree để tiếp tục.",
      "You are not signed in, or the session was lost. Sign in to Khepree to continue."
    ),
    recommendedActions: signInKhepree
  },
  [ERROR_CODES.SAFE_STORAGE_UNAVAILABLE]: {
    title: L("Kho bảo mật Windows không dùng được", "Windows secure storage unavailable"),
    userMessage: L(
      "Ứng dụng cần kho bảo mật hệ thống để lưu phiên an toàn. Kiểm tra quyền Windows / tài khoản máy.",
      "The app needs OS secure storage for sessions. Check Windows permissions / machine account."
    ),
    recommendedActions: A(
      ["Kiểm tra quyền máy", "Thử lại", "Xem chi tiết kỹ thuật"],
      ["Check machine permissions", "Try again", "View technical details"]
    )
  },
  [ERROR_CODES.LEASE_EXPIRED]: {
    title: L("Lease hết hạn", "Lease expired"),
    userMessage: L(
      "Quyền truy cập tạm thời đã hết. Làm mới trạng thái hoặc đăng nhập lại.",
      "Temporary access expired. Refresh status or sign in again."
    ),
    recommendedActions: signInKhepree
  },
  [ERROR_CODES.LEASE_SIGNATURE_INVALID]: {
    title: L("Lease không hợp lệ", "Invalid lease"),
    userMessage: L(
      "Chữ ký bản quyền không khớp. Liên hệ hỗ trợ nếu lỗi lặp lại.",
      "License signature did not match. Contact support if this keeps happening."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.LEASE_DEVICE_MISMATCH]: {
    title: L("Thiết bị không khớp", "Device mismatch"),
    userMessage: L(
      "Bản quyền gắn với thiết bị khác. Đăng nhập lại trên máy này hoặc liên hệ hỗ trợ.",
      "This license is bound to another device. Sign in again on this PC or contact support."
    ),
    recommendedActions: signInKhepree
  },
  [ERROR_CODES.LEASE_PRODUCT_MISMATCH]: {
    title: L("Sản phẩm không khớp", "Product mismatch"),
    userMessage: L(
      "Lease không thuộc sản phẩm Livestream AI. Kiểm tra tài khoản Khepree.",
      "The lease is not for Livestream AI. Check your Khepree account."
    ),
    recommendedActions: signInKhepree
  },
  [ERROR_CODES.LEASE_KEY_ID_MISMATCH]: {
    title: L("Khóa lease không khớp", "Lease key mismatch"),
    userMessage: L(
      "Khóa xác thực lease không đúng phiên bản. Cần cập nhật cấu hình hoặc hỗ trợ.",
      "Lease key id does not match. Update configuration or contact support."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.LEASE_IAT_IN_FUTURE]: {
    title: L("Đồng hồ máy lệch", "Clock skew"),
    userMessage: L(
      "Thời gian trên máy có thể sai. Đồng bộ giờ Windows rồi thử lại.",
      "This PC clock may be wrong. Sync Windows time and try again."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.GEMINI_NOT_CONNECTED]: {
    title: L("Chưa kết nối Gemini", "Gemini not connected"),
    userMessage: L(
      "AI chưa sẵn sàng vì Gemini chưa được kết nối.",
      "AI is not ready because Gemini is not connected."
    ),
    recommendedActions: A(
      ["Mở Kết nối", "Thử lại", "Xem chi tiết kỹ thuật"],
      ["Open Connections", "Try again", "View technical details"]
    )
  },
  [ERROR_CODES.GEMINI_INIT_FAILED]: {
    title: L("Không kết nối được Gemini", "Could not connect Gemini"),
    userMessage: L(
      "Không hoàn tất đăng nhập Gemini. Thử lại: mở Kết nối → Kết nối Gemini, đăng nhập Google trong cửa sổ trình duyệt rồi quay lại app. Nếu vẫn lỗi, dùng Cài đặt nâng cao hoặc kiểm tra Python worker.",
      "Gemini sign-in did not finish. Try again: Connections → Connect Gemini, sign in to Google in the browser window, then return here. If it still fails, use Advanced settings or check the Python worker."
    ),
    recommendedActions: A(
      ["Kết nối lại Gemini", "Mở Kết nối", "Xem hướng dẫn cụ thể"],
      ["Connect Gemini again", "Open Connections", "View specific guide"]
    )
  },
  [ERROR_CODES.GEMINI_BROWSER_LOGIN_FAILED]: {
    title: L("Đăng nhập trình duyệt chưa thành công", "Browser sign-in did not succeed"),
    userMessage: L(
      "App cần bạn đăng nhập Google trong cửa sổ trình duyệt (không nhập mật khẩu trong app). Đóng cửa sổ cũ, bấm Đăng nhập lại, hoàn tất đăng nhập, rồi đợi app xác nhận.",
      "The app needs you to sign in to Google in a browser window (never type your password in this app). Close old windows, click Sign in again, finish login, then wait for confirmation."
    ),
    recommendedActions: A(
      ["Đăng nhập lại", "Mở Kết nối", "Xem chi tiết kỹ thuật"],
      ["Sign in again", "Open Connections", "View technical details"]
    )
  },
  [ERROR_CODES.GEMINI_TEST_FAILED]: {
    title: L("Kiểm tra Gemini chưa đạt", "Gemini connection test failed"),
    userMessage: L(
      "Đã kết nối nhưng Gemini không trả lời được câu thử. Thử chọn model khác hoặc đăng nhập lại.",
      "Connected, but Gemini did not answer the test prompt. Try another model or sign in again."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.GEMINI_SESSION_REQUIRED]: {
    title: L("Thiếu thông tin phiên nâng cao", "Advanced session required"),
    userMessage: L(
      "Cài đặt nâng cao cần mã phiên hợp lệ. Nếu bạn không chắc, hãy dùng nút Kết nối Gemini thông thường.",
      "Advanced settings need a valid session token. If you are unsure, use the normal Connect Gemini button instead."
    ),
    recommendedActions: A(
      ["Dùng Kết nối Gemini", "Mở Cài đặt", "Thử lại"],
      ["Use Connect Gemini", "Open Settings", "Try again"]
    )
  },
  [ERROR_CODES.GEMINI_REAUTH_REQUIRED]: {
    title: L("Cần đăng nhập lại Gemini", "Gemini re-login required"),
    userMessage: L(
      "Phiên Gemini đã hết hạn. Bấm Đăng nhập lại và hoàn tất đăng nhập Google trong trình duyệt (không nhập mật khẩu trong app).",
      "Your Gemini session expired. Click Sign in again and finish Google login in the browser (no password field in the app)."
    ),
    recommendedActions: A(
      ["Đăng nhập lại", "Mở Kết nối", "Xem chi tiết kỹ thuật"],
      ["Sign in again", "Open Connections", "View technical details"]
    )
  },
  [ERROR_CODES.GEMINI_GENERATION_FAILED]: {
    title: L("Gemini không tạo được phản hồi", "Gemini generation failed"),
    userMessage: L(
      "Yêu cầu tới Gemini thất bại. Thử lại hoặc đăng nhập lại tài khoản.",
      "The Gemini request failed. Retry or sign in again."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.GEMINI_DEPENDENCY_MISSING]: {
    title: L("Thiếu thư viện Gemini", "Gemini dependency missing"),
    userMessage: L(
      "Máy chưa cài đủ phần mềm Gemini cho worker. Mở thư mục workers/gemini_worker, chạy lệnh cài requirements, rồi Kết nối lại.",
      "This PC is missing the Gemini worker library. Open workers/gemini_worker, install requirements, then Connect again."
    ),
    recommendedActions: A(
      ["Cài dependencies worker", "Mở Kết nối", "Xem chi tiết kỹ thuật"],
      ["Install worker dependencies", "Open Connections", "View technical details"]
    )
  },
  [ERROR_CODES.GEMINI_QUOTA_EXCEEDED]: {
    title: L("Gemini hết hạn mức", "Gemini quota exceeded"),
    userMessage: L(
      "Tài khoản Gemini đã hết hạn mức tạm thời. Đợi hoặc dùng tài khoản khác.",
      "This Gemini account hit a temporary quota. Wait or use another account."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.GEMINI_CIRCUIT_OPEN]: {
    title: L("Gemini tạm dừng", "Gemini circuit open"),
    userMessage: L(
      "Nhiều lỗi liên tiếp — app tạm ngừng gọi Gemini để tránh spam. Thử lại sau ít phút.",
      "Repeated failures opened the circuit breaker so the app stops spamming Gemini. Try again in a few minutes."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.LLM_PROVIDER_INVALID]: {
    title: L("Provider AI không hợp lệ", "Invalid AI provider"),
    userMessage: L(
      "Chỉ hỗ trợ mock hoặc gemini-web.",
      "Only mock or gemini-web providers are supported."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.DATABASE_UNAVAILABLE]: {
    title: L("Cơ sở dữ liệu không sẵn sàng", "Database unavailable"),
    userMessage: L(
      "Không mở được kho dữ liệu cục bộ. Thử khởi động lại ứng dụng.",
      "Local database could not be opened. Restart the app and try again."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.DATABASE_WRITE_FAILED]: {
    title: L("Không lưu được dữ liệu", "Could not save data"),
    userMessage: L(
      "Ghi vào cơ sở dữ liệu thất bại. Kiểm tra dung lượng ổ đĩa và thử lại.",
      "A database write failed. Check disk space and try again."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.MEDIA_NOT_READY]: {
    title: L("Media chưa sẵn sàng", "Media not ready"),
    userMessage: L(
      "Giọng nói / hình ảnh AI chưa sẵn sàng trên máy này.",
      "Voice / AI video media is not ready on this machine."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.TTS_UNAVAILABLE]: {
    title: L("Chưa có giọng nói", "Voice unavailable"),
    userMessage: L(
      "Hệ thống TTS chưa được gắn. AI sẽ không nói trên livestream.",
      "TTS is not wired yet. AI will not speak on the livestream."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.AUDIO_DEVICE_COLLISION]: {
    title: L("Thiết bị âm thanh đang dùng chung", "Audio device already in use"),
    userMessage: L(
      "Thiết bị này đang được shop khác dùng. Chọn thiết bị khác hoặc ghi đè nâng cao nếu bạn cố ý dùng chung.",
      "Another shop already uses this device. Pick a different one, or use the advanced override if you intentionally share."
    ),
    recommendedActions: A(
      ["Mở Nhân vật & Giọng nói", "Chạy wizard âm thanh", "Xem chi tiết kỹ thuật"],
      ["Open Character & voice", "Run audio wizard", "View technical details"]
    )
  },
  [ERROR_CODES.AUDIO_ROUTING_NOT_READY]: {
    title: L("Chưa xong âm thanh livestream", "Livestream audio not ready"),
    userMessage: L(
      "Shop đang gửi âm thanh vào TikTok nhưng chưa chọn thiết bị. Chạy thiết lập âm thanh có hướng dẫn.",
      "This shop is set for TikTok audio but has no device yet. Run the guided audio setup."
    ),
    recommendedActions: A(
      ["Mở Nhân vật & Giọng nói", "Thiết lập âm thanh", "Xem chi tiết kỹ thuật"],
      ["Open Character & voice", "Set up audio", "View technical details"]
    )
  },
  [ERROR_CODES.VIRTUAL_CAMERA_UNAVAILABLE]: {
    title: L("Camera ảo chưa sẵn sàng", "Virtual camera unavailable"),
    userMessage: L(
      "Camera ảo / avatar chưa khởi động. Kiểm tra phần Media.",
      "Virtual camera / avatar is not running. Check Media setup."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.PYTHON_WORKER_NOT_STARTED]: {
    title: L("Worker Python chưa chạy", "Python worker not running"),
    userMessage: L(
      "Một tiến trình phụ trợ chưa khởi động. Thử lại hoặc khởi động lại app.",
      "A helper process has not started. Retry or restart the app."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.PYTHON_WORKER_SCRIPT_MISSING]: {
    title: L("Thiếu script worker", "Worker script missing"),
    userMessage: L(
      "Không tìm thấy file worker. Cài đặt lại hoặc kiểm tra gói ứng dụng.",
      "A worker script file is missing. Reinstall or check the app package."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.PYTHON_WORKER_STARTUP_TIMEOUT]: {
    title: L("Worker khởi động quá lâu", "Worker startup timeout"),
    userMessage: L(
      "Worker không kịp sẵn sàng. Kiểm tra CPU/GPU và thử lại.",
      "The worker did not become ready in time. Check CPU/GPU load and retry."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.BROWSER_SESSION_FAILED]: {
    title: L("Phiên trình duyệt lỗi", "Browser session failed"),
    userMessage: L(
      "Không điều khiển được trình duyệt LIVE Manager. Thử mở lại phiên.",
      "Could not control the LIVE Manager browser. Try opening the session again."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.SELECTOR_PACK_MISSING]: {
    title: L("Thiếu bộ chọn giao diện TikTok", "Selector pack missing"),
    userMessage: L(
      "Chưa có selector pack để bấm trên TikTok. Cập nhật kết nối TikTok.",
      "No selector pack is available for TikTok clicks. Update the TikTok connector."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.PERMISSION_DENIED]: {
    title: L("Không đủ quyền", "Permission denied"),
    userMessage: L(
      "Hệ thống từ chối thao tác. Kiểm tra quyền Windows hoặc chạy lại với quyền phù hợp.",
      "The system denied this action. Check Windows permissions."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.SAFE_STORAGE_PERMISSION]: {
    title: L("Không truy cập kho bảo mật", "Secure storage permission"),
    userMessage: L(
      "Ứng dụng không ghi được vào kho bảo mật. Kiểm tra chính sách máy.",
      "The app could not write to secure storage. Check machine policy."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.GPU_UNAVAILABLE]: {
    title: L("GPU không dùng được", "GPU unavailable"),
    userMessage: L(
      "Không phát hiện GPU phù hợp cho media/AI. Có thể chạy chậm hơn hoặc tắt một phần.",
      "No suitable GPU was found for media/AI. Some features may be slower or unavailable."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.GPU_DRIVER_ERROR]: {
    title: L("Lỗi driver GPU", "GPU driver error"),
    userMessage: L(
      "Driver GPU báo lỗi. Cập nhật driver rồi khởi động lại máy.",
      "The GPU driver reported an error. Update the driver and reboot."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.APPROVAL_NOT_PENDING]: {
    title: L("Mục xác nhận không còn chờ", "Approval item not pending"),
    userMessage: L(
      "Mục này đã được xử lý hoặc hết hạn. Làm mới danh sách xác nhận.",
      "This item was already handled or expired. Refresh the approval list."
    ),
    recommendedActions: A(
      ["Làm mới", "Về Điều khiển live", "Xem chi tiết kỹ thuật"],
      ["Refresh", "Go to Live control", "View technical details"]
    )
  },
  [ERROR_CODES.TITLE_REQUIRED]: {
    title: L("Thiếu tên sản phẩm", "Product name required"),
    userMessage: L(
      "Nhập tên sản phẩm trước khi lưu. AI cần tên để gắn câu trả lời.",
      "Enter a product name before saving. AI needs a title to ground replies."
    ),
    recommendedActions: A(
      ["Nhập tên sản phẩm", "Thử lại"],
      ["Enter product name", "Try again"]
    )
  },
  [ERROR_CODES.PRICE_INVALID]: {
    title: L("Giá không hợp lệ", "Invalid price"),
    userMessage: L(
      "Giá phải là số tiền hợp lệ (ví dụ 299.000đ hoặc $19.99), hoặc để trống.",
      "Price must be a valid amount (e.g. 299,000 VND or $19.99), or leave blank."
    ),
    recommendedActions: A(
      ["Sửa giá", "Thử lại"],
      ["Fix price", "Try again"]
    )
  },
  [ERROR_CODES.SOURCE_URL_INVALID]: {
    title: L("URL nguồn không hợp lệ", "Invalid source URL"),
    userMessage: L(
      "URL nguồn phải bắt đầu bằng http:// hoặc https://, hoặc để trống.",
      "Source URL must start with http:// or https://, or leave blank."
    ),
    recommendedActions: A(
      ["Sửa URL", "Thử lại"],
      ["Fix URL", "Try again"]
    )
  },
  [ERROR_CODES.PRODUCT_NOT_FOUND]: {
    title: L("Không tìm thấy sản phẩm", "Product not found"),
    userMessage: L(
      "Sản phẩm đã bị xóa hoặc không còn trong danh sách.",
      "The product was deleted or is no longer in the list."
    ),
    recommendedActions: A(
      ["Làm mới danh sách", "Thêm sản phẩm mới"],
      ["Refresh list", "Add a new product"]
    )
  },
  [ERROR_CODES.PRODUCT_ID_REQUIRED]: {
    title: L("Thiếu mã sản phẩm", "Product id required"),
    userMessage: L(
      "Không xác định được sản phẩm cần thao tác.",
      "Could not determine which product to act on."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.PRODUCT_INVALID]: {
    title: L("Sản phẩm không hợp lệ", "Invalid product"),
    userMessage: L(
      "Dữ liệu sản phẩm chưa đủ hoặc không hợp lệ. Kiểm tra lại form.",
      "Product data is incomplete or invalid. Check the form and try again."
    ),
    recommendedActions: A(
      ["Kiểm tra form", "Thử lại"],
      ["Check the form", "Try again"]
    )
  },
  [ERROR_CODES.LICENSE_MAX_CONCURRENT_LIVES]: {
    title: L("Đã đủ số livestream theo gói", "Plan live limit reached"),
    userMessage: L(
      "Gói hiện tại của bạn cho phép tối đa {max} livestream hoạt động cùng lúc.",
      "Your current plan allows at most {max} livestreams at the same time."
    ),
    recommendedActions: A(
      ["Dừng một livestream đang chạy", "Nâng cấp gói trên Khepree"],
      ["Stop a running livestream", "Upgrade your Khepree plan"]
    )
  },
  [ERROR_CODES.LICENSE_MAX_TIKTOK_ACCOUNTS]: {
    title: L("Đã đủ số tài khoản TikTok theo gói", "Plan account limit reached"),
    userMessage: L(
      "Gói hiện tại của bạn cho phép tối đa {max} tài khoản TikTok. Không xóa tài khoản cũ tự động.",
      "Your current plan allows at most {max} TikTok accounts. Existing accounts are not deleted."
    ),
    recommendedActions: A(
      ["Xóa bớt tài khoản không dùng (nếu muốn)", "Nâng cấp gói trên Khepree"],
      ["Remove unused accounts if you choose", "Upgrade your Khepree plan"]
    )
  },
  [ERROR_CODES.LICENSE_MULTI_LIVE_REQUIRED]: {
    title: L("Gói chưa hỗ trợ multi-live", "Plan does not include multi-live"),
    userMessage: L(
      "Gói hiện tại chỉ cho phép một livestream. Nâng cấp để chạy nhiều tài khoản cùng lúc.",
      "Your plan allows only one livestream. Upgrade to run multiple accounts at once."
    ),
    recommendedActions: A(
      ["Dừng livestream hiện tại", "Nâng cấp gói trên Khepree"],
      ["Stop the current livestream", "Upgrade your Khepree plan"]
    )
  },
  [ERROR_CODES.HARDWARE_RAM_LOW]: {
    title: L("Máy thiếu bộ nhớ", "Not enough memory"),
    userMessage: L(
      "Máy của bạn hiện không còn đủ bộ nhớ để mở thêm một livestream.",
      "Your computer does not have enough free memory to open another livestream."
    ),
    recommendedActions: A(
      ["Đóng ứng dụng khác", "Dừng một livestream đang chạy"],
      ["Close other apps", "Stop a running livestream"]
    )
  },
  [ERROR_CODES.HARDWARE_CPU_HIGH]: {
    title: L("CPU đang quá tải", "CPU overloaded"),
    userMessage: L(
      "Máy đang chạy gần hết công suất CPU nên chưa mở thêm livestream được.",
      "Your CPU is nearly saturated, so another livestream cannot start yet."
    ),
    recommendedActions: A(
      ["Đợi máy dịu lại", "Dừng một livestream đang chạy"],
      ["Wait for the machine to cool down", "Stop a running livestream"]
    )
  },
  [ERROR_CODES.HARDWARE_TOO_MANY_RUNTIMES]: {
    title: L("Máy không đủ sức cho thêm livestream", "Hardware live capacity reached"),
    userMessage: L(
      "Máy của bạn hiện không đủ tài nguyên để mở thêm một livestream (giới hạn phần cứng, không phải gói Khepree).",
      "Your machine cannot open another livestream right now (hardware limit, not your Khepree plan)."
    ),
    recommendedActions: A(
      ["Dừng một livestream đang chạy", "Kiểm tra RAM/CPU"],
      ["Stop a running livestream", "Check RAM/CPU"]
    )
  },
  [ERROR_CODES.HARDWARE_TOO_MANY_TIKTOK_WORKERS]: {
    title: L("Quá nhiều kết nối TikTok", "Too many TikTok workers"),
    userMessage: L(
      "Máy đang giữ quá nhiều kết nối TikTok. Hãy ngắt kết nối bớt trước khi mở thêm livestream.",
      "Too many TikTok connections are active. Disconnect some before starting another livestream."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.HARDWARE_TOO_MANY_BROWSER_CONTEXTS]: {
    title: L("Quá nhiều cửa sổ LIVE Manager", "Too many LIVE Manager windows"),
    userMessage: L(
      "Máy đang mở quá nhiều cửa sổ LIVE Manager. Đóng bớt rồi thử lại.",
      "Too many LIVE Manager windows are open. Close some and try again."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.HARDWARE_AI_QUEUE_BACKLOG]: {
    title: L("Hàng đợi AI quá dài", "AI queue backlog"),
    userMessage: L(
      "Hàng đợi AI đang quá dài nên máy chưa nhận thêm livestream mới.",
      "The AI queue is too long for another livestream to start safely."
    ),
    recommendedActions: A(
      ["Đợi AI xử lý bớt", "Dừng một livestream đang chạy"],
      ["Wait for the AI queue to drain", "Stop a running livestream"]
    )
  },
  [ERROR_CODES.HARDWARE_CAPACITY]: {
    title: L("Máy chưa đủ tài nguyên", "Hardware capacity reached"),
    userMessage: L(
      "Máy của bạn hiện không đủ tài nguyên để mở thêm livestream.",
      "Your machine does not have enough capacity for another livestream."
    ),
    recommendedActions: retryCheck
  },
  [ERROR_CODES.AVATAR_LIVE_GPU_DENIED]: {
    title: L("GPU không đủ cho nhân vật AI Live", "GPU cannot run another AI character live"),
    userMessage: L(
      "Máy không đủ GPU cho thêm nhân vật AI livestream. Hãy chọn Voice Only hoặc dừng một account avatar khác.",
      "There is not enough GPU capacity for another AI character livestream. Switch to Voice Only or stop another avatar account."
    ),
    recommendedActions: A(
      ["Chuyển sang Voice Only", "Dừng một livestream nhân vật AI đang chạy", "Giảm chất lượng avatar (LIGHT)"],
      ["Switch to Voice Only", "Stop another AI character livestream", "Lower avatar quality (LIGHT)"]
    )
  },
  [ERROR_CODES.UNKNOWN]: {
    title: L("Đã xảy ra lỗi", "Something went wrong"),
    userMessage: L(
      "Ứng dụng gặp lỗi không xác định. Thử lại; nếu vẫn lỗi, gửi mã kỹ thuật cho hỗ trợ.",
      "An unexpected error occurred. Retry; if it persists, send the technical code to support."
    ),
    recommendedActions: retryCheck
  }
};

export function getErrorCopy(code: string): ErrorCopy {
  return ERROR_COPY[code] ?? ERROR_COPY[ERROR_CODES.UNKNOWN]!;
}
