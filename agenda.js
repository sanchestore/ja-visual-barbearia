/* =====================================================================
   J.A VISUAL BARBEARIA — configuração + camada de agenda
   ---------------------------------------------------------------------
   MODO APRESENTAÇÃO: com URL_AGENDA vazio, tudo funciona no próprio
   navegador (dados de demonstração salvos localmente).
   Depois da aprovação: cole a URL do Apps Script (termina em /exec) em
   URL_AGENDA e o site passa a gravar direto no Google Agenda.
   ===================================================================== */

const URL_AGENDA = "";                 // ex.: "https://script.google.com/macros/s/XXXX/exec"
const WHATSAPP_NUMERO = "5519971676966";
const INSTAGRAM = "https://www.instagram.com/j.avisualbarbearia/";
const ENDERECO = "R. Madrid, 416 — Jd. Colina Verde, Piracicaba-SP";
const SENHA_DEMO = "jav3178";          // senha do painel no modo apresentação

const HORARIOS = { 0:null, 1:["09:00","19:00"], 2:["09:00","19:00"], 3:["09:00","19:00"], 4:["09:00","19:00"], 5:["08:00","18:00"], 6:["08:00","18:00"] };
const PASSO_MIN = 30;
const ANTECEDENCIA_MIN = 30;
const DIAS_A_FRENTE = 30;

const FERIADOS = [
  "2026-01-01","2026-02-16","2026-02-17","2026-04-03","2026-04-21","2026-05-01","2026-06-04",
  "2026-07-09","2026-08-01","2026-09-07","2026-10-12","2026-11-02","2026-11-15","2026-11-20","2026-12-25",
  "2027-01-01","2027-02-08","2027-02-09","2027-03-26","2027-04-21","2027-05-01","2027-05-27",
  "2027-07-09","2027-08-01","2027-09-07","2027-10-12","2027-11-02","2027-11-15","2027-11-20","2027-12-25"
];

// semana = segunda a quarta | fim = quinta a sábado e feriados | duracao em minutos
const SERVICOS = {
  "Cabelo":         { semana:30, fim:35, duracao:30,  grupo:"corte",   desc:"Corte na máquina e tesoura, do social ao degradê." },
  "Barba":          { semana:25, fim:30, duracao:30,  grupo:"corte",   desc:"Barba alinhada na navalha com toalha quente." },
  "Cabelo e barba": { semana:50, fim:60, duracao:60,  grupo:"corte",   desc:"O combo completo — sai pronto pro rolê.", combo:true },
  "Pezinho":        { semana:10, fim:10, duracao:15,  grupo:"extra",   desc:"Acabamento do contorno entre um corte e outro." },
  "Sobrancelha":    { semana:10, fim:10, duracao:15,  grupo:"extra",   desc:"Limpeza e alinhamento na navalha." },
  "Pigmentação":    { semana:30, fim:30, duracao:30,  grupo:"quimica", desc:"Preenche falhas e realça o corte e a barba." },
  "Alisamento":     { semana:30, fim:30, duracao:60,  grupo:"quimica", desc:"Fios alinhados e fáceis de pentear." },
  "Luzes":          { semana:40, fim:40, duracao:120, grupo:"quimica", desc:"Platinado, nevou e luzes." }
};

/* ----------------------------- utilidades ----------------------------- */
const pad = n => String(n).padStart(2,"0");
function isoLocal(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function hojeISO(){ return isoLocal(new Date()); }
function addDias(iso, n){ const [y,m,d] = iso.split("-").map(Number); return isoLocal(new Date(y, m-1, d+n)); }
function diaSemana(iso){ const [y,m,d] = iso.split("-").map(Number); return new Date(y, m-1, d).getDay(); }
function minutos(h){ const [a,b] = h.split(":").map(Number); return a*60+b; }
function hhmm(m){ return pad(Math.floor(m/60))+":"+pad(m%60); }
function soDigitos(t){ return String(t||"").replace(/\D/g,""); }
function reais(v){ return "R$ " + Number(v).toFixed(2).replace(".",","); }
function dataBR(iso){ const p = iso.split("-"); return p[2]+"/"+p[1]+"/"+p[0]; }
function duracaoTxt(min){ const h = Math.floor(min/60), m = min%60; return h ? (m ? h+"h"+pad(m) : h+"h") : m+" min"; }
const DIAS_CURTO = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DIAS_LONGO = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function ehFeriado(iso){ return FERIADOS.includes(iso); }
function faixaPreco(iso){ if(ehFeriado(iso)) return "fim"; const d = diaSemana(iso); return (d>=4 || d===0) ? "fim" : "semana"; }
function calcular(lista, iso){
  const faixa = faixaPreco(iso);
  let total = 0, duracao = 0;
  const nomes = lista.filter(n => SERVICOS[n]);
  nomes.forEach(n => { total += SERVICOS[n][faixa]; duracao += SERVICOS[n].duracao; });
  return { nomes, total, duracao, faixa };
}

/* ----------------------- agenda de demonstração ----------------------- */
const CHAVE_DEMO = "jav_demo_v1";

function demoLer(){
  let db = null;
  try{ db = JSON.parse(localStorage.getItem(CHAVE_DEMO) || "null"); }catch(e){}
  if(!db){ db = demoSemente(); demoSalvar(db); }
  return db;
}
function demoSalvar(db){ try{ localStorage.setItem(CHAVE_DEMO, JSON.stringify(db)); }catch(e){} }
function demoReset(){ try{ localStorage.removeItem(CHAVE_DEMO); }catch(e){} }
function novoId(){ return Math.random().toString(36).slice(2,10); }
function gerarCodigo(){ const L="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c=""; for(let i=0;i<5;i++) c+=L[Math.floor(Math.random()*L.length)]; return c; }

function demoSemente(){
  // alguns horários já ocupados para a apresentação parecer real
  const nomes = [["Lucas","19991234567"],["Gabriel","19998887766"],["Matheus","19997776655"],["Pedro H.","19996665544"],["Rafael","19995554433"],["Enzo (infantil)","19994443322"],["João Vitor","19993332211"]];
  const servs = [["Cabelo e barba"],["Cabelo"],["Cabelo","Sobrancelha"],["Barba"],["Cabelo","Pezinho"],["Cabelo"],["Luzes"]];
  const ags = [];
  let k = 0;
  for(let d=0; d<6; d++){
    const iso = addDias(hojeISO(), d);
    const h = HORARIOS[diaSemana(iso)];
    if(!h) continue;
    const base = minutos(h[0]);
    const slots = [base+60, base+150, base+240, base+330, base+420].slice(0, d===0 ? 4 : 3);
    slots.forEach((m, i) => {
      const [nome, tel] = nomes[k % nomes.length];
      const lista = servs[k % servs.length];
      const c = calcular(lista, iso);
      const passou = d===0 && m + c.duracao < (new Date().getHours()*60 + new Date().getMinutes());
      ags.push({ id:novoId(), codigo:gerarCodigo(), nome, tel, servicos:c.nomes, total:c.total, duracao:c.duracao,
                 data:iso, hora:hhmm(m), status: passou ? "concluido" : (i%2 ? "confirmado" : "pendente"), origem:"site" });
      k++;
    });
  }
  const clientes = {};
  ags.forEach(a => { clientes[a.tel] = { nome:a.nome, tel:a.tel, ultimo:a.data, visitas:(clientes[a.tel]?.visitas||0)+1 }; });
  return { agendamentos: ags, extras: [], clientes, senha: SENHA_DEMO };
}

function demoLivres(db, data, duracao, ignorarId, ehBarbeiro){
  const hoje = hojeISO();
  if(data < hoje) return [];
  if(!ehBarbeiro && data > addDias(hoje, DIAS_A_FRENTE)) return [];
  const janelas = [];
  const h = HORARIOS[diaSemana(data)];
  if(h) janelas.push([minutos(h[0]), minutos(h[1])]);
  db.extras.filter(x => x.data === data).forEach(x => janelas.push([minutos(x.ini), minutos(x.fim)]));
  const ocupados = db.agendamentos.filter(a => a.data === data && a.id !== ignorarId)
    .map(a => [minutos(a.hora), minutos(a.hora) + a.duracao]);
  const agora = new Date();
  const agoraMin = data === hoje ? agora.getHours()*60 + agora.getMinutes() + (ehBarbeiro ? 0 : ANTECEDENCIA_MIN) : -1;
  const vistos = {}, out = [];
  janelas.forEach(j => {
    for(let m = j[0]; m + duracao <= j[1]; m += PASSO_MIN){
      if(m < agoraMin || vistos[m]) continue;
      if(!ocupados.some(o => m < o[1] && m + duracao > o[0])){ vistos[m] = 1; out.push(m); }
    }
  });
  return out.sort((a,b) => a-b).map(hhmm);
}

function demoAcao(acao, b){
  const db = demoLer();
  const precisaSenha = !["horarios","config","agendar","meu_buscar","meu_horarios","meu_remarcar","meu_cancelar"].includes(acao);
  if(precisaSenha && b.senha !== db.senha) return { ok:false, erro:"Senha incorreta." };
  const acharCod = () => db.agendamentos.find(a => a.codigo === String(b.codigo||"").trim().toUpperCase() && soDigitos(a.tel).slice(-8) === soDigitos(b.telefone).slice(-8) && a.data >= addDias(hojeISO(), -1));
  const acharId = () => db.agendamentos.find(a => a.id === b.id);
  const salvar = r => { demoSalvar(db); return r; };

  switch(acao){
    case "config": return { ok:true };
    case "horarios": return { ok:true, horarios: demoLivres(db, b.data, Number(b.duracao)||30, null, false) };
    case "agendar":
    case "pro_agendar": {
      const pro = acao === "pro_agendar";
      const nome = String(b.nome||"").trim(), tel = soDigitos(b.telefone);
      if(!nome) return { ok:false, erro:"Informe o nome." };
      if(tel.length < 10) return { ok:false, erro:"Informe um WhatsApp válido com DDD." };
      const c = calcular(b.servicos||[], b.data);
      if(!c.nomes.length) return { ok:false, erro:"Escolha pelo menos um serviço." };
      const dur = pro && Number(b.duracao) ? Number(b.duracao) : c.duracao;
      if(!demoLivres(db, b.data, dur, null, pro).includes(b.hora)) return { ok:false, erro:"Esse horário acabou de ser ocupado. Escolha outro, por favor." };
      const ag = { id:novoId(), codigo:gerarCodigo(), nome, tel, servicos:c.nomes, total:c.total, duracao:dur, data:b.data, hora:b.hora, status: pro ? "confirmado" : "pendente", origem: pro ? "painel" : "site" };
      db.agendamentos.push(ag);
      const cl = db.clientes[tel] || { visitas:0 };
      db.clientes[tel] = { nome, tel, ultimo:b.data, visitas:cl.visitas + 1 };
      return salvar({ ok:true, codigo:ag.codigo, total:ag.total, duracao:dur, id:ag.id });
    }
    case "meu_buscar": { const a = acharCod(); return a ? { ok:true, agendamento:a } : { ok:false, erro:"Não encontramos agendamento com esse WhatsApp e código." }; }
    case "meu_horarios": { const a = acharCod(); return a ? { ok:true, horarios: demoLivres(db, b.data, a.duracao, a.id, false) } : { ok:false, erro:"Agendamento não encontrado." }; }
    case "meu_remarcar":
    case "pro_remarcar": {
      const pro = acao === "pro_remarcar";
      const a = pro ? acharId() : acharCod();
      if(!a) return { ok:false, erro:"Agendamento não encontrado." };
      if(!demoLivres(db, b.data, a.duracao, a.id, pro).includes(b.hora)) return { ok:false, erro:"Esse horário não está mais livre." };
      a.data = b.data; a.hora = b.hora;
      if(a.servicos.length){ a.total = calcular(a.servicos, a.data).total; }
      return salvar({ ok:true });
    }
    case "meu_cancelar":
    case "pro_cancelar": {
      const a = acao === "pro_cancelar" ? acharId() : acharCod();
      if(!a) return { ok:false, erro:"Agendamento não encontrado." };
      db.agendamentos = db.agendamentos.filter(x => x !== a);
      return salvar({ ok:true });
    }
    case "login": return { ok:true };
    case "pro_listar": {
      const ini = b.data || hojeISO(), fim = addDias(ini, Number(b.dias)||14);
      return { ok:true, agendamentos: db.agendamentos.filter(a => a.data >= ini && a.data < fim).sort((x,y) => (x.data+x.hora).localeCompare(y.data+y.hora)) };
    }
    case "pro_horarios": return { ok:true, horarios: demoLivres(db, b.data, Number(b.duracao)||30, b.ignorar||null, true) };
    case "pro_status": { const a = acharId(); if(!a) return { ok:false, erro:"Não encontrado." }; a.status = b.status; return salvar({ ok:true }); }
    case "bloquear": {
      if(minutos(b.fim) <= minutos(b.ini)) return { ok:false, erro:"O fim precisa ser depois do início." };
      db.agendamentos.push({ id:novoId(), codigo:"", nome:"⛔ " + (b.motivo || "Bloqueado"), tel:"", servicos:[], total:0, duracao:minutos(b.fim)-minutos(b.ini), data:b.data, hora:b.ini, status:"", bloqueio:true });
      return salvar({ ok:true });
    }
    case "extras_listar": return { ok:true, extras: db.extras };
    case "extras_add": {
      if(minutos(b.fim) <= minutos(b.ini)) return { ok:false, erro:"O fim precisa ser depois do início." };
      db.extras.push({ id:novoId(), data:b.data, ini:b.ini, fim:b.fim });
      db.extras.sort((x,y) => (x.data+x.ini).localeCompare(y.data+y.ini));
      return salvar({ ok:true, extras: db.extras });
    }
    case "extras_remover": db.extras = db.extras.filter(x => x.id !== b.id); return salvar({ ok:true, extras: db.extras });
    case "clientes_buscar": {
      const q = String(b.q||"").toLowerCase().trim(), qd = soDigitos(q);
      const l = Object.values(db.clientes).filter(c => !q || c.nome.toLowerCase().includes(q) || (qd && c.tel.includes(qd)))
        .sort((x,y) => String(y.ultimo).localeCompare(String(x.ultimo)));
      return { ok:true, clientes: l.slice(0,50), total: l.length };
    }
    case "resumo": {
      const hoje = hojeISO(), d = diaSemana(hoje), seg = addDias(hoje, -((d+6)%7)), fimS = addDias(seg, 7);
      const evs = db.agendamentos.filter(a => !a.bloqueio && a.data >= seg && a.data < fimS);
      const soma = l => l.reduce((s,x) => s + (x.status === "faltou" ? 0 : x.total), 0);
      const h = evs.filter(a => a.data === hoje);
      const conc = evs.filter(a => a.status === "concluido");
      return { ok:true, hoje:{ qtd:h.length, valor:soma(h), concluidos:h.filter(a => a.status==="concluido").length },
               semana:{ qtd:evs.length, valor:soma(evs), concluidos:conc.length, valorConcluido:soma(conc) } };
    }
    case "trocar_senha": {
      const nova = String(b.nova||"").trim();
      if(nova.length < 4) return { ok:false, erro:"A nova senha precisa ter pelo menos 4 caracteres." };
      db.senha = nova; return salvar({ ok:true });
    }
  }
  return { ok:false, erro:"Ação desconhecida." };
}

/* --------------------------- chamada única --------------------------- */
const MODO_DEMO = !URL_AGENDA;

async function api(acao, corpo){
  corpo = Object.assign({}, corpo || {}, { acao });
  if(MODO_DEMO){
    await new Promise(r => setTimeout(r, 250)); // simula a rede
    return demoAcao(acao, corpo);
  }
  if(acao === "horarios"){
    const r = await fetch(`${URL_AGENDA}?acao=horarios&data=${encodeURIComponent(corpo.data)}&duracao=${corpo.duracao}`);
    return r.json();
  }
  const r = await fetch(URL_AGENDA, { method:"POST", headers:{ "Content-Type":"text/plain;charset=utf-8" }, body: JSON.stringify(corpo) });
  return r.json();
}
