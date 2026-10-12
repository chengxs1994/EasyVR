import { translate } from '../i18n.js';

/** 对场景文本做 XML 转义，调度图只包含经过处理的用户数据。 */
function escape(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])); }
/** 对象编号由持久 ID 派生，删除或插入其他对象不会改变其身份。 */
export function directorCode(object) { return `${object.type === 'actor' ? 'CH' : object.type === 'light' ? 'LT' : 'PR'}-${object.id.slice(0,8).toUpperCase()}`; }
/** 从同一工程生成米制 XZ 平面调度图，包含对象、演员走位和已保存机位。 */
export function createDirectorPlot(project, locale) {
  const objects=project.objects.filter(o=>o.visible);
  const cameras=[{id:'current',name:translate('当前机位', locale),camera:project.camera},...(project.cameraLibrary||[])];
  const points=[...objects.map(o=>o.position),...cameras.flatMap(c=>[c.camera.position,c.camera.target]),...objects.flatMap(o=>o.motion?[o.motion.from,o.motion.to]:[])];
  const xs=points.map(p=>p[0]),zs=points.map(p=>p[2]);
  const minX=Math.min(-6,...xs)-2,maxX=Math.max(6,...xs)+2,minZ=Math.min(-5,...zs)-2,maxZ=Math.max(5,...zs)+2;
  const scale=Math.min(780/(maxX-minX),640/(maxZ-minZ));
  /** 将米制场景坐标映射到图纸，Z 轴朝下，与俯视视图保持一致。 */
  function point(p) { return [60+(p[0]-minX)*scale,110+(p[2]-minZ)*scale]; }
  let drawing='';
  for(let x=Math.ceil(minX);x<=maxX;x++) { const [u]=point([x,0,0]);drawing+=`<path d="M${u} 100V770" stroke="#e8e5ed"/>`; }
  for(let z=Math.ceil(minZ);z<=maxZ;z++) { const [,v]=point([0,0,z]);drawing+=`<path d="M50 ${v}H850" stroke="#e8e5ed"/>`; }
  for(const o of objects) {
    const [x,y]=point(o.position),code=directorCode(o);
    drawing+=o.type==='actor'||o.type==='light'?`<circle cx="${x}" cy="${y}" r="${o.type==='actor'?8:6}" fill="${o.color}" stroke="#453754"/>`:`<rect x="${x-16}" y="${y-9}" width="32" height="18" rx="3" fill="${o.color}" stroke="#79727f" transform="rotate(${-o.rotation[1]*180/Math.PI} ${x} ${y})"/>`;
    drawing+=`<text x="${x+10}" y="${y-10}" font-size="10" fill="#393141">${code}</text>`;
    if(o.motion){const [a,b]=point(o.motion.from),[c,d]=point(o.motion.to);drawing+=`<path d="M${a} ${b}L${c} ${d}" stroke="${o.color}" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#arrow)"/><text x="${(a+c)/2}" y="${(b+d)/2-8}" font-size="10">${o.motion.start}–${o.motion.end}s</text>`;}
  }
  for(const c of cameras){const [x,y]=point(c.camera.position),[tx,ty]=point(c.camera.target);drawing+=`<path d="M${x} ${y}L${tx} ${ty}" stroke="#b5892d" stroke-dasharray="4 4" marker-end="url(#arrow)"/><rect x="${x-7}" y="${y-6}" width="14" height="12" rx="2" fill="#dbac46"/><text x="${x+10}" y="${y+18}" font-size="11">${escape(c.name)} · ${c.camera.focal}mm</text>`;}
  const legend=objects.map((o,i)=>`<text x="890" y="${140+i*24}" font-size="12" fill="#453b50">${directorCode(o)} · ${escape(o.name)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="${Math.max(840,objects.length*24+180)}" viewBox="0 0 1240 ${Math.max(840,objects.length*24+180)}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#897297"/></marker></defs><rect width="100%" height="100%" fill="#faf9fc"/><g font-family="sans-serif" fill="#393141"><text x="50" y="45" font-size="24" font-weight="bold">${escape(project.name)} · ${escape(translate('导演调度图', locale))}</text><text x="50" y="76" font-size="13">${escape(translate('XZ 平面 · 网格 1 米 · 虚线为演员走位 / 机位朝向 · 道具为位置示意，并非建筑尺寸图', locale))}</text>${drawing}<text x="890" y="112" font-size="16" font-weight="bold">${escape(translate('对象索引', locale))}</text>${legend}</g></svg>`;
}
