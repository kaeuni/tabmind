const $ = id => document.getElementById(id);
let tabs = [], plan = [], targetWindowId = null;
const eligible = t => { try {return /^https?:\/\//i.test(t.url || '') && !['accounts.google.com','mail.google.com'].includes(new URL(t.url).hostname.toLowerCase());} catch {return false;} };
const safeUrl = url => {const u = new URL(url); return u.origin + u.pathname;};
function el(tag, cls, content) {const x=document.createElement(tag);if(cls)x.className=cls;if(content!==undefined)x.textContent=content;return x;}
async function currentTabs() {return chrome.tabs.query({windowId:targetWindowId});}
async function loadTabs(){
  $('error').textContent='';$('status').textContent='';$('preview').hidden=true;plan=[];
  tabs=(await currentTabs()).filter(eligible);
  $('count').textContent=`분석 가능한 탭 ${tabs.length}개`;
  $('tabs').replaceChildren();
  for(const t of tabs){const li=el('li');const row=el('div','tabrow');const check=el('input');check.type='checkbox';check.checked=true;check.dataset.id=t.id;const info=el('div');info.append(el('div','title',t.title||'제목 없음'),el('div','url',safeUrl(t.url)));row.append(check,info);li.append(row);$('tabs').append(li)}
}
function drawPlan(){
  const root=$('groups');root.replaceChildren();
  plan.forEach((g,gi)=>{const card=el('div','group');const name=el('input');name.value=g.name;name.maxLength=60;name.addEventListener('input',()=>{g.name=name.value});card.append(name);
    for(const id of g.tab_ids){const t=tabs.find(t=>t.id===id);if(!t)continue;const item=el('div','item');item.append(el('div','title',t.title||safeUrl(t.url)));const select=el('select');plan.forEach((dest,j)=>{const opt=el('option',null,dest.name);opt.value=j;opt.selected=j===gi;select.append(opt)});select.addEventListener('change',()=>{g.tab_ids=g.tab_ids.filter(x=>x!==id);plan[Number(select.value)].tab_ids.push(id);drawPlan()});item.append(select);card.append(item)}root.append(card)});
  $('preview').hidden=false;
}
$('suggest').addEventListener('click',async()=>{
  const ids=new Set([...document.querySelectorAll('#tabs input:checked')].map(x=>Number(x.dataset.id)));
  const selected=tabs.filter(t=>ids.has(t.id));
  if(!selected.length){$('error').textContent='탭을 하나 이상 선택하세요.';return;}
  $('suggest').disabled=true;$('error').textContent='';$('status').textContent='Gemini가 정리안을 만드는 중...';
  try{
    const resp=await fetch('http://127.0.0.1:8765/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instruction:$('instruction').value.trim(),tabs:selected.map(t=>({id:t.id,title:t.title||'',url:safeUrl(t.url)}))})});
    const data=await resp.json();if(!resp.ok)throw new Error(data.detail||'AI 요청 실패');
    const expected=new Set(selected.map(t=>t.id));const got=data.groups.flatMap(g=>g.tab_ids);
    if(got.length!==expected.size||new Set(got).size!==expected.size||got.some(id=>!expected.has(id)))throw new Error('AI 분류 결과에 누락되거나 중복된 탭이 있어요.');
    plan=data.groups;drawPlan();$('status').textContent='정리안을 확인한 후 적용하세요.';
  }catch(e){$('error').textContent=`정리안 생성 실패: ${e.message}`;}finally{$('suggest').disabled=false;}
});
async function snapshot(){
  const all=await currentTabs();const groupIds=[...new Set(all.map(t=>t.groupId).filter(id=>id>=0))];
  const groupInfo={};for(const id of groupIds){try{const g=await chrome.tabGroups.get(id);groupInfo[id]={title:g.title||'',color:g.color,collapsed:g.collapsed};}catch{}}
  return {windowId:targetWindowId,tabs:all.map(t=>({id:t.id,index:t.index,groupId:t.groupId})),groups:groupInfo};
}
$('apply').addEventListener('click',async()=>{
  $('error').textContent='';$('apply').disabled=true;
  try{
    const current=new Map((await currentTabs()).map(t=>[t.id,t]));
    const usable=plan.map(g=>({name:g.name,ids:g.tab_ids.filter(id=>current.has(id))})).filter(g=>g.ids.length);
    if(!usable.length)throw new Error('적용할 탭이 없습니다.');
    const backup=await snapshot();
    // 먼저 저장해 적용 도중 실패하더라도 복구를 시도할 수 있게 한다.
    await chrome.storage.local.set({lastTabMindSnapshot:backup});
    let created=0;
    for(const g of usable){const groupId=await chrome.tabs.group({tabIds:g.ids});await chrome.tabGroups.update(groupId,{title:g.name.trim()||'새 그룹',collapsed:false});created++;}
    $('status').textContent=`${created}개 그룹을 만들었어요. 필요하면 '마지막 정리 되돌리기'를 누르세요.`;
  }catch(e){$('error').textContent=`적용 실패: ${e.message}`;}finally{$('apply').disabled=false;}
});
$('undo').addEventListener('click',async()=>{
  $('error').textContent='';$('undo').disabled=true;
  try{
    const {lastTabMindSnapshot:s}=await chrome.storage.local.get('lastTabMindSnapshot');
    if(!s)throw new Error('되돌릴 정리 기록이 없습니다.');
    const all=await chrome.tabs.query({windowId:s.windowId});const current=new Map(all.map(t=>[t.id,t]));
    const present=s.tabs.filter(t=>current.has(t.id));
    if(!present.length)throw new Error('이전 탭이 남아 있지 않습니다.');
    const toUngroup=present.filter(t=>current.get(t.id).groupId>=0).map(t=>t.id);
    if(toUngroup.length)await chrome.tabs.ungroup(toUngroup);
    // 이전 그룹 ID 자체는 재사용할 수 없으므로 새 그룹을 만들어 메타데이터를 복원한다.
    for(const [oldId,meta] of Object.entries(s.groups)){
      const ids=present.filter(t=>String(t.groupId)===oldId).map(t=>t.id);
      if(!ids.length)continue;
      const newId=await chrome.tabs.group({tabIds:ids,createProperties:{windowId:s.windowId}});
      await chrome.tabGroups.update(newId,{title:meta.title,color:meta.color,collapsed:false});
    }
    // 탭 순서를 원래대로 되돌린다. 그룹 탭은 Chrome에서 연속되어야 한다.
    for(const t of [...present].sort((a,b)=>a.index-b.index)){
      try{await chrome.tabs.move(t.id,{index:t.index});}catch{}
    }
    // 순서 복원 후 접힘 상태를 복원한다.
    const updated=await chrome.tabs.query({windowId:s.windowId});
    for(const [oldId,meta] of Object.entries(s.groups)){
      const ids=present.filter(t=>String(t.groupId)===oldId).map(t=>t.id);
      const one=updated.find(t=>ids.includes(t.id));
      if(one?.groupId>=0 && meta.collapsed){try{await chrome.tabGroups.update(one.groupId,{collapsed:true});}catch{}}
    }
    await chrome.storage.local.remove('lastTabMindSnapshot');
    $('status').textContent='이전 탭 그룹 구성을 복원했어요. (닫힌 탭은 복원되지 않습니다.)';
    await loadTabs();$('status').textContent='이전 탭 그룹 구성을 복원했어요.';
  }catch(e){$('error').textContent=`되돌리기 실패: ${e.message}`;}finally{$('undo').disabled=false;}
});
$('openWindow').addEventListener('click',async()=>{
  try{const url=chrome.runtime.getURL(`popup.html?windowId=${targetWindowId}&mode=window`);await chrome.windows.create({url,type:'popup',width:760,height:850});}catch(e){$('error').textContent=e.message;}
});
$('refresh').addEventListener('click',()=>loadTabs().catch(e=>$('error').textContent=e.message));
(async()=>{
  const params=new URLSearchParams(location.search);
  if(params.get('mode')==='window')document.body.classList.add('windowmode');
  const requested=Number(params.get('windowId'));
  if(Number.isInteger(requested)&&requested>0)targetWindowId=requested;
  else {const w=await chrome.windows.getCurrent();targetWindowId=w.id;}
  await loadTabs();
})().catch(e=>$('error').textContent=e.message);
