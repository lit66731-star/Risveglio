/* ==========================================================================
   Risveglio · Generation Adapter（Phase 6 的非确定性边界）
   定位：Core AI 与「独立 Core API」之间的 HTTP 边界。Core 绝不直接 fetch，
   只把 GenerationRequest 交给这里；这里负责 url/key/model/HTTP/解析/错误归一。
   后端：独立自定义 OpenAI-compatible API（第三套配置，不复用 Serendipity summary /
   Amor planner / 当前聊天 API）。直连浏览器 fetch（同 Serendipity summary 先例）。
   非确定性边界：从这里开始不再确定（网络/模型），只被 Core 按需调用，
   绝不参与前面 Revision→…→Guard 的确定性链路。
   ========================================================================== */

const TIMEOUT_MS = 120000; // 单次生成上限，防止挂起

// 把可能出现在报错里的密钥抹掉（报错会进 toast/控制台，可能被截图/转发）
function redactSecrets(text, key) {
    let t = String(text == null ? '' : text);
    const k = String(key || '').trim();
    if (k.length >= 6) t = t.split(k).join('***');
    return t
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{6,}/gi, 'Bearer ***')
        .replace(/\b(sk|rk|pk|ak)-[A-Za-z0-9_*-]{6,}/gi, '$1-***')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function endpoint(url) {
    url = String(url || '').trim().replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(url)) return url;
    return url + '/chat/completions';
}

/**
 * 调独立 Core API 生成一次 completion。
 * @param {{url: string, key?: string, model: string}} apiCfg
 * @param {Array<{role:string, content:string}>} messages
 * @param {number} [maxTokens]
 * @returns {Promise<{text: string, model: string, tokenUsage: object|null}>}
 */
export async function generate(apiCfg, messages, maxTokens) {
    const { url, key, model } = apiCfg || {};
    if (!url || !model) throw new Error('Core API 未配置（url/model 为空）');

    const headers = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = 'Bearer ' + String(key).trim();

    const body = { model: String(model).trim(), messages, stream: false };
    if (Number(maxTokens) > 0) body.max_tokens = Number(maxTokens);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
        res = await fetch(endpoint(url), {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });
    } catch (e) {
        if (e && e.name === 'AbortError') throw new Error('Core 生成超时（' + Math.round(TIMEOUT_MS / 1000) + ' 秒）');
        throw new Error(redactSecrets(e && e.message, key) || '网络请求失败');
    } finally {
        clearTimeout(timer);
    }

    const text = await res.text().catch(() => '');
    let d = null;
    try { d = JSON.parse(text); } catch (e) { /* 非 JSON */ }

    if (!res.ok || (d && d.error)) {
        const msg = (d && d.error && (d.error.message || (typeof d.error === 'string' ? d.error : ''))) || text;
        throw new Error('HTTP ' + res.status + ' ' + redactSecrets(msg, key));
    }

    const out = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    if (out == null) throw new Error('Core 返回内容为空');

    return {
        text: out,
        model: (d && d.model) || model,
        tokenUsage: (d && d.usage) ? d.usage : null,
    };
}
