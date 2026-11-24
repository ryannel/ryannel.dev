function entries(id,guide,link,topics){
  return guide.chapters.flatMap((chapter,i)=>{
    const href=link(id,i),section=topics(id)[i];
    return [chapter,...chapter.variants||[]].map(c=>({
      title:c.title,section,href:c===chapter?href:href+'/'+c.slug,
      camera:c.sectionNote||(i===0?'Mechanism, then the opening door.':i===1?'Key or dial movement, then the part that still blocks the lock.':chapter.routeSlug==='mixed-pins'?
        'Six chambers in one core, with a close-up of the active pin.':'Whole stack and synchronized cutaway.')
    }));
  });
}

export function catalogue({filter},{guides,link,topics}){
  const families=Object.keys(guides),shown=filter==='all'?families:[filter];
  const options=['<option value="all">All locks</option>',...families.map(id=>
    `<option value="${id}" ${id===filter?'selected':''}>${guides[id].name}</option>`)].join('');
  return `<div class="collection-heading"><a class="all-locks" href="#collection">← All locks</a><h1>Film catalogue</h1></div>
    <div class="catalogue film-list"><label>Lock type <select id="filter">${options}</select></label>
    ${shown.map(id=>{
      const rows=entries(id,guides[id],link,topics);
      return `<details ${shown.length===1?'open':''}><summary>${guides[id].name} · ${rows.length} films</summary>
        <ul>${rows.map(row=>`<li><small>${row.section}</small><a href="${row.href}">${row.title}</a><p>${row.camera}</p></li>`).join('')}</ul></details>`;
    }).join('')}</div>`;
}
