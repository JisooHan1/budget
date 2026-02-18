import { useState, useEffect, useMemo } from "react";
import { auth, db, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from "firebase/firestore";

// ── 유틸 ──────────────────────────────────────────────────────
const parseDate = (dateStr) => new Date(dateStr + "T00:00:00");
const todayStr  = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const fmt = (n) => new Intl.NumberFormat("ko-KR").format(Math.abs(Math.round(n)));

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DAYS   = ["일","월","화","수","목","금","토"];

const CATEGORIES = {
  income:  ["급여","부수입","용돈","투자수익","기타수입"],
  expense: ["식비","교통","주거","의료","쇼핑","문화","통신","교육","보험","기타지출"],
};
const CAT_ICONS = {
  급여:"💰", 부수입:"🤑", 용돈:"🎁", 투자수익:"📈", 기타수입:"💵",
  식비:"🍱", 교통:"🚌", 주거:"🏠", 의료:"🏥", 쇼핑:"🛍️",
  문화:"🎬", 통신:"📱", 교육:"📚", 보험:"🛡️", 기타지출:"💸",
};

const C = {
  bg:"#F5F6F8", card:"#FFFFFF", border:"#EAECF0",
  text:"#18191B", sub:"#8B939E",
  income:"#00A36C", incomeL:"#EDFAF5",
  expense:"#E84040", expenseL:"#FEF0F0",
  blue:"#3B82F6", blueL:"#EFF6FF",
  accent:"#4C68F5", accentL:"#EEF1FF",
  fixed:"#E08000", fixedL:"#FFF8EC",
};

// ── 로그인 화면 ───────────────────────────────────────────────
function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError("로그인에 실패했어요. 다시 시도해주세요.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px", fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>📒</div>
          <div style={{ fontSize:24, fontWeight:800, color:C.text, letterSpacing:"-0.5px" }}>내 가계부</div>
          <div style={{ fontSize:14, color:C.sub, marginTop:4 }}>어디서든 기록하고 확인하세요</div>
        </div>

        <div style={{ background:C.card, borderRadius:20, padding:"32px 24px", border:`1px solid ${C.border}`, boxShadow:"0 2px 16px #00000010" }}>
          {error && (
            <div style={{ background:C.expenseL, border:`1px solid #FBBFBF`, borderRadius:10, padding:"10px 14px", fontSize:13, color:C.expense, marginBottom:20, textAlign:"center" }}>
              {error}
            </div>
          )}
          
          <button onClick={handleGoogleLogin} disabled={loading} style={{
            width:"100%", background:"#fff", border:"1px solid #dadce0", borderRadius:12, padding:"14px 0",
            color:C.text, fontSize:16, fontWeight:600, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", justifyContent:"center", gap:12, transition:"all .2s",
            opacity:loading?0.6:1,
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.335z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            {loading ? "로그인 중…" : "Google 계정으로 로그인"}
          </button>

          <div style={{ textAlign:"center", marginTop:20, fontSize:12, color:C.sub }}>
            데이터는 클라우드에 안전하게 저장돼요
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:${C.bg}; }
      `}</style>
    </div>
  );
}

// ── 메인 ──────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Noto Sans KR',sans-serif", fontSize:16, color:C.sub }}>
      불러오는 중…
    </div>
  );

  if (!user) return <LoginScreen />;
  return <BudgetApp user={user} />;
}

// ── 가계부 본체 ───────────────────────────────────────────────
function BudgetApp({ user }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tab,   setTab]   = useState("monthly");

  const [transactions, setTransactions] = useState([]);
  const [fixedItems,   setFixedItems]   = useState([]);
  const [loading,      setLoading]      = useState(true);

  const [showForm,      setShowForm]      = useState(false);
  const [editItem,      setEditItem]      = useState(null);
  const [showFixedForm, setShowFixedForm] = useState(false);
  const [editFixed,     setEditFixed]     = useState(null);
  const [showMonthPick, setShowMonthPick] = useState(false);
  const [toast,         setToast]         = useState(null);

  const [form, setForm] = useState({
    date: todayStr(), type:"expense", category:"식비", amount:"", memo:"",
  });
  const [fixedForm, setFixedForm] = useState({ name:"", amount:"", type:"expense" });

  // ── 데이터 로드 ──────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const txQuery = query(collection(db, "transactions"), where("uid", "==", user.uid), orderBy("date", "desc"));
      const fxQuery = query(collection(db, "fixed_items"), where("uid", "==", user.uid));
      
      const [txSnap, fxSnap] = await Promise.all([getDocs(txQuery), getDocs(fxQuery)]);
      
      setTransactions(txSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setFixedItems(fxSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      showToast("데이터를 불러오지 못했어요", false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user.uid]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2000);
  };

  const goPrev  = () => { if (month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); };
  const goNext  = () => { if (month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const monthKey = `${year}-${String(month+1).padStart(2,"0")}`;
  const monthTx  = useMemo(() => transactions.filter(t => t.date.startsWith(monthKey)), [transactions, monthKey]);

  const stats = useMemo(() => {
    const income   = monthTx.filter(t=>t.type==="income" ).reduce((a,t)=>a+Number(t.amount),0);
    const expense  = monthTx.filter(t=>t.type==="expense").reduce((a,t)=>a+Number(t.amount),0);
    const fixedExp = fixedItems.filter(f=>f.type==="expense").reduce((a,f)=>a+Number(f.amount),0);
    const fixedInc = fixedItems.filter(f=>f.type==="income" ).reduce((a,f)=>a+Number(f.amount),0);
    return { income, expense, fixedExp, fixedInc, balance: income - expense };
  }, [monthTx, fixedItems]);

  const byDay = useMemo(() => {
    const map = {};
    monthTx.forEach(t => { if (!map[t.date]) map[t.date]=[]; map[t.date].push(t); });
    return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]));
  }, [monthTx]);

  const catStats = useMemo(() => {
    const map = {};
    monthTx.forEach(t => {
      if (!map[t.category]) map[t.category]={ type:t.type, total:0 };
      map[t.category].total += Number(t.amount);
    });
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  }, [monthTx]);

  // ── 거래 저장/삭제 ───────────────────────────────────────────
  const handleSaveTx = async () => {
    if (!form.amount || isNaN(form.amount) || Number(form.amount)<=0) {
      showToast("금액을 올바르게 입력해주세요", false); return;
    }
    try {
      const payload = { uid:user.uid, date:form.date, type:form.type, category:form.category, amount:Number(form.amount), memo:form.memo||"" };
      if (editItem) {
        await updateDoc(doc(db, "transactions", editItem.id), payload);
      } else {
        await addDoc(collection(db, "transactions"), payload);
      }
      await loadData();
      setShowForm(false); setEditItem(null);
      setForm({ date:todayStr(), type:"expense", category:"식비", amount:"", memo:"" });
      showToast(editItem?"수정했어요 ✓":"저장했어요 ✓");
    } catch (e) {
      console.error(e);
      showToast("저장에 실패했어요", false);
    }
  };

  const handleDeleteTx = async (id) => {
    try {
      await deleteDoc(doc(db, "transactions", id));
      setTransactions(prev => prev.filter(t=>t.id!==id));
      showToast("삭제했어요");
    } catch (e) {
      console.error(e);
      showToast("삭제에 실패했어요", false);
    }
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ date:item.date, type:item.type, category:item.category, amount:String(item.amount), memo:item.memo||"" });
    setShowForm(true);
  };

  // ── 고정항목 저장/삭제 ───────────────────────────────────────
  const handleSaveFixed = async () => {
    if (!fixedForm.name.trim() || !fixedForm.amount || isNaN(fixedForm.amount) || Number(fixedForm.amount)<=0) {
      showToast("항목명과 금액을 입력해주세요", false); return;
    }
    try {
      const payload = { uid:user.uid, name:fixedForm.name, amount:Number(fixedForm.amount), type:fixedForm.type };
      if (editFixed) {
        await updateDoc(doc(db, "fixed_items", editFixed.id), payload);
      } else {
        await addDoc(collection(db, "fixed_items"), payload);
      }
      await loadData();
      setShowFixedForm(false); setEditFixed(null);
      setFixedForm({ name:"", amount:"", type:"expense" });
      showToast(editFixed?"수정했어요 ✓":"저장했어요 ✓");
    } catch (e) {
      console.error(e);
      showToast("저장에 실패했어요", false);
    }
  };

  const handleDeleteFixed = async (id) => {
    try {
      await deleteDoc(doc(db, "fixed_items", id));
      setFixedItems(prev => prev.filter(f=>f.id!==id));
      showToast("삭제했어요");
    } catch (e) {
      console.error(e);
      showToast("삭제에 실패했어요", false);
    }
  };

  const handleTypeChange = (type) => setForm(f=>({...f, type, category:CATEGORIES[type][0]}));
  const isCurrentMonth   = year===today.getFullYear() && month===today.getMonth();

  const handleLogout = () => signOut(auth);

  return (
    <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif", color:C.text, maxWidth:480, margin:"0 auto", paddingBottom:90 }}>

      <header style={{ position:"sticky", top:0, zIndex:50, background:C.card, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px 10px" }}>
          <button onClick={goPrev} style={navBtn}>‹</button>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <button onClick={()=>setShowMonthPick(true)} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ fontSize:19, fontWeight:700, color:C.text }}>{year}년 {MONTHS[month]}</span>
              <span style={{ fontSize:12, color:C.sub }}>▾</span>
            </button>
            {!isCurrentMonth && (
              <button onClick={goToday} style={{ background:C.accentL, border:"none", borderRadius:20, padding:"2px 10px", fontSize:11, color:C.accent, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                오늘로
              </button>
            )}
          </div>
          <button onClick={handleLogout} title="로그아웃" style={{ background:C.bg, border:`1px solid ${C.border}`, color:C.sub, width:36, height:36, borderRadius:10, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            ↩
          </button>
        </div>

        <div style={{ display:"flex" }}>
          {[["monthly","월별요약"],["daily","일별내역"],["fixed","고정항목"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              flex:1, padding:"10px 4px", border:"none", cursor:"pointer", fontFamily:"inherit",
              fontSize:13, fontWeight:600, background:"none", transition:"all .15s",
              color:        tab===k ? C.accent : C.sub,
              borderBottom: tab===k ? `2px solid ${C.accent}` : `2px solid transparent`,
            }}>{l}</button>
          ))}
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign:"center", paddingTop:80, color:C.sub }}>불러오는 중…</div>
      ) : (
        <main style={{ padding:"16px" }}>

          {tab==="monthly" && (
            <div>
              <div style={{ background:C.card, borderRadius:18, padding:"22px 20px", marginBottom:12, border:`1px solid ${C.border}`, boxShadow:"0 1px 6px #00000008" }}>
                <div style={{ fontSize:12, color:C.sub, marginBottom:6, fontWeight:600 }}>{year}년 {MONTHS[month]} 잔액</div>
                <div style={{ fontSize:34, fontWeight:800, letterSpacing:"-1.5px", color:stats.balance>=0?C.income:C.expense, marginBottom:20 }}>
                  {stats.balance>=0?"+":"-"}{fmt(Math.abs(stats.balance))}원
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div style={{ background:C.incomeL, borderRadius:12, padding:"14px 16px" }}>
                    <div style={{ fontSize:11, color:C.income, fontWeight:700, marginBottom:5 }}>▲ 수입</div>
                    <div style={{ fontSize:17, fontWeight:700, color:C.income }}>+{fmt(stats.income)}원</div>
                  </div>
                  <div style={{ background:C.expenseL, borderRadius:12, padding:"14px 16px" }}>
                    <div style={{ fontSize:11, color:C.expense, fontWeight:700, marginBottom:5 }}>▼ 지출</div>
                    <div style={{ fontSize:17, fontWeight:700, color:C.expense }}>-{fmt(stats.expense)}원</div>
                  </div>
                </div>
              </div>

              {fixedItems.length>0 && (
                <div style={{ background:C.fixedL, borderRadius:16, padding:"14px 18px", marginBottom:12, border:`1px solid #FCD97A` }}>
                  <div style={{ fontSize:12, color:C.fixed, fontWeight:700, marginBottom:10 }}>📌 고정항목 합산</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                      {stats.fixedInc>0 && <span style={{ fontSize:13, color:C.income }}>고정수입 +{fmt(stats.fixedInc)}원</span>}
                      {stats.fixedExp>0 && <span style={{ fontSize:13, color:C.expense }}>고정지출 -{fmt(stats.fixedExp)}원</span>}
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:10, color:C.sub, marginBottom:2 }}>월 순고정</div>
                      <div style={{ fontSize:19, fontWeight:700, color:(stats.fixedInc-stats.fixedExp)>=0?C.income:C.expense }}>
                        {(stats.fixedInc-stats.fixedExp)>=0?"+":"-"}{fmt(Math.abs(stats.fixedInc-stats.fixedExp))}원
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {catStats.length>0 ? (
                <div style={{ background:C.card, borderRadius:16, padding:"16px", border:`1px solid ${C.border}`, boxShadow:"0 1px 6px #00000008" }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>카테고리별</div>
                  {catStats.map(([cat,{type,total}])=>{
                    const max = Math.max(...catStats.map(([,{total:t}])=>t));
                    return (
                      <div key={cat} style={{ marginBottom:13 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                          <span style={{ fontSize:13 }}>{CAT_ICONS[cat]||"💳"} {cat}</span>
                          <span style={{ fontSize:13, fontWeight:700, color:type==="income"?C.income:C.expense }}>
                            {type==="income"?"+":"-"}{fmt(total)}원
                          </span>
                        </div>
                        <div style={{ background:C.border, borderRadius:4, height:5 }}>
                          <div style={{ height:"100%", borderRadius:4, width:`${(total/max)*100}%`, background:type==="income"?C.income:C.expense, transition:"width .5s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <Empty text="이번 달 내역이 없어요" emoji="📊" />}
            </div>
          )}

          {tab==="daily" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
                <MiniCard label="수입" value={stats.income}  color={C.income}  bg={C.incomeL}  sign="+" />
                <MiniCard label="지출" value={stats.expense} color={C.expense} bg={C.expenseL} sign="-" />
                <MiniCard label="잔액" value={Math.abs(stats.balance)} color={stats.balance>=0?C.blue:C.expense} bg={stats.balance>=0?C.blueL:C.expenseL} sign={stats.balance>=0?"+":"-"} />
              </div>

              {byDay.length===0 && <Empty text="이번 달 내역이 없어요" emoji="📭" />}
              {byDay.map(([date, items])=>{
                const dayIncome  = items.filter(t=>t.type==="income" ).reduce((a,t)=>a+Number(t.amount),0);
                const dayExpense = items.filter(t=>t.type==="expense").reduce((a,t)=>a+Number(t.amount),0);
                const d   = parseDate(date);
                const dow = d.getDay();
                return (
                  <div key={date} style={{ marginBottom:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6, paddingLeft:2 }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>
                        {date.slice(5).replace("-","/")}
                        <span style={{ fontSize:12, marginLeft:5, fontWeight:600, color:dow===0?C.expense:dow===6?C.blue:C.sub }}>{DAYS[dow]}</span>
                      </div>
                      <div style={{ fontSize:12, color:C.sub, display:"flex", gap:8 }}>
                        {dayIncome>0  && <span style={{color:C.income}}>+{fmt(dayIncome)}</span>}
                        {dayExpense>0 && <span style={{color:C.expense}}>-{fmt(dayExpense)}</span>}
                      </div>
                    </div>
                    <div style={{ background:C.card, borderRadius:14, overflow:"hidden", border:`1px solid ${C.border}`, boxShadow:"0 1px 4px #00000006" }}>
                      {items.map((t,i)=>(
                        <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderTop:i>0?`1px solid ${C.border}`:"none" }}>
                          <div style={{ width:36, height:36, borderRadius:10, background:t.type==="income"?C.incomeL:C.expenseL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                            {CAT_ICONS[t.category]||"💳"}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600 }}>{t.category}</div>
                            {t.memo && <div style={{ fontSize:11, color:C.sub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.memo}</div>}
                          </div>
                          <div style={{ fontSize:14, fontWeight:700, color:t.type==="income"?C.income:C.expense, whiteSpace:"nowrap" }}>
                            {t.type==="income"?"+":"-"}{fmt(t.amount)}원
                          </div>
                          <div style={{ display:"flex", gap:2 }}>
                            <IBtn onClick={()=>openEdit(t)} e="✏️" />
                            <IBtn onClick={()=>handleDeleteTx(t.id)} e="🗑️" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab==="fixed" && (
            <div>
              {fixedItems.length>0 && (
                <div style={{ background:C.card, borderRadius:16, padding:"16px 18px", marginBottom:14, border:`1px solid ${C.border}`, boxShadow:"0 1px 4px #00000006" }}>
                  <div style={{ fontSize:12, color:C.sub, fontWeight:600, marginBottom:10 }}>월 고정 합산</div>
                  <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
                    {stats.fixedInc>0 && (
                      <div>
                        <div style={{ fontSize:11, color:C.income, fontWeight:600, marginBottom:2 }}>고정수입</div>
                        <div style={{ fontSize:18, fontWeight:700, color:C.income }}>+{fmt(stats.fixedInc)}원</div>
                      </div>
                    )}
                    {stats.fixedExp>0 && (
                      <div>
                        <div style={{ fontSize:11, color:C.expense, fontWeight:600, marginBottom:2 }}>고정지출</div>
                        <div style={{ fontSize:18, fontWeight:700, color:C.expense }}>-{fmt(stats.fixedExp)}원</div>
                      </div>
                    )}
                    <div style={{ marginLeft:"auto" }}>
                      <div style={{ fontSize:11, color:C.sub, marginBottom:2 }}>순고정</div>
                      <div style={{ fontSize:18, fontWeight:700, color:(stats.fixedInc-stats.fixedExp)>=0?C.income:C.expense }}>
                        {(stats.fixedInc-stats.fixedExp)>=0?"+":"-"}{fmt(Math.abs(stats.fixedInc-stats.fixedExp))}원
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ fontSize:14, fontWeight:700 }}>항목 목록</span>
                <button onClick={()=>{ setEditFixed(null); setFixedForm({name:"",amount:"",type:"expense"}); setShowFixedForm(true); }}
                  style={{ background:C.accent, border:"none", borderRadius:10, padding:"7px 14px", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  + 추가
                </button>
              </div>

              {fixedItems.length===0 && <Empty text="고정 항목이 없어요" emoji="📌" />}
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {fixedItems.map(f=>(
                  <div key={f.id} style={{ background:C.card, borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, border:`1px solid ${C.border}`, boxShadow:"0 1px 3px #00000005" }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:f.type==="income"?C.incomeL:C.expenseL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                      {f.type==="income"?"💵":"💸"}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
                      <div style={{ fontSize:11, color:C.sub }}>{f.type==="income"?"고정수입":"고정지출"}</div>
                    </div>
                    <div style={{ fontSize:15, fontWeight:700, color:f.type==="income"?C.income:C.expense, whiteSpace:"nowrap" }}>
                      {f.type==="income"?"+":"-"}{fmt(f.amount)}원
                    </div>
                    <div style={{ display:"flex", gap:2 }}>
                      <IBtn onClick={()=>{ setEditFixed(f); setFixedForm({name:f.name,amount:String(f.amount),type:f.type}); setShowFixedForm(true); }} e="✏️" />
                      <IBtn onClick={()=>handleDeleteFixed(f.id)} e="🗑️" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {(tab==="monthly"||tab==="daily") && !loading && (
        <button
          onClick={()=>{ setEditItem(null); setForm({date:todayStr(),type:"expense",category:"식비",amount:"",memo:""}); setShowForm(true); }}
          style={{ position:"fixed", bottom:24, right:"max(calc(50% - 220px), 20px)", width:54, height:54, borderRadius:"50%", border:"none", cursor:"pointer", background:C.accent, color:"#fff", fontSize:28, fontWeight:700, boxShadow:`0 4px 18px ${C.accent}55`, zIndex:40, display:"flex", alignItems:"center", justifyContent:"center" }}
        >+</button>
      )}

      {showMonthPick && (
        <Modal title="날짜 선택" onClose={()=>setShowMonthPick(false)}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <button onClick={()=>setYear(y=>y-1)} style={yrNav}>‹</button>
            <span style={{ fontSize:17, fontWeight:700 }}>{year}년</span>
            <button onClick={()=>setYear(y=>y+1)} style={yrNav}>›</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:16 }}>
            {MONTHS.map((m,i)=>{
              const isCur = i===today.getMonth()&&year===today.getFullYear();
              const isSel = i===month;
              return (
                <button key={i} onClick={()=>{ setMonth(i); setShowMonthPick(false); }} style={{
                  padding:"11px 0", borderRadius:10, border:"1px solid", cursor:"pointer", fontFamily:"inherit",
                  fontSize:14, fontWeight:600, transition:"all .15s",
                  background:  isSel ? C.accent : C.bg,
                  color:       isSel ? "#fff"   : isCur ? C.accent : C.text,
                  borderColor: isSel ? C.accent : isCur ? C.accent : C.border,
                  fontStyle:   isCur&&!isSel ? "italic" : "normal",
                }}>{m}</button>
              );
            })}
          </div>
          <button onClick={()=>{ goToday(); setShowMonthPick(false); }}
            style={{ width:"100%", background:C.accentL, border:`1px solid ${C.accent}`, borderRadius:10, padding:"11px 0", color:C.accent, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            오늘로 이동
          </button>
        </Modal>
      )}

      {showForm && (
        <Modal title={editItem?"내역 수정":"내역 추가"} onClose={()=>{ setShowForm(false); setEditItem(null); }}>
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            {["expense","income"].map(t=>(
              <button key={t} onClick={()=>handleTypeChange(t)} style={{
                flex:1, padding:"10px 0", borderRadius:10, border:"1px solid", cursor:"pointer",
                fontFamily:"inherit", fontSize:14, fontWeight:700, transition:"all .2s",
                background:  form.type===t ? (t==="income"?C.incomeL :C.expenseL) : C.bg,
                color:       form.type===t ? (t==="income"?C.income  :C.expense ) : C.sub,
                borderColor: form.type===t ? (t==="income"?C.income  :C.expense ) : C.border,
              }}>{t==="income"?"💚 수입":"❤️ 지출"}</button>
            ))}
          </div>
          <Lbl>날짜</Lbl>
          <Inp type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
          <Lbl>카테고리</Lbl>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
            {CATEGORIES[form.type].map(c=>(
              <button key={c} onClick={()=>setForm(f=>({...f,category:c}))} style={{
                padding:"6px 12px", borderRadius:20, border:"1px solid", cursor:"pointer",
                fontFamily:"inherit", fontSize:12, fontWeight:600, transition:"all .15s",
                background:  form.category===c ? C.accent : C.bg,
                color:       form.category===c ? "#fff"   : C.sub,
                borderColor: form.category===c ? C.accent : C.border,
              }}>{CAT_ICONS[c]} {c}</button>
            ))}
          </div>
          <Lbl>금액 (원)</Lbl>
          <Inp type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0" inputMode="numeric" />
          <Lbl>메모 (선택)</Lbl>
          <Inp type="text" value={form.memo} onChange={e=>setForm(f=>({...f,memo:e.target.value}))} placeholder="간단한 메모..." />
          <SBtn onClick={handleSaveTx}>{editItem?"수정하기":"저장하기"}</SBtn>
        </Modal>
      )}

      {showFixedForm && (
        <Modal title={editFixed?"고정 항목 수정":"고정 항목 추가"} onClose={()=>{ setShowFixedForm(false); setEditFixed(null); }}>
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            {["expense","income"].map(t=>(
              <button key={t} onClick={()=>setFixedForm(f=>({...f,type:t}))} style={{
                flex:1, padding:"10px 0", borderRadius:10, border:"1px solid", cursor:"pointer",
                fontFamily:"inherit", fontSize:14, fontWeight:700, transition:"all .2s",
                background:  fixedForm.type===t ? (t==="income"?C.incomeL :C.expenseL) : C.bg,
                color:       fixedForm.type===t ? (t==="income"?C.income  :C.expense ) : C.sub,
                borderColor: fixedForm.type===t ? (t==="income"?C.income  :C.expense ) : C.border,
              }}>{t==="income"?"💚 고정수입":"❤️ 고정지출"}</button>
            ))}
          </div>
          <Lbl>항목명</Lbl>
          <Inp type="text" value={fixedForm.name} onChange={e=>setFixedForm(f=>({...f,name:e.target.value}))} placeholder="월세, 넷플릭스, 월급 등" />
          <Lbl>금액 (원)</Lbl>
          <Inp type="number" value={fixedForm.amount} onChange={e=>setFixedForm(f=>({...f,amount:e.target.value}))} placeholder="0" inputMode="numeric" />
          <SBtn onClick={handleSaveFixed}>{editFixed?"수정하기":"저장하기"}</SBtn>
        </Modal>
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:92, left:"50%", transform:"translateX(-50%)", background:toast.ok?"#18191B":"#E84040", color:"#fff", padding:"10px 22px", borderRadius:100, fontWeight:600, fontSize:14, zIndex:100, whiteSpace:"nowrap", boxShadow:"0 4px 14px #00000020" }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:${C.bg}; }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        @keyframes slideUp { from { transform:translateY(40px); opacity:0; } to { transform:translateY(0); opacity:1; } }
      `}</style>
    </div>
  );
}

function MiniCard({ label, value, color, bg, sign }) {
  return (
    <div style={{ background:bg, borderRadius:12, padding:"10px 12px", minWidth:0 }}>
      <div style={{ fontSize:10, color, fontWeight:700, marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:800, color, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{sign}{fmt(value)}</div>
    </div>
  );
}
function Empty({ text, emoji }) {
  return (
    <div style={{ textAlign:"center", color:C.sub, marginTop:60, fontSize:15 }}>
      <div style={{ fontSize:36, marginBottom:10 }}>{emoji}</div>{text}
    </div>
  );
}
function IBtn({ onClick, e }) {
  return <button onClick={onClick} style={{ background:"none", border:"none", cursor:"pointer", fontSize:15, padding:"4px", opacity:.55, lineHeight:1 }}>{e}</button>;
}
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ position:"absolute", inset:0, background:"#00000035" }} onClick={onClose} />
      <div style={{ position:"relative", zIndex:1, background:"#fff", borderRadius:"22px 22px 0 0", padding:"22px 18px 38px", width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto", animation:"slideUp .26s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <span style={{ fontSize:17, fontWeight:700 }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.sub, lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Lbl({ children }) {
  return <div style={{ fontSize:11, fontWeight:700, color:C.sub, marginBottom:6, letterSpacing:".4px", textTransform:"uppercase" }}>{children}</div>;
}
function Inp(props) {
  return <input {...props} style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", color:C.text, fontSize:15, fontFamily:"'Noto Sans KR',sans-serif", marginBottom:14, outline:"none" }} />;
}
function SBtn({ onClick, children }) {
  return <button onClick={onClick} style={{ width:"100%", background:C.accent, border:"none", borderRadius:12, padding:"14px 0", color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer", fontFamily:"'Noto Sans KR',sans-serif", marginTop:4 }}>{children}</button>;
}

const navBtn = { background:C.bg, border:`1px solid ${C.border}`, color:C.text, width:36, height:36, borderRadius:10, fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit" };
const yrNav  = { background:C.bg, border:`1px solid ${C.border}`, color:C.text, width:36, height:36, borderRadius:8, fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit" };
