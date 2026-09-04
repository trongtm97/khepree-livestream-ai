import type { AppTab } from "../app/types";
import type { HelpArticle, MicroTip, PageGuide } from "./types";

export const MICRO_TIPS: MicroTip[] = [
  {
    id: "mode.supervised_auto",
    title: {
      vi: "Tự động có giám sát",
      en: "Supervised Auto"
    },
    body: {
      vi: "AI có thể tự thực hiện những câu trả lời an toàn sau vài giây. Trong thời gian chờ, bạn có thể sửa hoặc hủy. Đây là chế độ mặc định — bạn vẫn giữ quyền kiểm soát.",
      en: "AI can auto-run safe replies after a few seconds. During the countdown you can edit or cancel. This is the default mode — you stay in control."
    }
  },
  {
    id: "mode.manual_assist",
    title: {
      vi: "Trợ lý thủ công",
      en: "Manual Assist"
    },
    body: {
      vi: "AI chỉ soạn gợi ý. Không có gì được gửi ra livestream cho đến khi bạn bấm duyệt.",
      en: "AI only drafts suggestions. Nothing goes to the livestream until you approve."
    }
  },
  {
    id: "control.start_ai",
    title: {
      vi: "Bắt đầu trợ lý AI",
      en: "Start AI assistant"
    },
    body: {
      vi: "Bật vòng lặp trợ lý trên máy của bạn. AI sẽ đọc sự kiện (khi đã kết nối) và đưa việc vào danh sách xác nhận. Cần bản quyền Khepree đang hiệu lực.",
      en: "Starts the local assistant loop. AI reads events (once connected) and queues items for approval. An active Khepree license is required."
    }
  },
  {
    id: "approval.queue",
    title: {
      vi: "Danh sách xác nhận",
      en: "Approval queue"
    },
    body: {
      vi: "Mỗi thẻ hiện khách, câu hỏi, câu AI dự định nói, độ tin cậy, lý do và rủi ro. Nói ngay / Sửa / Bỏ qua / Dừng tự động. Countdown có thể hủy; Esc hủy auto gần nhất. Claim y tế, pháp lý, thiếu fact, hoàn tiền, bảo hành không bao giờ tự chạy.",
      en: "Each card shows the viewer, question, planned AI speech, confidence, reason, and risks. Speak now / Edit / Skip / Stop auto. Cancel the countdown anytime; Esc cancels the nearest auto. Medical, legal, unknown-fact, refund, and warranty items never auto-run."
    }
  },
  {
    id: "products.facts",
    title: {
      vi: "Thông tin sản phẩm",
      en: "Product information"
    },
    body: {
      vi: "AI chỉ được nói giá, size, màu và cam kết mà bạn đã nhập. Thiếu thông tin thì AI phải hỏi bạn thay vì bịa.",
      en: "AI may only state prices, sizes, colors, and claims you entered. If a fact is missing, it should ask you instead of inventing it."
    }
  },
  {
    id: "connections.khepree",
    title: {
      vi: "Bản quyền Khepree",
      en: "Khepree license"
    },
    body: {
      vi: "Đăng nhập để xác nhận bạn được phép dùng phần mềm trên máy này. Không có bản quyền thì không bật được trợ lý AI.",
      en: "Sign in to confirm you may use the software on this device. Without a license, the AI assistant stays locked."
    }
  }
];

export const PAGE_GUIDES: PageGuide[] = [
  {
    pageId: "overview",
    title: { vi: "Hướng dẫn: Tổng quan", en: "Guide: Overview" },
    sections: [
      {
        heading: { vi: "Trang này để làm gì?", en: "What is this page for?" },
        body: {
          vi: "Cho bạn biết ngay phần mềm đã sẵn sàng bán hàng chưa: bản quyền, AI, TikTok, sản phẩm, giọng nói, camera.",
          en: "Shows at a glance whether you are ready to sell: license, AI, TikTok, products, voice, and camera."
        }
      },
      {
        heading: { vi: "Màu vàng nghĩa là gì?", en: "What does yellow mean?" },
        body: {
          vi: "Mục đó chưa xong thật. Phần mềm không giả vờ đã kết nối. Hãy vào Kết nối hoặc Sản phẩm để bổ sung.",
          en: "That item is truly unfinished. The app will not pretend it is connected. Go to Connections or Products to finish it."
        }
      },
      {
        heading: { vi: "Khi nào nên mở Livestream?", en: "When should I open Livestream?" },
        body: {
          vi: "Ít nhất đã đăng nhập Khepree và có sản phẩm. Gemini, TikTok, giọng nói nên sẵn sàng trước khi bán hàng thật.",
          en: "At least sign in to Khepree and add products. Gemini, TikTok, and voice should be ready before a real selling stream."
        }
      }
    ]
  },
  {
    pageId: "live",
    title: { vi: "Hướng dẫn: Livestream", en: "Guide: Livestream" },
    sections: [
      {
        heading: { vi: "Bạn làm gì ở đây?", en: "What do you do here?" },
        body: {
          vi: "Bật/tắt trợ lý AI, chọn chế độ giám sát, duyệt câu trả lời và theo dõi tình trạng hệ thống.",
          en: "Start/stop the AI assistant, choose supervision mode, approve replies, and watch system status."
        }
      },
      {
        heading: { vi: "Danh sách xác nhận", en: "Approval queue" },
        body: {
          vi: "Mọi việc AI muốn nói hoặc làm đều qua đây. Duyệt nếu đúng, từ chối nếu sai hoặc thiếu thông tin sản phẩm.",
          en: "Everything the AI wants to say or do passes through here. Approve when correct; reject when wrong or missing product facts."
        }
      },
      {
        heading: { vi: "Chế độ tự động có giám sát", en: "Supervised Auto" },
        body: {
          vi: "Câu trả lời an toàn có thể tự chạy sau vài giây. Bạn vẫn hủy hoặc sửa được trong lúc chờ.",
          en: "Safe replies may auto-run after a few seconds. You can still cancel or edit during the wait."
        }
      }
    ]
  },
  {
    pageId: "products",
    title: { vi: "Hướng dẫn: Sản phẩm", en: "Guide: Products" },
    sections: [
      {
        heading: { vi: "Vì sao cần nhập thông tin sản phẩm?", en: "Why enter product information?" },
        body: {
          vi: "Để AI tư vấn đúng giá, size, màu và cam kết — không bịa thông tin khi khách hỏi trên livestream.",
          en: "So AI can answer with correct price, size, color, and claims — without inventing facts when shoppers ask on livestream."
        }
      },
      {
        heading: { vi: "AI sẽ dùng dữ liệu nào?", en: "Which data does AI use?" },
        body: {
          vi: "AI chỉ được dùng thông tin bạn lưu trong danh sách sản phẩm (tên, giá, và các trường bạn bổ sung sau này như size/màu/FAQ).",
          en: "AI may only use what you saved in the product list (name, price, and later fields such as size/color/FAQ)."
        }
      },
      {
        heading: { vi: "Điều gì xảy ra nếu thiếu giá?", en: "What if price is missing?" },
        body: {
          vi: "AI không được tự đặt giá. Nó nên hỏi bạn hoặc trả lời rằng chưa có thông tin giá trong hệ thống.",
          en: "AI must not invent a price. It should ask you or say that price information is not available yet."
        }
      },
      {
        heading: { vi: "Cách thêm size/màu", en: "How to add size/color" },
        body: {
          vi: "Bản hiện tại mới nhập nhanh tên và giá. Form size/màu đầy đủ sẽ có ở bước sau — đừng giả vờ đã có nếu chưa thấy trên form.",
          en: "This build only has a quick name/price form. Full size/color editing comes later — do not assume it exists until you see it on the form."
        }
      },
      {
        heading: { vi: "Ví dụ thực tế", en: "Practical example" },
        body: {
          vi: "Ví dụ: “Áo thun cotton” — giá “299.000đ”. Khi khách hỏi giá, AI chỉ được nhắc đúng số này.",
          en: "Example: “Cotton t-shirt” — price “299,000 VND”. When a shopper asks for the price, AI may only repeat that figure."
        }
      }
    ]
  },
  {
    pageId: "connections",
    title: { vi: "Hướng dẫn: Kết nối", en: "Guide: Connections" },
    sections: [
      {
        heading: { vi: "Khepree", en: "Khepree" },
        body: {
          vi: "Đăng nhập để mở khóa trợ lý AI và mua/gia hạn gói. Đây là bước bắt buộc trước khi bán hàng.",
          en: "Sign in to unlock the AI assistant and buy/renew plans. This is required before selling."
        }
      },
      {
        heading: { vi: "Gemini", en: "Gemini" },
        body: {
          vi: "Bộ não hiểu câu hỏi khách. Nếu chưa kết nối thật, phần mềm có thể dùng AI thử nghiệm — Tổng quan sẽ báo rõ.",
          en: "The brain that understands shopper questions. If real Gemini is not connected, a trial AI may run — Overview shows this honestly."
        }
      },
      {
        heading: { vi: "TikTok", en: "TikTok" },
        body: {
          vi: "Để nhận bình luận livestream. Nếu chưa bật, sẽ không có luồng bình luận thật — đừng tưởng đã kết nối.",
          en: "Receives livestream comments. If not enabled, there is no real comment feed — do not assume you are connected."
        }
      }
    ]
  },
  {
    pageId: "settings",
    title: { vi: "Hướng dẫn: Cài đặt", en: "Guide: Settings" },
    sections: [
      {
        heading: { vi: "Ngôn ngữ", en: "Language" },
        body: {
          vi: "Đổi Tiếng Việt / English. Lựa chọn được lưu trên máy, dùng được khi offline.",
          en: "Switch Vietnamese / English. The choice is saved on this device and works offline."
        }
      },
      {
        heading: { vi: "Hướng dẫn ban đầu", en: "First-run guide" },
        body: {
          vi: "Chạy lại wizard thiết lập nếu bạn muốn xem lại các bước từ đầu.",
          en: "Replay the setup wizard if you want to walk through the steps again from the start."
        }
      }
    ]
  },
  {
    pageId: "help",
    title: { vi: "Hướng dẫn: Trung tâm trợ giúp", en: "Guide: Help Center" },
    sections: [
      {
        heading: { vi: "Cách dùng", en: "How to use" },
        body: {
          vi: "Gõ từ khóa để tìm bài (Gemini, TikTok, mất kết nối…). Mọi bài nằm trong máy — không cần internet.",
          en: "Type keywords to find articles (Gemini, TikTok, disconnected…). All articles are on-device — no internet required."
        }
      }
    ]
  },
  {
    pageId: "comments",
    title: { vi: "Hướng dẫn: Bình luận khách", en: "Guide: Customer comments" },
    sections: [
      {
        heading: { vi: "Nguồn thật", en: "Real feed only" },
        body: {
          vi: "Bình luận chỉ xuất hiện sau khi TikTokLive nối Event Bus. Không có dữ liệu giả trên trang này.",
          en: "Comments appear only after TikTokLive publishes to the Event Bus. This page never shows fake data."
        }
      },
      {
        heading: { vi: "Ưu tiên & lọc", en: "Priority & filters" },
        body: {
          vi: "Độ ưu tiên và ý định (mua / hỏi sản phẩm) do CommentPriority ở main tính. Dùng bộ lọc và nút Ưu tiên trả lời để xếp hàng xử lý.",
          en: "Priority and intent (purchase / product question) come from CommentPriority in main. Use filters and Prioritize reply to manage the queue."
        }
      }
    ]
  },
  {
    pageId: "script",
    title: { vi: "Hướng dẫn: Kịch bản AI", en: "Guide: AI script" },
    sections: [
      {
        heading: { vi: "Sắp có", en: "Coming soon" },
        body: {
          vi: "Bạn sẽ chỉnh thứ tự chào → giới thiệu → giá → chốt đơn. Trang chỉnh sửa đầy đủ chưa mở.",
          en: "You will edit welcome → intro → price → checkout order. The full editor is not open yet."
        }
      }
    ]
  },
  {
    pageId: "avatar",
    title: { vi: "Hướng dẫn: Nhân vật AI", en: "Guide: AI character" },
    sections: [
      {
        heading: { vi: "Thư viện nhân vật", en: "Character library" },
        body: {
          vi: "Mỗi thẻ hiện ảnh xem thử, tên, engine và trạng thái (Sẵn sàng / Cần xử lý / Đang xử lý / Lỗi). Bấm «Tạo nhân vật» để mở wizard.",
          en: "Each card shows preview, name, engine, and status (Ready / Needs processing / Processing / Error). Click «Create character» for the wizard."
        }
      },
      {
        heading: { vi: "Giọng nói", en: "Voice" },
        body: {
          vi: "Tab «Giọng nói» vẫn chỉnh TTS và âm thanh livestream theo từng gian.",
          en: "The «Voice» tab still configures TTS and livestream audio per shop."
        }
      },
      {
        heading: { vi: "Bài viết chi tiết", en: "Full article" },
        body: {
          vi: "Mở Help Center → «Tạo nhân vật AI từ video».",
          en: "Open Help Center → «Create an AI character from video»."
        }
      }
    ]
  },
  {
    pageId: "logs",
    title: { vi: "Hướng dẫn: Nhật ký", en: "Guide: Activity log" },
    sections: [
      {
        heading: { vi: "Sắp có", en: "Coming soon" },
        body: {
          vi: "Sau này bạn xem lại câu AI đã nói, lần duyệt, và lỗi kết nối. File nhật ký chưa có trong bản này.",
          en: "Later you will review AI speech, approvals, and connection errors. File logging is not in this build yet."
        }
      }
    ]
  }
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "avatar-create",
    title: {
      vi: "Tạo nhân vật AI từ video",
      en: "Create an AI character from video"
    },
    summary: {
      vi: "Chọn video mặt rõ, xử lý một lần, thử nói mẫu, rồi lưu vào thư viện — không cần biết thông số model.",
      en: "Pick a clear face video, process once, try a sample line, then save — no model jargon required."
    },
    keywords: [
      "avatar",
      "nhân vật",
      "character",
      "video",
      "preprocess",
      "mặt",
      "face",
      "wizard",
      "thư viện",
      "library"
    ],
    sections: [
      {
        heading: { vi: "Video thế nào là tốt?", en: "What makes a good video?" },
        body: {
          vi: "Nhìn rõ mặt, ánh sáng đủ, không che miệng, và đủ dài để nhân vật nói tự nhiên. Không cần chỉnh thông số kỹ thuật.",
          en: "Face clearly visible, good light, mouth uncovered, and long enough for natural speech. You do not set model parameters."
        }
      },
      {
        heading: { vi: "Các bước wizard", en: "Wizard steps" },
        body: {
          vi: "1) Chọn video → 2) Xem trước → 3) Engine (mặc định tự động) → 4) Xử lý có progress → 5) Nói câu mẫu → 6) Lưu. UI không đóng băng khi xử lý.",
          en: "1) Choose video → 2) Preview → 3) Engine (auto by default) → 4) Process with progress → 5) Sample speech → 6) Save. The UI stays responsive while processing."
        }
      },
      {
        heading: { vi: "Xóa & nhân bản", en: "Delete & duplicate" },
        body: {
          vi: "Không xóa được nhân vật đang dùng trong livestream. Nhân bản chỉ copy hồ sơ — không copy cache model nặng nếu không cần.",
          en: "You cannot delete a character used in a live session. Duplicate copies the profile — it does not copy heavy model cache unless needed."
        }
      },
      {
        heading: { vi: "Đổi video nguồn", en: "When the source video changes" },
        body: {
          vi: "Nếu file nguồn thay đổi, Khepree nhận ra qua checksum và đánh dấu «Cần xử lý» lại — không dùng cache cũ.",
          en: "If the source file changes, Khepree detects it via checksum and marks the character «Needs processing» — old cache is not reused."
        }
      }
    ]
  },
  {
    id: "audio-routing-tiktok",
    title: {
      vi: "Thiết lập âm thanh AI cho TikTok",
      en: "Set up AI audio for TikTok"
    },
    summary: {
      vi: "Hướng dẫn người bán đưa giọng AI vào livestream qua thiết bị âm thanh riêng — không cần biết thuật ngữ kỹ thuật.",
      en: "Seller guide to route AI voice into livestream via a dedicated audio device — no jargon required."
    },
    keywords: [
      "âm thanh",
      "microphone",
      "mic",
      "cable",
      "ảo",
      "virtual",
      "tiktok",
      "livestream",
      "giọng",
      "audio",
      "routing",
      "loa"
    ],
    sections: [
      {
        heading: { vi: "Vì sao cần thiết bị riêng?", en: "Why a dedicated device?" },
        body: {
          vi: "TikTok nhận giọng AI giống như một microphone. Nếu phát ra loa máy, khách trên livestream không nghe được (hoặc bạn bị lộ giọng AI ngoài ý muốn).",
          en: "TikTok treats AI audio like a microphone input. Playing only on PC speakers means viewers hear nothing (or you leak AI speech locally by accident)."
        }
      },
      {
        heading: { vi: "Làm theo wizard", en: "Follow the wizard" },
        body: {
          vi: "Vào Nhân vật & Giọng nói → chọn shop → «Thiết lập âm thanh có hướng dẫn». Chọn gửi vào Livestream TikTok, chọn thiết bị cho shop đó, phát thử, rồi chỉnh microphone trong TikTok LIVE Manager cho khớp.",
          en: "Open Character & voice → pick the shop → «Guided audio setup». Choose send into TikTok Livestream, pick that shop’s device, play a sample, then match the microphone in TikTok LIVE Manager."
        }
      },
      {
        heading: { vi: "Mỗi shop một thiết bị", en: "One device per shop" },
        body: {
          vi: "Không dùng chung một thiết bị cho hai shop. Phần mềm sẽ cảnh báo nếu bạn chọn trùng — tránh hai livestream phát nhầm giọng.",
          en: "Do not share one device across two shops. The app warns on collisions so two livestreams do not mix voices."
        }
      },
      {
        heading: { vi: "Chỉ nghe thử trên máy", en: "PC preview only" },
        body: {
          vi: "Nếu bạn chưa livestream, chọn «Chỉ nghe thử trên máy». Khi đó không bắt buộc cable ảo để bật trợ lý.",
          en: "If you are not streaming yet, choose «Preview on this PC only». A virtual cable is not required to run the assistant."
        }
      }
    ]
  },
  {
    id: "getting-started",
    title: { vi: "Bắt đầu sử dụng", en: "Getting started" },
    summary: {
      vi: "Thứ tự làm việc cho người mới: bản quyền → sản phẩm → kết nối → livestream có giám sát.",
      en: "A beginner path: license → products → connections → supervised livestream."
    },
    keywords: ["bắt đầu", "mới", "onboarding", "getting started", "start", "hướng dẫn"],
    sections: [
      {
        heading: { vi: "1. Đăng nhập Khepree", en: "1. Sign in to Khepree" },
        body: {
          vi: "Vào Kết nối → Đăng nhập. Không có bản quyền thì không bật trợ lý AI.",
          en: "Open Connections → Sign in. Without a license the AI assistant stays locked."
        }
      },
      {
        heading: { vi: "2. Thêm sản phẩm", en: "2. Add products" },
        body: {
          vi: "Nhập đúng tên và giá. AI chỉ nói những gì bạn đã lưu.",
          en: "Enter correct names and prices. AI may only state what you saved."
        }
      },
      {
        heading: { vi: "3. Xem Tổng quan", en: "3. Check Overview" },
        body: {
          vi: "Các mục vàng là chưa xong. Đừng livestream bán hàng thật khi TikTok/giọng nói vẫn thiếu.",
          en: "Yellow items are unfinished. Do not run a real selling stream while TikTok/voice are still missing."
        }
      },
      {
        heading: { vi: "4. Mở Livestream", en: "4. Open Livestream" },
        body: {
          vi: "Bật trợ lý AI và duyệt câu trả lời trong danh sách xác nhận.",
          en: "Start the AI assistant and approve replies in the approval queue."
        }
      }
    ]
  },
  {
    id: "connect-khepree",
    title: { vi: "Kết nối Khepree", en: "Connect Khepree" },
    summary: {
      vi: "Đăng nhập, kích hoạt thiết bị, và hiểu trạng thái bản quyền.",
      en: "Sign in, activate the device, and understand license status."
    },
    keywords: ["khepree", "bản quyền", "license", "đăng nhập", "login", "gói", "billing"],
    sections: [
      {
        heading: { vi: "Cách đăng nhập", en: "How to sign in" },
        body: {
          vi: "Nhấn Đăng nhập Khepree. Trình duyệt hệ thống mở trang tài khoản. Sau khi xong, app nhận kết quả và hiện trạng thái đã kích hoạt (nếu có gói).",
          en: "Click Sign in to Khepree. Your system browser opens the account page. When done, the app receives the result and shows Active if you have a plan."
        }
      },
      {
        heading: { vi: "Nếu báo chưa có bản quyền", en: "If it says no license" },
        body: {
          vi: "Mua gói Tháng/Năm trên Khepree rồi tải lại. Trial có thể được cấp theo quy trình tài khoản.",
          en: "Buy a Monthly/Yearly plan on Khepree, then reload. Trial may be granted through account ops."
        }
      }
    ]
  },
  {
    id: "connect-gemini",
    title: { vi: "Kết nối Gemini", en: "Connect Gemini" },
    summary: {
      vi: "Gemini là bộ não trả lời khách. Bản hiện tại có thể chưa nối thật.",
      en: "Gemini is the answer brain. This build may not have a real connection yet."
    },
    keywords: ["gemini", "ai", "não", "brain", "cookie", "google"],
    sections: [
      {
        heading: { vi: "Gemini dùng để làm gì?", en: "What is Gemini for?" },
        body: {
          vi: "Hiểu câu hỏi khách và soạn ActionProposal (câu nói / hành động) để bạn duyệt.",
          en: "Understanding shopper questions and drafting ActionProposals (speech/actions) for your approval."
        }
      },
      {
        heading: { vi: "Nếu chưa kết nối", en: "If not connected" },
        body: {
          vi: "Tổng quan sẽ hiện chưa kết nối. App có thể dùng AI thử nghiệm — không phải Gemini production.",
          en: "Overview shows not connected. The app may use trial AI — not production Gemini."
        }
      }
    ]
  },
  {
    id: "connect-tiktok",
    title: { vi: "Kết nối TikTok", en: "Connect TikTok" },
    summary: {
      vi: "Nhập @username, kết nối livestream — comment/like/gift vào Event Bus.",
      en: "Enter @username, connect livestream — comments/likes/gifts enter the Event Bus."
    },
    keywords: ["tiktok", "bình luận", "comment", "live", "webcast", "mất kết nối", "reconnect"],
    sections: [
      {
        heading: { vi: "Cách kết nối", en: "How to connect" },
        body: {
          vi: "Mở Kết nối → nhập username (không cần @) → Kết nối Livestream khi phòng đang live. Worker TikTokLive sẽ poll event và publish lên Event Bus.",
          en: "Open Connections → enter username (no @ needed) → Connect livestream while the room is live. The TikTokLive worker polls events and publishes to the Event Bus."
        }
      },
      {
        heading: { vi: "Mất kết nối", en: "If it drops" },
        body: {
          vi: "App tự thử lại với backoff (2s → 60s). Bấm Ngắt kết nối để dừng. Event không bao giờ gọi Gemini trực tiếp.",
          en: "The app retries with backoff (2s → 60s). Click Disconnect to stop. Events never call Gemini directly."
        }
      }
    ]
  },
  {
    id: "add-product",
    title: { vi: "Thêm sản phẩm", en: "Add products" },
    summary: {
      vi: "Nguồn sự thật để AI không nói sai giá.",
      en: "The source of truth so AI does not invent prices."
    },
    keywords: ["sản phẩm", "product", "giá", "price", "size", "màu", "dna"],
    sections: [
      {
        heading: { vi: "Nhập tối thiểu", en: "Minimum to enter" },
        body: {
          vi: "Tên sản phẩm và giá hiển thị. Sau này sẽ thêm size, màu, FAQ, cam kết cấm nói.",
          en: "Product name and display price. Later: size, color, FAQ, forbidden claims."
        }
      },
      {
        heading: { vi: "Thiếu giá", en: "Missing price" },
        body: {
          vi: "AI không được tự bịa. Nó phải hỏi bạn hoặc nói chưa có thông tin.",
          en: "AI must not invent it. It should ask you or say the information is unavailable."
        }
      }
    ]
  },
  {
    id: "prepare-livestream",
    title: { vi: "Chuẩn bị livestream", en: "Prepare a livestream" },
    summary: {
      vi: "Checklist trước khi lên sóng: bản quyền, sản phẩm, AI, TikTok, giọng nói.",
      en: "Pre-stream checklist: license, products, AI, TikTok, voice."
    },
    keywords: ["chuẩn bị", "prepare", "checklist", "sẵn sàng", "ready", "livestream"],
    sections: [
      {
        heading: { vi: "Trước khi bấm bắt đầu", en: "Before you start" },
        body: {
          vi: "Mở Tổng quan. Ưu tiên làm xanh: Khepree, sản phẩm, Gemini, TikTok. Giọng nói/camera nếu đã có.",
          en: "Open Overview. Prefer green checks for Khepree, products, Gemini, TikTok. Voice/camera when available."
        }
      }
    ]
  },
  {
    id: "start-ai",
    title: { vi: "Bắt đầu AI", en: "Start AI" },
    summary: {
      vi: "Cách bật trợ lý và hiểu nó đang chạy.",
      en: "How to start the assistant and know it is running."
    },
    keywords: ["bắt đầu", "start ai", "trợ lý", "assistant", "start"],
    sections: [
      {
        heading: { vi: "Trên trang Livestream", en: "On the Livestream page" },
        body: {
          vi: "Nhấn Bắt đầu trợ lý AI. Cần bản quyền ACTIVE. Trạng thái sẽ chuyển sang Đang chạy.",
          en: "Click Start AI assistant. Requires an ACTIVE license. Status becomes Running."
        }
      },
      {
        heading: { vi: "Dừng", en: "Stop" },
        body: {
          vi: "Nhấn Dừng trợ lý AI bất cứ lúc nào. Việc đang chờ vẫn có thể hủy/từ chối.",
          en: "Click Stop AI assistant anytime. Pending items can still be cancelled/rejected."
        }
      }
    ]
  },
  {
    id: "approval-queue",
    title: { vi: "Hiểu danh sách xác nhận", en: "Understand the approval queue" },
    summary: {
      vi: "AI không nói thẳng ra livestream — mọi việc qua bạn.",
      en: "AI does not speak straight to livestream — everything goes through you."
    },
    keywords: ["xác nhận", "approval", "duyệt", "approve", "từ chối", "reject", "countdown"],
    sections: [
      {
        heading: { vi: "Duyệt / Từ chối", en: "Approve / Reject" },
        body: {
          vi: "Duyệt nếu nội dung đúng sản phẩm. Từ chối nếu sai giá, sai cam kết, hoặc chưa chắc.",
          en: "Approve when product facts are correct. Reject wrong prices, bad claims, or uncertainty."
        }
      },
      {
        heading: { vi: "Tự động có giám sát", en: "Supervised auto" },
        body: {
          vi: "Việc an toàn có thể tự duyệt sau vài giây. Hãy nhìn đồng hồ đếm và hủy nếu cần.",
          en: "Safe items may auto-approve after a few seconds. Watch the countdown and cancel if needed."
        }
      }
    ]
  },
  {
    id: "takeover-ai",
    title: { vi: "Tiếp quản AI", en: "Take over from AI" },
    summary: {
      vi: "Bạn luôn có quyền dừng AI và tự nói.",
      en: "You can always stop AI and speak yourself."
    },
    keywords: ["tiếp quản", "takeover", "dừng", "stop", "không nói", "mute", "hotkey"],
    sections: [
      {
        heading: { vi: "Hiện tại", en: "Today" },
        body: {
          vi: "Dừng trợ lý AI trên trang Livestream và từ chối các việc trong hàng chờ. Hotkey takeover đầy đủ sẽ có sau.",
          en: "Stop the AI assistant on Livestream and reject queued items. A full takeover hotkey comes later."
        }
      },
      {
        heading: { vi: "Nguyên tắc", en: "Principle" },
        body: {
          vi: "Không để AI nói khi bạn đang xử lý tình huống nhạy cảm. Người bán giữ quyết định cuối.",
          en: "Do not let AI speak during sensitive moments. The seller keeps the final decision."
        }
      }
    ]
  },
  {
    id: "troubleshooting",
    title: { vi: "Khắc phục lỗi", en: "Troubleshooting" },
    summary: {
      vi: "Mất kết nối, không bật AI, Gemini/TikTok chưa sẵn sàng.",
      en: "Disconnected, cannot start AI, Gemini/TikTok not ready."
    },
    keywords: [
      "lỗi",
      "error",
      "mất kết nối",
      "disconnected",
      "không mở",
      "fail",
      "khắc phục",
      "troubleshoot"
    ],
    sections: [
      {
        heading: { vi: "Không bật được trợ lý AI", en: "Cannot start AI assistant" },
        body: {
          vi: "Kiểm tra Tổng quan → Bản quyền Khepree phải Đã kích hoạt. Đăng nhập lại nếu phiên hết hạn.",
          en: "Check Overview → Khepree license must be Active. Sign in again if the session expired."
        }
      },
      {
        heading: { vi: "Không thấy bình luận", en: "No comments" },
        body: {
          vi: "TikTok chưa kết nối thật trong bản này. Đó là bình thường — không phải do bạn làm sai bước ẩn.",
          en: "TikTok is not really connected in this build. That is expected — not a hidden misconfiguration on your side."
        }
      },
      {
        heading: { vi: "AI nói sai giá", en: "AI said the wrong price" },
        body: {
          vi: "Từ chối ngay trong danh sách xác nhận. Sửa giá sản phẩm cho đúng rồi thử lại.",
          en: "Reject immediately in the approval queue. Fix the saved product price, then try again."
        }
      }
    ]
  },
  {
    id: "common-statuses",
    title: { vi: "Các trạng thái thường gặp", en: "Common statuses" },
    summary: {
      vi: "Giải thích trạng thái bản quyền, livestream và hệ thống bằng lời người bán.",
      en: "Seller-friendly meanings of license, livestream, and system statuses."
    },
    keywords: ["trạng thái", "status", "active", "down", "degraded", "running", "stopped", "đang chạy"],
    sections: [
      {
        heading: { vi: "Bản quyền", en: "License" },
        body: {
          vi: "Đã kích hoạt = dùng được trợ lý. Cần đăng nhập / Chưa có bản quyền = chưa mở khóa. Hết hạn / tạm khóa = cần gia hạn hoặc liên hệ hỗ trợ.",
          en: "Active = assistant unlocked. Sign-in required / No license = still locked. Expired / suspended = renew or contact support."
        }
      },
      {
        heading: { vi: "Livestream AI", en: "Livestream AI" },
        body: {
          vi: "Đang chạy = trợ lý đang lắng nghe/xử lý. Đã dừng = bạn đã tắt vòng lặp.",
          en: "Running = assistant loop is on. Stopped = you turned the loop off."
        }
      },
      {
        heading: { vi: "Tình trạng hệ thống", en: "System status" },
        body: {
          vi: "Ổn = hoạt động. Không ổn định = còn chạy nhưng kém. Ngắt = phần đó không dùng được.",
          en: "OK = working. Unstable = running poorly. Down = that part is unavailable."
        }
      }
    ]
  }
];

export function getMicroTip(id: string): MicroTip | undefined {
  return MICRO_TIPS.find((tip) => tip.id === id);
}

export function getPageGuide(pageId: AppTab): PageGuide | undefined {
  return PAGE_GUIDES.find((guide) => guide.pageId === pageId);
}

export function getHelpArticle(id: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.id === id);
}

export function listHelpArticles(): HelpArticle[] {
  return HELP_ARTICLES;
}
