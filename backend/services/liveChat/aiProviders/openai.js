// OpenAI provider for the live-chat AI (chat.completions with strict JSON-schema output, the same call shape as
// the search service). Server-side only. Returns the raw text plus usage; failures are thrown as errors with a
// `kind` the caller understands:
//   quota        credits are used up / billing limit reached (insufficient_quota)
//   config       bad key, unknown model or rejected parameter (401/403/404/400)
//   rate_limited provider rate limit (429 without a quota code)
//   timeout | unavailable | api_error
//
// Request and response bodies are never logged (they contain patient messages).

function classify(err) {
  const sdk = require("openai");
  if (err instanceof sdk.APIConnectionTimeoutError) return "timeout";
  if (err instanceof sdk.APIConnectionError) return "unavailable";
  const code = String(err?.code || err?.error?.code || "");
  if (code === "insufficient_quota" || code === "billing_hard_limit_reached") return "quota";
  if (err?.status === 429) return "rate_limited";
  if ([400, 401, 403, 404].includes(err?.status)) return "config";
  if (err?.status >= 500) return "unavailable";
  return "api_error";
}

function createOpenAiProvider(config, { clientFactory } = {}) {
  let client = null;
  const getClient = () => {
    if (!client) {
      client = clientFactory
        ? clientFactory(config)
        : new (require("openai").OpenAI)({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeoutMs });
    }
    return client;
  };

  return {
    name: "openai",
    // messages: [{ role: "user" | "assistant", content }]; schema: JSON schema object (strict).
    async complete({ system, messages, schema, schemaName, maxOutputTokens }) {
      const request = {
        model: config.model,
        messages: [{ role: "system", content: system }, ...messages],
        max_completion_tokens: maxOutputTokens,
        response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
      };
      if (config.reasoningEffort) request.reasoning_effort = config.reasoningEffort;

      let completion;
      try {
        completion = await getClient().chat.completions.create(request, { timeout: config.timeoutMs, maxRetries: 0 });
      } catch (err) {
        const wrapped = new Error(`openai_${classify(err)}`);
        wrapped.kind = classify(err);
        wrapped.status = err?.status;
        throw wrapped;
      }
      const choice = completion?.choices?.[0];
      const usage = completion?.usage || {};
      return {
        text: String(choice?.message?.content || ""),
        finishReason: choice?.finish_reason || "",
        refusal: Boolean(choice?.message?.refusal),
        usage: {
          inputTokens: Number(usage.prompt_tokens) || 0,
          cachedInputTokens: Number(usage.prompt_tokens_details?.cached_tokens) || 0,
          outputTokens: Number(usage.completion_tokens) || 0,
        },
      };
    },
  };
}

module.exports = { createOpenAiProvider, classify };
