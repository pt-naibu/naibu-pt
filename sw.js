/* 内部障害理学療法 — オフライン用サービスワーカー
   仕組み: 初回に本体と問題データを端末に保存する。
   通信があるときは常に最新を取りに行き（失敗したら保存済みを使う）、
   通信がないときは保存済みの本体と問題データで動く。
   問題データ（data.json）や本体を更新しても、このファイルを変える必要はない。 */
const VERSION = "naibu-pt-v1";
const FONT_CACHE = VERSION + "-fonts";
const SHELL = ["./", "./index.html", "./data.json", "./manifest.webmanifest",
               "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // 本体と問題データ: ネットワーク優先、だめなら保存済み
    e.respondWith(
      withTimeout(fetch(req), 6000).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((r) => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
    );
    return;
  }
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) {
    // フォント: 保存済み優先（なければ取得して保存。取れなければ端末のフォントで表示される）
    e.respondWith(
      caches.match(req).then((r) => r || fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(FONT_CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
