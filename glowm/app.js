const references=document.querySelector('#references');
document.querySelectorAll('a[href="#references"]').forEach(link=>link.addEventListener('click',()=>{references.open=true;}));
const search=document.querySelector('#reference-search');
const referenceItems=[...document.querySelectorAll('.ref-item')];
const referenceGroups=[...document.querySelectorAll('.ref-group')];
search.addEventListener('input',()=>{
  const query=search.value.toLocaleLowerCase().trim();
  let visible=0;
  referenceItems.forEach(item=>{item.hidden=!item.textContent.toLocaleLowerCase().includes(query);if(!item.hidden)visible++;});
  referenceGroups.forEach(group=>{group.hidden=![...group.querySelectorAll('.ref-item')].some(item=>!item.hidden);});
  document.querySelector('#search-status').textContent=query?(visible?`${visible} matching reference${visible===1?'':'s'}`:'No matches. Try a paper title or website name.'):'';
});
if(location.hash==='#references')references.open=true;
