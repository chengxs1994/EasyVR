/** 保存成功後才推進歷史；最多保留 30 次操作，匯入亦可撤銷。 */
export class ConfigHistory {
  /** 注入持久化方式，將瀏覽器儲存與歷史規則分開驗證。 */
  constructor(initial, persist, limit = 30) { this.value = initial; this.persist = persist; this.limit = limit; this.past = []; this.future = []; }
  /** 持久化失敗時不變動目前配置或撤銷堆疊。 */
  commit(next) { this.persist(next); this.past.push(this.value); if (this.past.length > this.limit) this.past.shift(); this.value = next; this.future = []; }
  /** 撤銷整次操作，不包含尚未保存的表單。 */
  undo() { if (!this.past.length) return; const next = this.past.at(-1); this.persist(next); this.future.push(this.value); this.value = this.past.pop(); }
  /** 新操作會清除重做分支。 */
  redo() { if (!this.future.length) return; const next = this.future.at(-1); this.persist(next); this.past.push(this.value); this.value = this.future.pop(); }
}
