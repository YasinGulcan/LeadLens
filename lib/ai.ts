import * as claudeImpl from "./claude";
import * as openaiImpl from "./openai-chat";

/**
 * Tek switch noktası — pipeline ve dashboard route'ları LLM çağıran hiçbir
 * fonksiyonu artık `./claude` ya da `./openai-chat`'ten DOĞRUDAN import
 * ETMEMELİ, hepsi buradan geçmeli. AI_PROVIDER=openai iken tüm gerçek
 * "düşünme" işi (skorlama, derinlemesine analiz, taslak, mail ayrıştırma,
 * AI görünürlük kontrolü) OpenAI'ye gider; env değişkeni yoksa/başka bir
 * değerdeyse varsayılan Claude'dur. Bilgi Tabanı'ndaki embedding
 * (lib/embeddings.ts) bu switch'ten bağımsız, her zaman OpenAI kullanır.
 */
export type AiProvider = "anthropic" | "openai";

export function getAiProvider(): AiProvider {
  return process.env.AI_PROVIDER === "openai" ? "openai" : "anthropic";
}

const impl = () => (getAiProvider() === "openai" ? openaiImpl : claudeImpl);

export const analyzeLead: typeof claudeImpl.analyzeLead = (params) => impl().analyzeLead(params);

export const generateDeepAnalysis: typeof claudeImpl.generateDeepAnalysis = (params) => impl().generateDeepAnalysis(params);

export const generateDraftReply: typeof claudeImpl.generateDraftReply = (params) => impl().generateDraftReply(params);

export const extractLeadFieldsFromEmail: typeof claudeImpl.extractLeadFieldsFromEmail = (params) =>
  impl().extractLeadFieldsFromEmail(params);

export const generateSearchKeyword: typeof claudeImpl.generateSearchKeyword = (siteSummary) => impl().generateSearchKeyword(siteSummary);

export const checkAiVisibility: typeof claudeImpl.checkAiVisibility = (keyword, websiteUrl) =>
  impl().checkAiVisibility(keyword, websiteUrl);
