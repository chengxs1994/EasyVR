/** 最多保留三組已準備素材，並固定保留正在顯示的紋理。 */
export class PreparedSceneCache {
  /** 分開管理完成素材與進行中請求，避免同一來源重複下載。 */
  constructor() {
    this.ready = new Map();
    this.pending = new Map();
    this.current = null;
    this.disposed = false;
  }

  /** 共用同來源請求；失敗不留快取，使下一次操作可以重新載入。 */
  prepare(key, load) {
    if (this.disposed) return Promise.reject(new Error('全景檢視器已關閉'));
    if (this.ready.has(key)) {
      const prepared = this.ready.get(key);
      this.ready.delete(key);
      this.ready.set(key, prepared);
      return Promise.resolve(prepared);
    }
    if (this.pending.has(key)) return this.pending.get(key);

    const pending = Promise.resolve().then(() => {
      if (this.disposed) throw new Error('全景檢視器已關閉');
      return load();
    }).then(prepared => {
      // 載入器無法取消時，遲到的紋理仍須回收，不能重新加入已關閉的快取。
      if (this.disposed) {
        prepared.texture.dispose();
        throw new Error('全景檢視器已關閉');
      }
      this.ready.set(key, prepared);
      this.trim();
      return prepared;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, pending);
    return pending;
  }

  /** 切換目前素材並更新使用順序，已淘汰的素材禁止重新顯示。 */
  activate(prepared) {
    if (this.disposed) throw new Error('全景檢視器已關閉');
    for (const [key, cached] of this.ready) {
      if (cached !== prepared) continue;
      this.current = prepared;
      this.ready.delete(key);
      this.ready.set(key, prepared);
      return;
    }
    throw new Error('素材已釋放，請重新準備場景');
  }

  /** 只淘汰未顯示且最久未使用的素材，等待下一個點位時仍保留舊畫面。 */
  trim() {
    for (const [key, prepared] of this.ready) {
      if (this.ready.size <= 3) break;
      if (prepared === this.current) continue;
      this.ready.delete(key);
      prepared.texture.dispose();
    }
  }

  /** 關閉後釋放全部完成素材，尚未完成的請求由其完成回呼自行回收。 */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.current = null;
    for (const prepared of this.ready.values()) prepared.texture.dispose();
    this.ready.clear();
    this.pending.clear();
  }
}
