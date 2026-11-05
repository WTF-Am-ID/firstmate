const task=await taskSpace(2);const page=task.page('p1');
const fs=await import('node:fs/promises');
const root='{run-worktree}';
const evidence='~/.no-mistakes-upstream-codex/evidence/01M6MNFPC5933VBYSY2D40PSZ9';
const state=JSON.parse(await fs.readFile(root+'/.validation-8153/lavish-state/state.json','utf8'));
const oracle=JSON.parse(await fs.readFile(evidence+'/live-oracle.json','utf8'));
const results=[];
for(const category of ['local','generated','supplied']){
 const session=Object.values(state.sessions).find(x=>x.file.includes('/board-'+category+'/'));
 await page.goto(session.url);
 const frames=await page.evaluate(()=>[...document.querySelectorAll('iframe')].map(x=>x.src));
 const artifact=frames.find(x=>x.includes('/artifact/'));
 if(!artifact)throw new Error('No real Lavish artifact iframe');
 await page.goto(artifact);
 console.log(await page.snapshot());
 const payload=JSON.parse(await fs.readFile(evidence+'/'+category+'-board-payload.json','utf8'));
 for(let i=0;i<payload.captains_call.length;i++){
  const expected=payload.captains_call[i];
  const actual=await page.evaluate(()=>{
   const cards=[...document.querySelectorAll('.bb-decision')];
   const visible=cards.filter(x=>x.getBoundingClientRect().height>0);
   return visible.map(x=>({text:x.innerText,width:x.clientWidth,scrollWidth:x.scrollWidth,height:x.clientHeight,scrollHeight:x.scrollHeight}));
  });
  if(actual.length!==1 || !actual[0].text.includes(expected.decide))throw new Error('Missing full rendered text for '+category+'/'+i+': '+JSON.stringify(actual));
  if(expected.decide.includes('Which route'))for(const option of oracle.options)if(!actual[0].text.includes(option))throw new Error('Late option missing: '+option);
  if(actual[0].scrollWidth>actual[0].width+1 || actual[0].scrollHeight>actual[0].height+1)throw new Error('Question card clips content');
  const screenshot=evidence+'/'+category+'-card-'+(i+1)+'.png';
  await page.screenshot({path:screenshot,fullPage:true});
  results.push({category,key:expected.key,exactQuestion:expected.decide,rendered:actual[0],screenshot});
  if(i+1<payload.captains_call.length)await page.click('button[aria-label="Next card"]',{label:'Read next decision question'});
 }
}
await fs.writeFile(evidence+'/browser-results.json',JSON.stringify(results,null,2));
console.log('Rendered all '+results.length+' decision cards with exact full text and no clipped content.');
console.log(await page.snapshot());
