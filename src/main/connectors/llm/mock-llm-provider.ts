import { randomUUID } from "node:crypto";
import type { ActionProposal, RuntimeHealth } from "../../../shared/live-types";
import type { LlmContext, LlmProvider } from "./types";

export class MockLlmProvider implements LlmProvider {
  async health(): Promise<RuntimeHealth> {
    return {
      component: "llm:mock",
      status: "OK",
      message: "Development mock provider",
      checkedAt: new Date().toISOString()
    };
  }

  async listModels(): Promise<string[]> {
    return ["mock-sales-brain"];
  }

  async generateActionProposal(context: LlmContext): Promise<ActionProposal> {
    const name = context.event.displayName || context.event.username || "bạn";
    const text = context.event.text || "";
    let speech = `Cảm ơn ${name}.`;
    let reason = "Generic engagement";

    if (/giá|price/i.test(text) && context.product?.priceText) {
      speech = `Giá hiện tại của ${context.product.title} là ${context.product.priceText}.`;
      reason = "Price question grounded in Product DNA";
    } else if (/size|kích thước/i.test(text)) {
      speech = `Mình sẽ kiểm tra size theo thông tin sản phẩm để tư vấn chính xác cho ${name} nhé.`;
      reason = "Size question requires grounded response";
    } else if (text) {
      speech = `${name} hỏi: "${text}". Mình đã nhận được câu hỏi và đang kiểm tra thông tin sản phẩm.`;
      reason = "Comment acknowledgement";
    }

    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      eventId: context.event.id,
      kind: "SPEAK",
      speech,
      confidence: context.product ? 0.96 : 0.86,
      reason,
      riskTags: context.product ? [] : ["unknown_product_fact"],
      nextState: "COMMENT_REPLY"
    };
  }
}
