// The API base for the live chat widget's fetch() calls, without trailing slashes.
// Production builds set VITE_API_URL=https://humancareconnect.co/ (trailing slash). The widget appends "/api/livechat/...",
// which would otherwise request "https://humancareconnect.co//api/livechat/config"; Express does not match a "//api" path,
// so the server answers 404 and the widget stays hidden. The other API clients (api.js, blogApi.js) already strip it.
export const apiBaseOf = (value) => String(value || "").replace(/\/+$/, "");
