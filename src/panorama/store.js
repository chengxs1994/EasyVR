/** 使用独立 IndexedDB 存储全景与切片，不占用作品的 localStorage 配额。 */
export async function openPanoramaStore() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('easyvr.panorama', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return {
    /** 读取上次会话，首次打开返回空值。 */
    load() {
      return new Promise((resolve, reject) => {
        const request = db.transaction('session').objectStore('session').get('current');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },
    /** 等待整个写事务完成，失败时不声称已经保存。 */
    save(value) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('session', 'readwrite');
        tx.objectStore('session').put(value, 'current');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('保存被中止'));
      });
    },
  };
}
