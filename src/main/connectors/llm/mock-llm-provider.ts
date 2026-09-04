import { randomUUID } from "node:crypto";
import type { ActionProposal, RuntimeHealth } from "../../../shared/live-types";
import { productHasFact } from "../../../shared/product-dna";
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
    const product = context.product;

    const ask = (topic: string, reason: string): ActionProposal => ({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      eventId: context.event.id,
      kind: "ASK_OPERATOR",
      speech: `Mình chưa có thông tin ${topic} trong Product DNA để trả lời ${name} chính xác.`,
      confidence: 0.4,
      reason,
      riskTags: ["missing_product_fact"],
      nextState: "COMMENT_REPLY",
      metadata: { missingFact: topic }
    });

    if (/giá|price/i.test(text)) {
      if (!productHasFact(product, "price")) {
        return ask("giá", "Price missing from Product DNA — do not invent");
      }
      return speak(
        `Giá hiện tại của ${product!.title} là ${product!.priceText}${product!.currency ? ` ${product!.currency}` : ""}.`,
        "Price question grounded in Product DNA",
        context
      );
    }

    if (/size|kích thước|cỡ/i.test(text)) {
      if (!productHasFact(product, "size")) {
        return ask("size", "Size missing from Product DNA — do not invent");
      }
      const sizes =
        product!.sizes.length > 0
          ? product!.sizes.join(", ")
          : product!.variants.find((v) => /size|kích|cỡ/i.test(v.name))?.values.join(", ");
      return speak(
        `${product!.title} đang có các size: ${sizes}.`,
        "Size question grounded in Product DNA",
        context
      );
    }

    if (/màu|color/i.test(text)) {
      if (!productHasFact(product, "color")) {
        return ask("màu", "Color missing from Product DNA — do not invent");
      }
      const colors =
        product!.colors.length > 0
          ? product!.colors.join(", ")
          : product!.variants.find((v) => /màu|color/i.test(v.name))?.values.join(", ");
      return speak(
        `${product!.title} có màu: ${colors}.`,
        "Color question grounded in Product DNA",
        context
      );
    }

    if (/còn hàng|tồn|stock|in stock/i.test(text)) {
      if (!productHasFact(product, "stock")) {
        return ask("tồn kho", "Stock missing from Product DNA — do not invent");
      }
      return speak(
        `Tình trạng kho của ${product!.title}: ${product!.stockText}.`,
        "Stock question grounded in Product DNA",
        context
      );
    }

    if (/ship|giao hàng|shipping|vận chuyển/i.test(text)) {
      if (!productHasFact(product, "shipping")) {
        return ask("giao hàng", "Shipping missing from Product DNA — do not invent");
      }
      return speak(
        `Thông tin giao hàng: ${product!.shippingText}.`,
        "Shipping question grounded in Product DNA",
        context
      );
    }

    if (/bảo hành|warranty|đổi trả/i.test(text)) {
      if (!productHasFact(product, "warranty")) {
        return ask("bảo hành", "Warranty missing from Product DNA — do not invent");
      }
      return speak(
        `Chính sách bảo hành/đổi trả: ${product!.warrantyText}.`,
        "Warranty question grounded in Product DNA",
        context
      );
    }

    if (/chất liệu|material|vải/i.test(text)) {
      if (!productHasFact(product, "materials")) {
        return ask("chất liệu", "Materials missing from Product DNA — do not invent");
      }
      return speak(
        `Chất liệu của ${product!.title}: ${product!.materials}.`,
        "Materials question grounded in Product DNA",
        context
      );
    }

    let speech = `Cảm ơn ${name}.`;
    let reason = "Generic engagement";
    if (text) {
      speech = `${name} hỏi: "${text}". Mình đã nhận được câu hỏi và đang kiểm tra thông tin sản phẩm.`;
      reason = "Comment acknowledgement";
    }

    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      eventId: context.event.id,
      kind: "SPEAK",
      speech,
      confidence: product ? 0.9 : 0.7,
      reason,
      riskTags: product ? [] : ["unknown_product_fact"],
      nextState: "COMMENT_REPLY"
    };
  }
}

function speak(speech: string, reason: string, context: LlmContext): ActionProposal {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    eventId: context.event.id,
    kind: "SPEAK",
    speech,
    confidence: 0.96,
    reason,
    riskTags: [],
    nextState: "COMMENT_REPLY"
  };
}
