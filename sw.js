/* 内部障害理学療法 — オフライン用サービスワーカー
   仕組み: 初回に本体と問題データを端末に保存する。
   通信があるときは常に最新を取りに行き（失敗したら保存済みを使う）、
   通信がないときは保存済みの本体と問題データで動く。
   問題データ（data.json・q100.json）や本体を更新しても、このファイルを変える必要はない。 */
const VERSION = "naibu-pt-v2";
const COLORS = ["blue", "green", "orange", "purple"];
const SHELL = ["./", "./index.html", "./data.json", "./q100.json", "./manifest.webmanifest",
               "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"]
  .concat(COLORS.flatMap((c) => ["./manifest-" + c + ".webmanifest", "./icons/icon-" + c + "-192.png",
                                 "./icons/icon-" + c + "-512.png", "./icons/apple-touch-icon-" + c + ".png"]));

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
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
  // それ以外（外部）の通信は行わない
});
