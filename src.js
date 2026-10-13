const $ = id => document.getElementById(id);
const state = { files: [], contacts: [], nextId: 1, vcfMode: false };
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ext = f => (f.name.split(".").pop() || "").toLowerCase();
function status(msg, error=false){ $("status").textContent = msg || ""; $("status").classList.toggle("error", error); }
function isDateLike(v){
 const d=String(v??"").replace(/\D/g,"");
 // Formats compacts courants : JJMMYYYY, JJMMYYYYHHmm, AAAAMMJJ[HHmm[ss]]
 const validDate=(day,month,year)=>{const y=+year,m=+month,da=+day;if(y<1900||y>2100||m<1||m>12||da<1)return false;return da<=new Date(y,m,0).getDate();};
 if(/^\d{8}(?:\d{4}|\d{6})?$/.test(d)){
  // Les numéros mobiles marocains compacts commençant par 06/07 peuvent
  // avoir 12 chiffres : ne pas les confondre avec JJMMYYYYHHmm.
  if(d.length===12 && /^(?:06|07)/.test(d)) return false;
  let day,month,year,rest;
  if(+d.slice(0,4)>=1900&&+d.slice(0,4)<=2100){year=d.slice(0,4);month=d.slice(4,6);day=d.slice(6,8);rest=d.slice(8);}
  else {day=d.slice(0,2);month=d.slice(2,4);year=d.slice(4,8);rest=d.slice(8);}
  const validTime=!rest||(Number(rest.slice(0,2))<24&&Number(rest.slice(2,4))<60&&(rest.length===4||Number(rest.slice(4,6))<60));
  if(validDate(day,month,year)&&validTime)return true;
 }
 return /\b(?:date|dated|réf(?:érence)?|reference|ref|commande|facture|dossier|ticket|id)\s*[:#№-]?\s*\d/i.test(String(v??""));
}
function phone(v){
 const s=String(v ?? "").trim();
 if(!s || isDateLike(s)) return "";
 // Détection internationale sans préfixe imposé : accepte 06, 07, 01...,
 // +212, +33, +1, +44, 0033, espaces, parenthèses, points, tirets et slashs.
 // La validation est volontairement mondiale : aucun indicatif de pays obligatoire.
 if(!/^[+\d(]/.test(s) && !/^00\s*\d/.test(s)) return "";
 const digits=s.replace(/\D/g,"");
 if(digits.length<7 || digits.length>15) return "";
 let normalized=digits;
 let international=false;
 if(s.startsWith("+") || /^00\s*\d/.test(s)) international=true;
 if(normalized.startsWith("00")){ normalized=normalized.slice(2); international=true; }
 if(normalized.length<7 || normalized.length>15) return "";
 return (international?"+":"")+normalized;
}
function cleanName(v){ const s=String(v ?? "").trim(); if(!s || phone(s) || s.length>90 || /https?:\/\//i.test(s) || /^[\d\s.,;:/()+_-]+$/.test(s) || /^(?:ref(?:erence)?|réf(?:érence)?|date|id|n[°o]|numero|numéro|commande|facture|dossier|ticket)\s*[:#-]?$/i.test(s)) return ""; return s.replace(/\s+/g," "); }
const phoneKey = p => String(p||"").replace(/\D/g,"").replace(/^00/,"");
function addContact(n,p,src){ p=phone(p); if(!p)return; n=cleanName(n); if(state.contacts.some(c=>phoneKey(c.phone)===phoneKey(p)&&c.name.toLowerCase()===n.toLowerCase()))return; state.contacts.push({id:state.nextId++,name:n,phone:p,uncertain:!n,source:src||""}); }
function parseRows(rows,src){
 if(!rows?.length)return;
 rows=rows.map(r=>Array.isArray(r)?r:Object.values(r));
 let nameCol=-1,firstCol=-1,lastCol=-1,phoneCol=-1,headerRow=-1;
 const norm=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[_-]+/g," ").trim();
 rows.slice(0,8).forEach((r,i)=>{let n=-1,p=-1,fn=-1,ln=-1;r.forEach((v,j)=>{const h=norm(v);if(n<0&&/^(nom complet|full name|contact|client|personne|nom et prenom|name)$/.test(h))n=j;if(fn<0&&/^(prenom|first name|given name)$/.test(h))fn=j;if(ln<0&&/^(nom|last name|surname|family name)$/.test(h))ln=j;if(p<0&&/(telephone|phone|mobile|gsm|numero|number|whatsapp|tel\b)/.test(h))p=j;});if(p>=0&&(phoneCol<0||n>=0||fn>=0||ln>=0)){headerRow=i;nameCol=n;firstCol=fn;lastCol=ln;phoneCol=p;}});
 if(phoneCol>=0){rows.slice(headerRow+1).forEach(r=>{const parts=[];if(firstCol>=0&&cleanName(r[firstCol]))parts.push(cleanName(r[firstCol]));if(lastCol>=0&&cleanName(r[lastCol])&&!parts.some(x=>x.toLowerCase()===cleanName(r[lastCol]).toLowerCase()))parts.push(cleanName(r[lastCol]));let n=parts.join(" ");if(!n&&nameCol>=0)n=cleanName(r[nameCol]);addContact(n,r[phoneCol],src);});return;}
 rows.forEach((r,i)=>{const ix=r.findIndex(v=>!!phone(v));if(ix<0)return;let n="";r.forEach((v,j)=>{if(j!==ix&&!n)n=cleanName(v)});if(!n&&i>0)n=(rows[i-1]||[]).map(cleanName).find(Boolean)||"";addContact(n,r[ix],src);});
}
function unescapeVcard(s){return String(s||"").replace(/\\n/gi,"\n").replace(/\\([,;\\])/g,"$1");}
function parseVcf(text,src){
 const unfolded=String(text||"").replace(/\r\n[ \t]/g,"").replace(/\n[ \t]/g,"");
 const cards=unfolded.split(/BEGIN:VCARD/i).slice(1);
 let found=0;
 for(const raw of cards){
  const card=raw.split(/END:VCARD/i)[0];
  const lines=card.split(/\r?\n/);
  let name="",tel="";
  for(const line of lines){
   const k=line.indexOf(":");if(k<0)continue;
   const prop=line.slice(0,k).toUpperCase(),value=unescapeVcard(line.slice(k+1).trim());
   if(prop.startsWith("FN")) name=value;
   else if(!name&&prop.startsWith("N")){const bits=value.split(";").filter(Boolean);name=bits.reverse().join(" ");}
   if(prop.startsWith("TEL")&&!tel)tel=value;
  }
  if(tel){addContact(name,tel,src);found++;}
 }
 return found;
}
function parseText(text,src){
 const lines=String(text||"").split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean);
 parseRows(lines.map(s=>s.split(/[\t;,|]+/).map(v=>v.trim())),src);
 lines.forEach((line,i)=>{
  const re=/(?:\+|00\s*)?\d[\d\s()./-]{4,}\d/g;let match;
  while((match=re.exec(line))!==null){const candidate=match[0],before=line.slice(Math.max(0,match.index-32),match.index),after=line.slice(re.lastIndex,re.lastIndex+20);
   if(isDateLike(candidate)||/(?:réf(?:érence)?|reference|\bref\b|date|commande|facture|dossier|ticket|\bid\b)\s*[:#№-]?\s*$/i.test(before))continue;
   const remainder=cleanName((line.slice(0,match.index)+" "+line.slice(re.lastIndex)).replace(/[|,:;#()\[\]]/g," "));
   // A bare date/reference should never become a contact name either.
   const name=remainder||(i?cleanName(lines[i-1]):"");
   if(name&&/^(?:réf|reference|ref|date|id|commande|facture|dossier|ticket)\b/i.test(name))continue;
   addContact(name,candidate,src);
  }
 });
}
async function parseFile(f){
 const e=ext(f);
 if(e==="vcf"){parseVcf(await f.text(),f.name);}
 else if(e==="csv"){const t=await f.text();parseRows(Papa.parse(t,{skipEmptyLines:true}).data,f.name);}
 else if(e==="xlsx"||e==="xls"){const wb=XLSX.read(await f.arrayBuffer(),{type:"array",raw:true,cellText:true});wb.SheetNames.forEach(n=>parseRows(XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:false,defval:""}),f.name));}
 else if(e==="docx"){const r=await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()});parseText(r.value,f.name);}
 else if(e==="pdf"){
  const pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;let text="";
  for(let i=1;i<=pdf.numPages;i++){status("Lecture du PDF "+f.name+" — page "+i+"/"+pdf.numPages+"…");const page=await pdf.getPage(i),content=await page.getTextContent();let last=null,line="",lines=[];content.items.forEach(it=>{const y=Math.round(it.transform?.[5]||0);if(last!==null&&Math.abs(y-last)>3){lines.push(line);line="";}line+=(line?" ":"")+it.str;last=y;});if(line)lines.push(line);text+=lines.join("\n")+"\n";}
  if(text.trim())parseText(text,f.name);
  else {status("PDF scanné : OCR en cours pour "+f.name+"…");for(let j=1;j<=pdf.numPages;j++){const pg=await pdf.getPage(j),vp=pg.getViewport({scale:1.5}),canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");canvas.width=vp.width;canvas.height=vp.height;await pg.render({canvasContext:ctx,viewport:vp}).promise;const result=await Tesseract.recognize(canvas,"fra+eng");parseText(result.data.text,f.name);canvas.width=canvas.height=0;}}
 }
}
function updateModeUI(){
 const converter=state.vcfMode;
 $("fileInput").accept=converter?".vcf":".vcf,.csv,.xlsx,.xls,.pdf,.docx";
 $("dropTitle").textContent=converter?"Déposez vos fichiers VCF ici":"Déposez vos fichiers ici";
 $("dropSubtitle").textContent=converter?"Convertissez vos contacts VCF vers un autre format":"ou choisissez-les depuis votre appareil";
 $("fileTypes").textContent=converter?"VCF → CSV · XLSX · PDF · DOCX":"VCF · CSV · XLSX · XLS · PDF · DOCX";
 $("extractBtn").textContent=converter?"Convertir les VCF →":"Extraire les contacts →";
 $("modeHint").textContent=converter?"Mode convertisseur activé : seuls les fichiers VCF sont acceptés. Après import, choisissez CSV, XLSX, PDF ou DOCX dans les boutons d’export.":"Mode extraction : importez des documents ou des listes pour extraire les contacts.";
 $("vcfBtn").hidden=converter;
}
function renderFiles(){
 updateModeUI();
 $("fileList").innerHTML=state.files.map((f,i)=>`<div class="file-item"><div class="file-icon">${esc(ext(f).toUpperCase())}</div><div class="file-info"><div class="file-name">${esc(f.name)}</div><div class="file-size">${(f.size/1024).toFixed(1)} Ko</div></div><button class="remove-file" data-remove-file="${i}" aria-label="Retirer le fichier">×</button></div>`).join("");
 $("extractBtn").disabled=!state.files.length;$("fileInput").value="";
}
function addFiles(list){const bad=[];Array.from(list||[]).forEach(f=>{if(state.vcfMode?ext(f)!=="vcf":!["vcf","csv","xlsx","xls","pdf","docx"].includes(ext(f)))bad.push(f.name);else if(!state.files.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified))state.files.push(f);});status(bad.length?(state.vcfMode?"En mode convertisseur, seuls les fichiers .vcf sont acceptés : ":"Format non pris en charge : ")+bad.join(", "):"",!!bad.length);renderFiles();}
function selected(){return [...$("contactRows").querySelectorAll("tr")].filter(tr=>tr.querySelector(".row-check").checked).map(tr=>+tr.dataset.id);}
function render(){
 const q=$("searchInput").value.trim().toLowerCase(),list=state.contacts.filter(c=>!q||c.name.toLowerCase().includes(q)||c.phone.toLowerCase().includes(q));
 $("contactRows").innerHTML=list.map(c=>`<tr data-id="${c.id}"><td class="check"><input class="row-check" type="checkbox" aria-label="Sélectionner"></td><td><input class="cell" data-field="name" aria-label="Nom" value="${esc(c.name)}" placeholder="Nom inconnu">${c.uncertain?'<small style="display:block;color:#8c650f">Nom à vérifier</small>':""}</td><td><input class="cell" data-field="phone" aria-label="Numéro" value="${esc(c.phone)}" inputmode="tel"></td><td><div class="row-actions"><button class="icon-btn" data-action="whatsapp" title="Ouvrir WhatsApp" aria-label="Ouvrir WhatsApp">↗</button><button class="icon-btn" data-action="delete" title="Supprimer" aria-label="Supprimer">×</button></div></td></tr>`).join("");
 $("count").textContent=state.contacts.length;$("summary").textContent=state.contacts.length+" contact(s) extrait(s) · "+list.length+" affiché(s)";
 $("emptyState").hidden=list.length>0;$("contactRows").parentElement.hidden=list.length===0;$("deleteSelectedBtn").disabled=!selected().length;
 $("selectAll").checked=list.length>0&&list.every(c=>selected().includes(c.id));$("duplicateNotice").hidden=true;
}
$("vcfModeToggle").addEventListener("change",e=>{
 state.vcfMode=e.target.checked;
 if(state.vcfMode){const removed=state.files.filter(f=>ext(f)!=="vcf");state.files=state.files.filter(f=>ext(f)==="vcf");if(removed.length)status("Les fichiers non-VCF ont été retirés du mode convertisseur.");else status("");}
 else status("");
 renderFiles();
});
$("chooseBtn").addEventListener("click",e=>{e.stopPropagation();$("fileInput").click();});
$("dropzone").addEventListener("click",e=>{if(!e.target.closest("button"))$("fileInput").click();});
$("dropzone").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("fileInput").click();}});
$("fileInput").addEventListener("change",e=>addFiles(e.target.files));
["dragenter","dragover"].forEach(n=>$("dropzone").addEventListener(n,e=>{e.preventDefault();$("dropzone").classList.add("dragover");}));
["dragleave","drop"].forEach(n=>$("dropzone").addEventListener(n,e=>{e.preventDefault();$("dropzone").classList.remove("dragover");}));
$("dropzone").addEventListener("drop",e=>addFiles(e.dataTransfer.files));
$("fileList").addEventListener("click",e=>{const b=e.target.closest("[data-remove-file]");if(b){state.files.splice(+b.dataset.removeFile,1);renderFiles();}});
$("extractBtn").addEventListener("click",async()=>{if(!state.files.length)return;const b=$("extractBtn");b.disabled=true;b.textContent=state.vcfMode?"Conversion en cours…":"Extraction en cours…";state.contacts=[];state.nextId=1;const errors=[];for(let i=0;i<state.files.length;i++){status("Analyse de "+state.files[i].name+" ("+(i+1)+"/"+state.files.length+")…");try{await parseFile(state.files[i]);}catch(e){errors.push(state.files[i].name+": "+(e.message||"erreur"));}}render();$("results").hidden=false;status(errors.length?"Fichiers ignorés : "+errors.join(" · "):state.contacts.length?(state.vcfMode?"Conversion terminée : choisissez un format d’export.":"Extraction terminée."):"Aucun numéro reconnu. Vérifiez les fichiers.");b.textContent=state.vcfMode?"Convertir les VCF →":"Extraire les contacts →";b.disabled=!state.files.length;});
$("searchInput").addEventListener("input",render);
$("selectAll").addEventListener("change",e=>{$("contactRows").querySelectorAll(".row-check").forEach(cb=>cb.checked=e.target.checked);$("deleteSelectedBtn").disabled=!e.target.checked;});
$("deleteSelectedBtn").addEventListener("click",()=>{const ids=new Set(selected());state.contacts=state.contacts.filter(c=>!ids.has(c.id));render();});
$("contactRows").addEventListener("change",e=>{const tr=e.target.closest("tr");if(!tr)return;if(e.target.matches(".row-check")){$("deleteSelectedBtn").disabled=!selected().length;return;}const c=state.contacts.find(x=>x.id===+tr.dataset.id);if(!c)return;if(e.target.dataset.field==="name"){c.name=e.target.value.trim();c.uncertain=!c.name;}if(e.target.dataset.field==="phone"){const p=phone(e.target.value);if(!p){e.target.value=c.phone;status("Numéro invalide : vérifiez les chiffres.",true);return;}c.phone=p;e.target.value=p;}});
$("contactRows").addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b)return;const c=state.contacts.find(x=>x.id===+b.closest("tr").dataset.id);if(!c)return;if(b.dataset.action==="delete"){state.contacts=state.contacts.filter(x=>x.id!==c.id);render();return;}const d=c.phone.replace(/\D/g,"");if(d.length===10&&d.startsWith("0")&&!c.phone.startsWith("+")){status("Ajoutez l’indicatif international, par exemple +212.",true);return;}window.open("https://wa.me/"+d,"_blank","noopener,noreferrer");});
$("dedupeBtn").addEventListener("click",()=>{const groups=new Map();state.contacts.forEach(c=>{const k=phoneKey(c.phone);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);});const dup=[...groups.values()].filter(g=>g.length>1),box=$("duplicateNotice");box.hidden=false;if(!dup.length){box.textContent="Aucun doublon détecté.";return;}box.textContent=dup.length+" groupe(s) de doublons détecté(s). ";const b=document.createElement("button");b.className="btn light";b.textContent="Supprimer les doublons";b.onclick=()=>{const seen=new Set();state.contacts=state.contacts.filter(c=>{const k=phoneKey(c.phone);if(seen.has(k))return false;seen.add(k);return true;});render();status("Doublons supprimés.");};box.appendChild(b);});
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function vesc(s){return String(s||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");}
$("vcfBtn").addEventListener("click",()=>{if(!state.contacts.length){status("Aucun contact à exporter.",true);return;}download(state.contacts.map(c=>"BEGIN:VCARD\r\nVERSION:3.0\r\nN:"+vesc(c.name)+";;;;\r\nFN:"+vesc(c.name||c.phone)+"\r\nTEL;TYPE=CELL:"+c.phone+"\r\nEND:VCARD").join("\r\n")+"\r\n","contacts.vcf","text/vcard;charset=utf-8");});
function exportReady(){if(!state.contacts.length){status("Aucun contact à exporter.",true);return false;}return true;}
$("csvBtn").addEventListener("click",()=>{if(!exportReady())return;const q=v=>'"'+String(v||"").replace(/"/g,'""')+'"';download("\ufeffNom,Numéro de téléphone\r\n"+state.contacts.map(c=>q(c.name)+","+q(c.phone)).join("\r\n"),"contacts.csv","text/csv;charset=utf-8");});
$("xlsxBtn").addEventListener("click",()=>{if(!exportReady())return;try{const rows=[["Nom","Numéro de téléphone"],...state.contacts.map(c=>[c.name,c.phone])];const ws=XLSX.utils.aoa_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Contacts");XLSX.writeFile(wb,"contacts.xlsx");status("Fichier XLSX téléchargé.");}catch(e){status("Erreur lors de la création du fichier XLSX.",true);}});
$("pdfBtn").addEventListener("click",()=>{if(!exportReady())return;try{const {jsPDF}=window.jspdf;const doc=new jsPDF();doc.setFontSize(16);doc.text("Liste des contacts",14,16);doc.setFontSize(10);let y=27;doc.text("Nom",14,y);doc.text("Numero de telephone",100,y);y+=7;state.contacts.forEach((c,i)=>{if(y>280){doc.addPage();y=18;}doc.text(doc.splitTextToSize(String(c.name||"Nom inconnu"),75),14,y);doc.text(String(c.phone||""),100,y);y+=7;});doc.save("contacts.pdf");status("Fichier PDF téléchargé.");}catch(e){status("Erreur PDF : vérifiez votre connexion Internet.",true);}});
$("docxBtn").addEventListener("click",async()=>{if(!exportReady())return;try{const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType}=window.docx;const rows=[new TableRow({children:["Nom","Numéro de téléphone"].map(t=>new TableCell({children:[new Paragraph({children:[new TextRun({text:t,bold:true})]})]}))}),...state.contacts.map(c=>new TableRow({children:[c.name||"Nom inconnu",c.phone||""].map(t=>new TableCell({children:[new Paragraph(String(t))]}))}))];const doc=new Document({sections:[{children:[new Paragraph({children:[new TextRun({text:"Liste des contacts",bold:true,size:30})]}),new Table({rows,width:{size:100,type:WidthType.PERCENTAGE}})]}]});const blob=await Packer.toBlob(doc);download(blob,"contacts.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document");status("Fichier DOCX téléchargé.");}catch(e){status("Erreur DOCX : vérifiez votre connexion Internet.",true);}});
$("clearBtn").addEventListener("click",()=>{if(!confirm("Effacer les fichiers et tous les contacts extraits ?"))return;state.files=[];state.contacts=[];renderFiles();render();$("results").hidden=true;$("searchInput").value="";status("");});
renderFiles();render();
