/* =========================================================
   FinControl · camada de dados e autenticação (store.js)
   ---------------------------------------------------------
   • Modo "firebase": Firebase Authentication + Cloud Firestore
     (plano Spark, gratuito) — login real e dados em nuvem.
   • Modo "local":    fallback 100% offline usando
     localStorage do navegador (para testar sem configurar).
   A escolha é automática: se js/config.js tiver as chaves do
   Firebase, ele usa a nuvem; caso contrário, usa o local.
   ========================================================= */
window.Store = (function () {
  "use strict";

  var CFG = window.APP_CONFIG;
  var mode = "local";           // "firebase" | "local"
  var fbReady = false;
  var auth = null, db = null, firebaseApp = null;

  var usersKey = "fincontrol.users";
  var sessaoKey = "fincontrol.sessao";
  var uidKey = function (k, uid) { return "fincontrol." + k + "." + uid; };

  var watchers = { lanc: [], cats: [] };
  var currentUser = null;

  /* ---------------- utilidades ---------------- */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = res;
      s.onerror = function () { rej(new Error("Falha ao carregar " + src)); };
      document.head.appendChild(s);
    });
  }

  function readJSON(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { console.warn("localStorage cheio", e); return false; }
  }

  function sha256(text) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
        .then(function (buf) {
          return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
        })
        .catch(function () { return simpleHash(text); });
    }
    return Promise.resolve(simpleHash(text));
  }
  function simpleHash(text) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < text.length; i++) {
      h1 = (h1 ^ text.charCodeAt(i)) >>> 0; h1 = (h1 * 16777619) >>> 0;
      h2 = (h2 + text.charCodeAt(i) * (i + 7)) >>> 0;
    }
    return "loc_" + h1.toString(16) + h2.toString(16);
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function agora() { return new Date().toISOString(); }

  function normalizeDoc(d) {
    var o = d.data();
    delete o._id;
    return o;
  }

  /* ---------------- inicialização ---------------- */
  function precisaFirebase() {
    var f = CFG.firebase || {};
    return CFG.modo !== "local" && f.apiKey && !/^SUA_/i.test(f.apiKey) && f.projectId;
  }

  function init() {
    if (CFG.modo === "firebase" || precisaFirebase()) {
      return firebaseInit().then(function () { mode = "firebase"; return status(); })
        .catch(function (e) {
          console.warn("Firebase indisponível, usando modo local.", e);
          mode = "local"; return status();
        });
    }
    mode = "local";
    return Promise.resolve(status());
  }

  function firebaseInit() {
    var base = "https://www.gstatic.com/firebasejs/10.12.5/";
    return loadScript(base + "firebase-app-compat.js")
      .then(function () { return loadScript(base + "firebase-auth-compat.js"); })
      .then(function () { return loadScript(base + "firebase-firestore-compat.js"); })
      .then(function () {
        firebase.initializeApp(CFG.firebase);
        firebaseApp = firebase.app();
        auth = firebase.auth();
        db = firebase.firestore();
        try { db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* ignora */ }
        fbReady = true;
      });
  }

  function status() {
    return { mode: mode, firebase: mode === "firebase" };
  }

  /* ---------------- autenticação ---------------- */
  function onAuth(cb) {
    if (mode === "firebase") {
      return auth.onAuthStateChanged(function (u) {
        currentUser = u ? { uid: u.uid, email: u.email, nome: (u.displayName || u.email || "").split("@")[0] } : null;
        if (currentUser) carregarPerfilFirebase();
        cb(currentUser);
      });
    }
    // local
    return lêSessãoLocal().then(function (u) { currentUser = u; cb(u); });
  }

  function carregarPerfilFirebase() {
    return db.collection("usuarios").doc(currentUser.uid).get().then(function (doc) {
      if (doc.exists && doc.data().nome) currentUser.nome = doc.data().nome;
    }).catch(function () {});
  }

  function lêSessãoLocal() {
    var s = readJSON(sessaoKey, null);
    if (!s) return Promise.resolve(null);
    var users = readJSON(usersKey, {});
    var u = users[s.email];
    if (!u) return Promise.resolve(null);
    // o e-mail vem da chave da sessão (o registro do usuário pode não guardá-lo
    // em contas criadas em versões antigas)
    return Promise.resolve({ uid: u.uid, email: s.email, nome: u.nome });
  }

  function signUp(dados) {
    if (mode === "firebase") {
      return auth.createUserWithEmailAndPassword(dados.email, dados.senha)
        .then(function (cred) {
          return cred.user.updateProfile({ displayName: dados.nome }).catch(function () {});
        })
        .then(function () {
          return db.collection("usuarios").doc(currentUser ? currentUser.uid : auth.currentUser.uid)
            .set({ nome: dados.nome, email: dados.email, criadoEm: agora() }, { merge: true });
        })
        .then(function () { return seedCategoriasFirebase(auth.currentUser.uid); })
        .then(function () {
          currentUser = { uid: auth.currentUser.uid, email: dados.email, nome: dados.nome };
          return currentUser;
        });
    }
    var users = readJSON(usersKey, {});
    if (users[dados.email]) return Promise.reject(new Error("Já existe uma conta com este e-mail."));
    return sha256(dados.senha).then(function (hash) {
      var uid = uuid();
      users[dados.email] = { uid: uid, email: dados.email, nome: dados.nome, hash: hash, criadoEm: agora() };
      writeJSON(usersKey, users);
      writeJSON(sessaoKey, { email: dados.email });
      gravarCategoriasLocal(uid, categoriasPadrao());
      currentUser = { uid: uid, email: dados.email, nome: dados.nome };
      return currentUser;
    });
  }

  function signIn(email, senha) {
    if (mode === "firebase") {
      return auth.signInWithEmailAndPassword(email, senha).then(function (cred) {
        currentUser = { uid: cred.user.uid, email: cred.user.email, nome: cred.user.displayName || email.split("@")[0] };
        return carregarPerfilFirebase().then(function () { return currentUser; });
      });
    }
    var users = readJSON(usersKey, {});
    var u = users[email];
    if (!u) return Promise.reject(new Error("E-mail não encontrado. Crie uma conta primeiro."));
    return sha256(senha).then(function (hash) {
      if (hash !== u.hash) return Promise.reject(new Error("Senha incorreta."));
      writeJSON(sessaoKey, { email: email });
      currentUser = { uid: u.uid, email: email, nome: u.nome };
      return currentUser;
    });
  }

  function sendPasswordReset(email) {
    if (mode === "firebase") return auth.sendPasswordResetEmail(email);
    var users = readJSON(usersKey, {});
    if (!users[email]) return Promise.reject(new Error("Não existe conta com este e-mail."));
    // no modo local não há servidor de e-mail: simulamos o fluxo
    return Promise.resolve({ local: true });
  }

  function signOut() {
    if (mode === "firebase") return auth.signOut();
    localStorage.removeItem(sessaoKey);
    currentUser = null;
    return Promise.resolve();
  }

  function updateProfile(nome) {
    if (!currentUser) return Promise.reject(new Error("Sem sessão."));
    if (mode === "firebase") {
      return auth.currentUser.updateProfile({ displayName: nome })
        .then(function () { return db.collection("usuarios").doc(currentUser.uid).set({ nome: nome }, { merge: true }); })
        .then(function () { currentUser.nome = nome; });
    }
    var users = readJSON(usersKey, {});
    if (users[currentUser.email]) { users[currentUser.email].nome = nome; writeJSON(usersKey, users); }
    currentUser.nome = nome;
    return Promise.resolve();
  }

  /* ---------------- lançamentos ---------------- */
  function colLanc() {
    return db.collection("usuarios").doc(currentUser.uid).collection("lancamentos");
  }
  function colCats() {
    return db.collection("usuarios").doc(currentUser.uid).collection("categorias");
  }

  /* v1.1 — migração de tipos antigos: "Transferência"/"Transferencia"/"pix" → "PIX".
     Só há escrita enquanto existirem itens legados (após a primeira gravação o
     snapshot volta sem legados e o ciclo se encerra). */
  function ehTipoLegado(t) {
    return t === "Transferência" || t === "Transferencia" || t === "pix" || t === "Pix";
  }
  function tipoMigrado(t) { return ehTipoLegado(t) ? "PIX" : t; }

  function watchLanc(cb) {
    watchers.lanc.push(cb);
    var stop = function () {
      var i = watchers.lanc.indexOf(cb); if (i > -1) watchers.lanc.splice(i, 1);
    };
    if (mode === "firebase") {
      var unsub = colLanc().orderBy("data", "desc").onSnapshot(function (snap) {
        var lista = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; });
        var legados = snap.docs.filter(function (d) { return ehTipoLegado(d.data().tipo); });
        if (legados.length) {
          var b = db.batch();
          legados.forEach(function (d) { b.update(d.ref, { tipo: "PIX" }); });
          b.commit().catch(function (e) { console.warn("migração Transferência→PIX:", e); });
        }
        cb(lista.map(function (o) { if (ehTipoLegado(o.tipo)) o.tipo = "PIX"; return o; }));
      }, function (err) { console.warn(err); });
      return function () { stop(); unsub(); };
    }
    cb(getLancLocal());
    return stop;
  }

  function getLancLocal() {
    if (!currentUser) return [];
    var arr = readJSON(uidKey("lanc", currentUser.uid), []);
    // garante que todo item tenha id (dados importados em versões antigas, backups etc.)
    var mudou = false;
    arr.forEach(function (x) { if (!x.id) { x.id = uuid(); mudou = true; } });
    // v1.1: migra tipos antigos de transferência para PIX
    arr.forEach(function (x) { var t = tipoMigrado(x.tipo); if (t !== x.tipo) { x.tipo = t; mudou = true; } });
    if (mudou) writeJSON(uidKey("lanc", currentUser.uid), arr);
    return arr;
  }
  function setLancLocal(arr) {
    writeJSON(uidKey("lanc", currentUser.uid), arr);
    emit("lanc");
  }
  function emit(kind) {
    if (kind === "lanc") watchers.lanc.forEach(function (cb) { cb(getLancLocal()); });
    if (kind === "cats") watchers.cats.forEach(function (cb) { cb(getCatsLocal()); });
  }

  function addLancamento(item) {
    item.criadoEm = agora(); item.atualizadoEm = agora();
    if (mode === "firebase") { item.uid = currentUser.uid; return colLanc().add(item).then(function (r) { return r.id; }); }
    var arr = getLancLocal(); item.id = uuid(); arr.unshift(item); setLancLocal(arr);
    return Promise.resolve(item.id);
  }

  function updateLancamento(id, item) {
    item.atualizadoEm = agora();
    if (mode === "firebase") { delete item.id; return colLanc().doc(id).set(item, { merge: true }); }
    var arr = getLancLocal().map(function (x) { if (x.id === id) { item.id = id; item.criadoEm = x.criadoEm; return item; } return x; });
    setLancLocal(arr);
    return Promise.resolve();
  }

  function deleteLancamento(id) {
    if (mode === "firebase") return colLanc().doc(id).delete();
    setLancLocal(getLancLocal().filter(function (x) { return x.id !== id; }));
    return Promise.resolve();
  }

  function importarLancamentos(items, ignorarDuplicados) {
    var existentes = modoAtualIds();
    var novos = items.filter(function (it) {
      if (!ignorarDuplicados) return true;
      return existentes.indexOf(chave(it)) === -1;
    });
    if (!novos.length) return Promise.resolve(0);
    novos.forEach(function (it) {
      it.criadoEm = agora(); it.atualizadoEm = agora();
      if (!it.situacao) it.situacao = it.tipo === "Receita" ? "Recebido"
        : (it.tipo === "PIX" ? "Pendente" : "Pago");
      if (!it.observacoes) it.observacoes = "Importado";
    });

    if (mode === "firebase") {
      var BATCH = 450, proms = [], i = 0;
      while (i < novos.length) {
        var parte = novos.slice(i, i + BATCH);
        var batch = db.batch();
        parte.forEach(function (it) { batch.set(colLanc().doc(), it); });
        proms.push(batch.commit());
        i += BATCH;
      }
      return Promise.all(proms).then(function () { return novos.length; });
    }
    novos.forEach(function (it) { if (!it.id) it.id = uuid(); });
    var arr = getLancLocal().concat(novos);
    arr.sort(function (a, b) { return (b.data || "").localeCompare(a.data || ""); });
    setLancLocal(arr);
    return Promise.resolve(novos.length);
  }

  function modoAtualIds() {
    if (mode === "firebase") return []; // validação feita no cliente via lista carregada
    return getLancLocal().map(chave);
  }
  function chave(it) { return [it.data, it.tipo, it.categoria, it.descricao, Number(it.valor).toFixed(2)].join("|"); }

  function apagarTudo() {
    if (mode === "firebase") {
      return colLanc().get().then(function (snap) {
        var b = db.batch(); snap.docs.forEach(function (d) { b.delete(d.ref); }); return b.commit();
      });
    }
    setLancLocal([]);
    return Promise.resolve();
  }

  /* ---------------- categorias ---------------- */
  function categoriasPadrao() {
    var cores = ["#e11d48", "#f59e0b", "#059669", "#2563eb", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];
    var nomes = ["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Cartão de crédito", "Outros"];
    return nomes.map(function (n, i) { return { nome: n, tipo: "Despesa", cor: cores[i % cores.length] }; });
  }

  function gravarCategoriasLocal(uid, cats) {
    writeJSON(uidKey("cats", uid), cats.map(function (c) { c.id = uuid(); return c; }));
  }
  function seedCategoriasFirebase(uid) {
    var batch = db.batch();
    categoriasPadrao().forEach(function (c) { batch.set(db.collection("usuarios").doc(uid).collection("categorias").doc(), c); });
    return batch.commit();
  }

  function getCatsLocal() { return currentUser ? readJSON(uidKey("cats", currentUser.uid), []) : []; }

  function watchCats(cb) {
    watchers.cats.push(cb);
    var stop = function () {
      var i = watchers.cats.indexOf(cb); if (i > -1) watchers.cats.splice(i, 1);
    };
    if (mode === "firebase") {
      var unsub = colCats().orderBy("nome").onSnapshot(function (snap) {
        cb(snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }));
      }, function (err) { console.warn(err); });
      return function () { stop(); unsub(); };
    }
    cb(getCatsLocal());
    return stop;
  }

  function addCategoria(c) {
    c.criadoEm = agora();
    if (mode === "firebase") { return colCats().add(c).then(function (r) { return r.id; }); }
    c.id = uuid();
    var arr = getCatsLocal().concat([c]); writeJSON(uidKey("cats", currentUser.uid), arr); emit("cats");
    return Promise.resolve(c.id);
  }

  function deleteCategoria(id) {
    if (mode === "firebase") return colCats().doc(id).delete();
    writeJSON(uidKey("cats", currentUser.uid), getCatsLocal().filter(function (c) { return c.id !== id; }));
    emit("cats");
    return Promise.resolve();
  }

  function updateCategoria(id, dados) {
    dados.atualizadoEm = agora();
    if (mode === "firebase") return colCats().doc(id).update(dados);
    writeJSON(uidKey("cats", currentUser.uid), getCatsLocal().map(function (c) {
      if (c.id === id) { Object.keys(dados).forEach(function (k) { if (k !== "id") c[k] = dados[k]; }); }
      return c;
    }));
    emit("cats");
    return Promise.resolve();
  }

  /* ---------------- contas e carteiras (v1.2) ---------------- */
  function colContas() {
    return db.collection("usuarios").doc(currentUser.uid).collection("contas");
  }
  function colMetas() {
    return db.collection("usuarios").doc(currentUser.uid).collection("metas");
  }
  function contaPadrao() {
    return { nome: "Conta principal", tipo: "Conta corrente", banco: "—", saldoInicial: 0, cor: "#6366f1" };
  }
  function getContasLocal() { return currentUser ? readJSON(uidKey("contas", currentUser.uid), []) : []; }
  function getMetasLocal() { return currentUser ? readJSON(uidKey("metas", currentUser.uid), []) : []; }

  function watchContas(cb) {
    watchers.contas = watchers.contas || [];
    watchers.contas.push(cb);
    var stop = function () {
      var i = watchers.contas.indexOf(cb); if (i > -1) watchers.contas.splice(i, 1);
    };
    if (mode === "firebase") {
      var unsub = colContas().orderBy("nome").onSnapshot(function (snap) {
        var lista = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; });
        // seed preguiçoso: usuários criados antes da v1.2 recebem "Conta principal"
        var semeado = readJSON(uidKey("seedConta", currentUser.uid), false);
        if (!lista.length && !semeado) {
          writeJSON(uidKey("seedConta", currentUser.uid), true);
          colContas().add(contaPadrao()).catch(function () {});
        }
        cb(lista);
      }, function (err) { console.warn(err); });
      return function () { stop(); unsub(); };
    }
    var arr = getContasLocal();
    if (!arr.length && !readJSON(uidKey("seedConta", currentUser.uid), false)) {
      writeJSON(uidKey("seedConta", currentUser.uid), true);
      var c = contaPadrao(); c.id = uuid(); arr = [c];
      writeJSON(uidKey("contas", currentUser.uid), arr);
    }
    cb(arr);
    return stop;
  }

  function addConta(c) {
    c.criadoEm = agora();
    if (mode === "firebase") { return colContas().add(c).then(function (r) { return r.id; }); }
    c.id = uuid();
    writeJSON(uidKey("contas", currentUser.uid), getContasLocal().concat([c]));
    if (watchers.contas) watchers.contas.forEach(function (cb) { cb(getContasLocal()); });
    return Promise.resolve(c.id);
  }

  function updateConta(id, dados) {
    dados.atualizadoEm = agora();
    if (mode === "firebase") return colContas().doc(id).update(dados);
    writeJSON(uidKey("contas", currentUser.uid), getContasLocal().map(function (c) {
      if (c.id === id) { Object.keys(dados).forEach(function (k) { if (k !== "id") c[k] = dados[k]; }); }
      return c;
    }));
    if (watchers.contas) watchers.contas.forEach(function (cb) { cb(getContasLocal()); });
    return Promise.resolve();
  }

  function deleteConta(id) {
    if (mode === "firebase") return colContas().doc(id).delete();
    writeJSON(uidKey("contas", currentUser.uid), getContasLocal().filter(function (c) { return c.id !== id; }));
    if (watchers.contas) watchers.contas.forEach(function (cb) { cb(getContasLocal()); });
    return Promise.resolve();
  }

  /* ---------------- metas / caixinhas (v1.2) ---------------- */
  function watchMetas(cb) {
    watchers.metas = watchers.metas || [];
    watchers.metas.push(cb);
    var stop = function () {
      var i = watchers.metas.indexOf(cb); if (i > -1) watchers.metas.splice(i, 1);
    };
    if (mode === "firebase") {
      var unsub = colMetas().orderBy("nome").onSnapshot(function (snap) {
        cb(snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }));
      }, function (err) { console.warn(err); });
      return function () { stop(); unsub(); };
    }
    cb(getMetasLocal());
    return stop;
  }

  function addMeta(m) {
    m.criadoEm = agora();
    if (!m.aportes) m.aportes = [];
    if (mode === "firebase") { return colMetas().add(m).then(function (r) { return r.id; }); }
    m.id = uuid();
    writeJSON(uidKey("metas", currentUser.uid), getMetasLocal().concat([m]));
    if (watchers.metas) watchers.metas.forEach(function (cb) { cb(getMetasLocal()); });
    return Promise.resolve(m.id);
  }

  function updateMeta(id, dados) {
    dados.atualizadoEm = agora();
    if (mode === "firebase") return colMetas().doc(id).update(dados);
    writeJSON(uidKey("metas", currentUser.uid), getMetasLocal().map(function (m) {
      if (m.id === id) { Object.keys(dados).forEach(function (k) { if (k !== "id") m[k] = dados[k]; }); }
      return m;
    }));
    if (watchers.metas) watchers.metas.forEach(function (cb) { cb(getMetasLocal()); });
    return Promise.resolve();
  }

  function deleteMeta(id) {
    if (mode === "firebase") return colMetas().doc(id).delete();
    writeJSON(uidKey("metas", currentUser.uid), getMetasLocal().filter(function (m) { return m.id !== id; }));
    if (watchers.metas) watchers.metas.forEach(function (cb) { cb(getMetasLocal()); });
    return Promise.resolve();
  }

  /* ---------------- sessão / perfil ---------------- */
  function getUser() { return currentUser; }
  function getMode() { return mode; }

  return {
    init: init, status: status, onAuth: onAuth,
    signUp: signUp, signIn: signIn, sendPasswordReset: sendPasswordReset,
    signOut: signOut, updateProfile: updateProfile, getUser: getUser, getMode: getMode,
    watchLanc: watchLanc, watchCats: watchCats,
    addLancamento: addLancamento, updateLancamento: updateLancamento, deleteLancamento: deleteLancamento,
    importarLancamentos: importarLancamentos, apagarTudo: apagarTudo,
    addCategoria: addCategoria, deleteCategoria: deleteCategoria, updateCategoria: updateCategoria,
    watchContas: watchContas, addConta: addConta, updateConta: updateConta, deleteConta: deleteConta,
    watchMetas: watchMetas, addMeta: addMeta, updateMeta: updateMeta, deleteMeta: deleteMeta,
    chave: function (it) { return chave(it); },
    categoriasPadrao: categoriasPadrao
  };
})();
