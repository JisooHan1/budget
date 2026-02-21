import { useState, useEffect, useMemo } from "react";
import { auth, db, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  writeBatch,
} from "firebase/firestore";

// ── 유틸 ──────────────────────────────────────────────────────
const parseDate = (dateStr) => new Date(dateStr + "T00:00:00");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmt = (n) => new Intl.NumberFormat("ko-KR").format(Math.abs(Math.round(n)));

const MONTHS = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const CATEGORIES = {
  income: ["급여", "부수입", "용돈", "투자수익", "기타수입"],
  expense: ["식비", "교통", "주거", "의료", "쇼핑", "문화", "통신", "교육", "보험", "기타지출"],
};
const CAT_ICONS = {
  급여: "💰",
  부수입: "🤑",
  용돈: "🎁",
  투자수익: "📈",
  기타수입: "💵",
  식비: "🍱",
  교통: "🚌",
  주거: "🏠",
  의료: "🏥",
  쇼핑: "🛍️",
  문화: "🎬",
  통신: "📱",
  교육: "📚",
  보험: "🛡️",
  기타지출: "💸",
};

const C = {
  // Toss/Obsidian-ish: clean, airy, high contrast
  bg: "#F7F8FA",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  sub: "#6B7280",
  income: "#10B981",
  incomeL: "#E9FBF5",
  expense: "#EF4444",
  expenseL: "#FEECEC",
  blue: "#3B82F6",
  blueL: "#EFF6FF",
  accent: "#1D4ED8",
  accentL: "#EEF2FF",
  fixed: "#F59E0B",
  fixedL: "#FFFBEB",
  shadow: "0 8px 24px #0000000A",
};


// 결제 정보 프리셋
const PAY_INSTRUMENTS = ["신용카드", "체크카드", "현금", "계좌이체", "기타"];
const PAY_METHODS = [
  "카드",
  "카카오페이",
  "네이버페이",
  "삼성페이",
  "애플페이",
  "애플 구독",
  "구글 구독",
  "자동이체",
  "기타",
];

const monthKeyOf = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();


// monthKey(YYYY-MM) 비교용 유틸
const prevMonthKeyFrom = (y, m) => {
  let py = y, pm = m - 1;
  if (pm < 0) { pm = 11; py -= 1; }
  return monthKeyOf(py, pm);
};
const isMonthKeyLE = (a, b) => (a || "0000-01") <= (b || "9999-12");
const isFixedActiveFor = (fixed, key) => {
  const from = fixed.effectiveFrom || "0000-01";
  const to = fixed.effectiveTo || null;
  return isMonthKeyLE(from, key) && (to === null || isMonthKeyLE(key, to));
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
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📒</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: "-0.5px" }}>
            내 가계부
          </div>
          <div style={{ fontSize: 14, color: C.sub, marginTop: 4 }}>어디서든 기록하고 확인하세요</div>
        </div>

        <div
          style={{
            background: C.card,
            borderRadius: 20,
            padding: "32px 24px",
            border: `1px solid ${C.border}`,
            boxShadow: "0 2px 16px #00000010",
          }}
        >
          {error && (
            <div
              style={{
                background: C.expenseL,
                border: `1px solid #FBBFBF`,
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                color: C.expense,
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: "100%",
              background: "#fff",
              border: "1px solid #dadce0",
              borderRadius: 12,
              padding: "14px 0",
              color: C.text,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              transition: "all .2s",
              opacity: loading ? 0.6 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.335z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              />
            </svg>
            {loading ? "로그인 중…" : "Google 계정으로 로그인"}
          </button>

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: C.sub }}>
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

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
          fontSize: 16,
          color: C.sub,
        }}
      >
        불러오는 중…
      </div>
    );

  if (!user) return <LoginScreen />;
  return <BudgetApp user={user} />;
}

// ── 가계부 본체 ───────────────────────────────────────────────
function BudgetApp({ user }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // ✅ 탭: monthly / compare / daily / fixed
  const [tab, setTab] = useState("monthly");

  const [transactions, setTransactions] = useState([]);
  const [fixedItems, setFixedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showFixedForm, setShowFixedForm] = useState(false);
  const [editFixed, setEditFixed] = useState(null);
  const [showMonthPick, setShowMonthPick] = useState(false);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({
    date: todayStr(),
    type: "expense",
    category: "식비",
    name: "",
    amount: "",
    memo: "",
    payInstrument: "신용카드",
    payMethod: "카드",
  });
  const [fixedForm, setFixedForm] = useState({ group: "기본", name: "", amount: "", type: "expense", memo: "", payInstrument: "", payMethod: "" });

  // 일별 탭 뷰(리스트/달력)
  const [dailyView, setDailyView] = useState("list");
  const [selectedDate, setSelectedDate] = useState(null);
  const [manageMonthKey, setManageMonthKey] = useState(monthKeyOf(new Date().getFullYear(), new Date().getMonth()));
  const [expandedFixedGroups, setExpandedFixedGroups] = useState({});

  // ── 데이터 로드 ──────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const txQuery = query(
        collection(db, "transactions"),
        where("uid", "==", user.uid),
        orderBy("date", "desc")
      );
      const fxQuery = query(collection(db, "fixed_items"), where("uid", "==", user.uid));

      const [txSnap, fxSnap] = await Promise.all([getDocs(txQuery), getDocs(fxQuery)]);

      setTransactions(txSnap.docs.map((d) => {
        const v = d.data();
        return { id: d.id, ...v, name: v?.name || "" };
      }));
      setFixedItems(fxSnap.docs.map((d) => {
        const v = d.data();
        return { id: d.id, ...v, group: (v?.group || "기본") };
      }));
    } catch (e) {
      console.error(e);
      showToast("데이터를 불러오지 못했어요", false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2000);
  };

  const goPrev = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else setMonth((m) => m + 1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  // ── 데이터 관리: 거래 초기화 + 고정항목 과거 적용 초기화 ───────────────
  // ⚠️ 인덱스(복합 인덱스) 문제로 초기화 쿼리는 uid만으로 가져온 뒤,
  //     클라이언트에서 날짜 필터링해서 삭제해요.
  const resetTransactionsByMonthKey = async (mk) => {
    try {
      const [yStr, mStr] = (mk || "").split("-");
      const y = Number(yStr);
      const m = Number(mStr) - 1;
      if (!yStr || !mStr || Number.isNaN(y) || Number.isNaN(m)) {
        showToast("월 형식이 올바르지 않아요", false);
        return;
      }
      const start = `${yStr}-${mStr}-01`;
      const end = `${yStr}-${mStr}-${String(daysInMonth(y, m)).padStart(2, "0")}`;

      const ok = window.confirm(`${yStr}년 ${Number(mStr)}월의 거래 내역을 전부 초기화할까요?\n(되돌릴 수 없어요)`);
      if (!ok) return;

      const baseQ = query(collection(db, "transactions"), where("uid", "==", user.uid));
      const snap = await getDocs(baseQ);

      const targets = snap.docs.filter((d) => {
        const v = d.data();
        const dt = v.date || "";
        return dt >= start && dt <= end;
      });

      if (targets.length === 0) {
        showToast("초기화할 거래가 없어요");
        return;
      }

      for (let i = 0; i < targets.length; i += 450) {
        const batch = writeBatch(db);
        targets.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      setTransactions((prev) => prev.filter((t) => t.uid !== user.uid || (t.date || "") < start || (t.date || "") > end));
      showToast("해당 월의 거래를 초기화했어요 ✓");
    } catch (e) {
      console.error(e);
      showToast(`초기화에 실패했어요: ${e?.message || ""}`, false);
    }
  };


const resetAllTransactions = async () => {
  try {
    const ok = window.confirm("전체 거래(모든 달)를 삭제할까요?\n(되돌릴 수 없어요)");
    if (!ok) return;

    const baseQ = query(collection(db, "transactions"), where("uid", "==", user.uid));
    const snap = await getDocs(baseQ);

    if (snap.empty) {
      showToast("삭제할 거래가 없어요");
      return;
    }

    const docs = snap.docs;

    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    setTransactions((prev) => prev.filter((x) => x.uid !== user.uid));
    showToast("전체 거래를 초기화했어요 ✓");
  } catch (e) {
    console.error(e);
    showToast(`초기화에 실패했어요: ${e?.message || ""}`, false);
  }
};


  const resetFixedHistoryFromMonth = async (mk) => {
    try {
      const [yStr, mStr] = (mk || "").split("-");
      if (!yStr || !mStr) {
        showToast("월 형식이 올바르지 않아요", false);
        return;
      }

      const ok = window.confirm(
        `고정항목이 과거 전체에 적용되는 것을 끊고,\n${yStr}년 ${Number(mStr)}월부터만 적용되게 초기화할까요?\n\n- 종료된(과거) 고정항목 기록은 삭제\n- 현재 고정항목은 선택 월부터 적용\n\n(되돌릴 수 없어요)`
      );
      if (!ok) return;

      const qf = query(collection(db, "fixed_items"), where("uid", "==", user.uid));
      const snap = await getDocs(qf);
      if (snap.empty) {
        showToast("초기화할 고정항목이 없어요");
        return;
      }

      const docs = snap.docs;

      // 1) 종료된 히스토리 삭제 (effectiveTo가 null이 아닌 것)
      const toDelete = docs.filter((d) => d.data()?.effectiveTo != null);
      for (let i = 0; i < toDelete.length; i += 450) {
        const batch = writeBatch(db);
        toDelete.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // 2) 활성/레거시 항목은 선택 월부터 적용되도록 effectiveFrom 통일
      const toUpdate = docs.filter((d) => d.data()?.effectiveTo == null);
      for (let i = 0; i < toUpdate.length; i += 450) {
        const batch = writeBatch(db);
        toUpdate.slice(i, i + 450).forEach((d) => batch.update(d.ref, { effectiveFrom: mk, effectiveTo: null }));
        await batch.commit();
      }

      // 로컬 상태도 동기화
      setFixedItems((prev) => prev.filter((f) => f.effectiveTo == null).map((f) => ({ ...f, effectiveFrom: mk, effectiveTo: null })));

      showToast("고정항목 과거 적용을 초기화했어요 ✓");
    } catch (e) {
      console.error(e);
      showToast(`고정항목 초기화에 실패했어요: ${e?.message || ""}`, false);
    }
  };


  const monthKey = monthKeyOf(year, month);
  const monthTx = useMemo(
    () => transactions.filter((t) => (t.date || "").startsWith(monthKey)),
    [transactions, monthKey]
  );

  const activeFixedItems = useMemo(() => fixedItems.filter((f) => isFixedActiveFor(f, monthKey)), [fixedItems, monthKey]);

  const groupedFixed = useMemo(() => {
    const map = {};
    activeFixedItems.forEach((f) => {
      const g = (f.group || "기본").trim() || "기본";
      if (!map[g]) map[g] = [];
      map[g].push({ ...f, group: g });
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, items]) => ({
        group,
        items: items.sort((a, b) => (b.type === "income" ? 1 : 0) - (a.type === "income" ? 1 : 0) || b.amount - a.amount),
        income: items.filter((x) => x.type === "income").reduce((s, x) => s + Number(x.amount), 0),
        expense: items.filter((x) => x.type === "expense").reduce((s, x) => s + Number(x.amount), 0),
      }));
  }, [activeFixedItems]);

  useEffect(() => {
    setExpandedFixedGroups((prev) => {
      const next = { ...prev };
      groupedFixed.forEach(({ group }) => {
        if (next[group] === undefined) next[group] = true; // 신규 폴더는 기본 펼침
      });
      // 폴더가 삭제되면 상태 정리
      Object.keys(next).forEach((k) => {
        if (!groupedFixed.find((g) => g.group === k)) delete next[k];
      });
      return next;
    });
  }, [groupedFixed]);

  const stats = useMemo(() => {
    const txIncome = monthTx.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
    const txExpense = monthTx.filter((t) => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
    const fixedExp = activeFixedItems.filter((f) => f.type === "expense").reduce((a, f) => a + Number(f.amount), 0);
    const fixedInc = activeFixedItems.filter((f) => f.type === "income").reduce((a, f) => a + Number(f.amount), 0);
    // ✅ 고정항목을 월 합계에 반영
    const income = txIncome + fixedInc;
    const expense = txExpense + fixedExp;
    return { income, expense, fixedExp, fixedInc, balance: income - expense, txIncome, txExpense };
  }, [monthTx, activeFixedItems]);

  const byDay = useMemo(() => {
    const map = {};
    monthTx.forEach((t) => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [monthTx]);

  // ✅ 달력 비교용(이번달/지난달) 일별 합계 (거래내역 기준; 고정항목은 별도 합산)
  const dailyTotals = useMemo(() => {
    const map = {};
    monthTx.forEach((t) => {
      if (!map[t.date]) map[t.date] = { income: 0, expense: 0, net: 0 };
      if (t.type === "income") map[t.date].income += Number(t.amount);
      else map[t.date].expense += Number(t.amount);
    });
    Object.keys(map).forEach((k) => (map[k].net = map[k].income - map[k].expense));
    return map;
  }, [monthTx]);

  const prevMonthInfo = useMemo(() => {
    let py = year,
      pm = month - 1;
    if (pm < 0) {
      pm = 11;
      py -= 1;
    }
    return { py, pm, key: monthKeyOf(py, pm) };
  }, [year, month]);

  const prevDailyTotals = useMemo(() => {
    const tx = transactions.filter((t) => (t.date || "").startsWith(prevMonthInfo.key));
    const map = {};
    tx.forEach((t) => {
      if (!map[t.date]) map[t.date] = { income: 0, expense: 0, net: 0 };
      if (t.type === "income") map[t.date].income += Number(t.amount);
      else map[t.date].expense += Number(t.amount);
    });
    Object.keys(map).forEach((k) => (map[k].net = map[k].income - map[k].expense));
    return map;
  }, [transactions, prevMonthInfo.key]);

  const catStats = useMemo(() => {
    const map = {};
    monthTx.forEach((t) => {
      if (!map[t.category]) map[t.category] = { type: t.type, total: 0 };
      map[t.category].total += Number(t.amount);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [monthTx]);

  // ✅ 월별 비교 데이터 (최근 6개월)
  const monthCompare = useMemo(() => {
    const N = 6;
    const getKey = (y, m) => monthKeyOf(y, m);

    const months = [];
    let y = year,
      m = month;
    for (let i = 0; i < N; i++) {
      months.push({ y, m, key: getKey(y, m) });
      m -= 1;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
    }

    const fixedSumForMonth = (key, type) => fixedItems.filter((f) => f.type === type && isFixedActiveFor(f, key)).reduce((a, f) => a + Number(f.amount), 0);

    return months.map(({ y, m, key }) => {
      const tx = transactions.filter((t) => (t.date || "").startsWith(key));
      const txIncome = tx.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
      const txExpense = tx.filter((t) => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);      const fixedExp = fixedSumForMonth(key, "expense");
      const fixedInc = fixedSumForMonth(key, "income");
      const income = txIncome + fixedInc;
      const expense = txExpense + fixedExp;
      return {
        y,
        m,
        key,
        label: `${y}년 ${MONTHS[m]}`,
        income,
        expense,
        net: income - expense,
      };
    });
  }, [transactions, fixedItems, year, month]);

  // ── 거래 저장/삭제 ───────────────────────────────────────────
  const handleSaveTx = async () => {
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) {
      showToast("금액을 올바르게 입력해주세요", false);
      return;
    }
    try {
      const payload = {
        uid: user.uid,
        date: form.date,
        type: form.type,
        category: form.category,
        name: (form.name || "").trim(),
        amount: Number(form.amount),
        memo: form.memo || "",
        payInstrument: form.payInstrument || "",
        payMethod: form.payMethod || "",
      };
      if (editItem) {
        await updateDoc(doc(db, "transactions", editItem.id), payload);
      } else {
        await addDoc(collection(db, "transactions"), payload);
      }
      await loadData();
      setShowForm(false);
      setEditItem(null);
      setForm({
              date: todayStr(),
              type: "expense",
              category: "식비",
              name: "",
              amount: "",
        memo: "",
        payInstrument: "신용카드",
        payMethod: "카드",
      });
      showToast(editItem ? "수정했어요 ✓" : "저장했어요 ✓");
    } catch (e) {
      console.error(e);
      showToast("저장에 실패했어요", false);
    }
  };

  const handleDeleteTx = async (id) => {
    const ok = window.confirm("이 내역을 삭제할까요?\n(되돌릴 수 없어요)");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "transactions", id));
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      showToast("삭제했어요");
    } catch (e) {
      console.error(e);
      showToast("삭제에 실패했어요", false);
    }
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      date: item.date,
      type: item.type,
      category: item.category,
      name: item.name || "",
      amount: String(item.amount),
      memo: item.memo || "",
      payInstrument: item.payInstrument || "신용카드",
      payMethod: item.payMethod || "카드",
    });
    setShowForm(true);
  };

  // ── 고정항목 저장/삭제 ───────────────────────────────────────
  const handleSaveFixed = async () => {
    if (!fixedForm.name.trim() || !fixedForm.amount || isNaN(fixedForm.amount) || Number(fixedForm.amount) <= 0) {
      showToast("항목명과 금액을 입력해주세요", false);
      return;
    }

    // ✅ 고정항목은 '현재 선택된 월'부터 적용되도록 버전관리 (과거 월 자동 변경 방지)
    const effectiveFrom = monthKey; // YYYY-MM
    const effectiveToForOld = prevMonthKeyFrom(year, month);

    try {
      const payloadBase = {
        uid: user.uid,
        group: (fixedForm.group || "기본").trim() || "기본",
        name: fixedForm.name.trim(),
        amount: Number(fixedForm.amount),
        type: fixedForm.type,
        memo: fixedForm.memo || "",
        payInstrument: fixedForm.payInstrument || "",
        payMethod: fixedForm.payMethod || "",
      };

      if (editFixed) {
        const oldFrom = editFixed.effectiveFrom || "0000-01";

        // 같은 적용월(effectiveFrom) 안에서 수정하는 건 과거에 영향 없음 → update
        if (oldFrom === effectiveFrom) {
          await updateDoc(doc(db, "fixed_items", editFixed.id), {
            ...payloadBase,
            effectiveFrom: oldFrom,
            effectiveTo: editFixed.effectiveTo ?? null,
          });
        } else {
          // 과거에 이미 적용된 항목이면: 기존 항목을 전월까지로 닫고, 새 버전을 추가
          await updateDoc(doc(db, "fixed_items", editFixed.id), {
            effectiveTo: effectiveToForOld,
          });
          await addDoc(collection(db, "fixed_items"), {
            ...payloadBase,
            effectiveFrom,
            effectiveTo: null,
          });
        }
      } else {
        await addDoc(collection(db, "fixed_items"), {
          ...payloadBase,
          effectiveFrom,
          effectiveTo: null,
        });
      }

      await loadData();
      setShowFixedForm(false);
      setEditFixed(null);
      setFixedForm({ group: "기본", name: "", amount: "", type: "expense", memo: "", payInstrument: "", payMethod: "" });
      showToast(editFixed ? "수정했어요 ✓" : "저장했어요 ✓");
    } catch (e) {
      console.error(e);
      showToast("저장에 실패했어요", false);
    }
  };

  // ✅ 삭제도 과거 반영을 막기 위해: 과거에 적용된 항목은 '전월까지'로 종료 처리
  const handleDeleteFixed = async (item) => {
    const ok = window.confirm("이 고정항목을 삭제(또는 과거 적용 종료)할까요?\n(되돌릴 수 없어요)");
    if (!ok) return;
    try {
      const effectiveFrom = item.effectiveFrom || "0000-01";
      if (effectiveFrom === monthKey) {
        await deleteDoc(doc(db, "fixed_items", item.id));
        setFixedItems((prev) => prev.filter((f) => f.id !== item.id));
      } else {
        await updateDoc(doc(db, "fixed_items", item.id), { effectiveTo: prevMonthKeyFrom(year, month) });
        setFixedItems((prev) => prev.map((f) => (f.id === item.id ? { ...f, effectiveTo: prevMonthKeyFrom(year, month) } : f)));
      }
      showToast("삭제했어요");
    } catch (e) {
      console.error(e);
      showToast("삭제에 실패했어요", false);
    }
  };

  const handleTypeChange = (type) => setForm((f) => ({ ...f, type, category: CATEGORIES[type][0] }));
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  // ✅ 로그아웃 전에 확인창
  const handleLogout = async () => {
    const ok = window.confirm("로그아웃할까요?");
    if (!ok) return;
    await signOut(auth);
  };

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
        color: C.text,
        maxWidth: 480,
        margin: "0 auto",
        paddingBottom: 90,
      }}
    >
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={goPrev} aria-label="이전 달" style={navBtn}>
              ‹
            </button>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <button
                onClick={() => setShowMonthPick(true)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  borderRadius: 10,
                }}
              >
                <span style={{ fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.4px" }}>
                  {year}년 {MONTHS[month]}
                </span>
                <span style={{ fontSize: 12, color: C.sub }}>▾</span>
              </button>

              {!isCurrentMonth && (
                <button
                  onClick={goToday}
                  style={{
                    background: C.accentL,
                    border: `1px solid ${C.border}`,
                    borderRadius: 999,
                    padding: "2px 10px",
                    fontSize: 11,
                    color: C.accent,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 700,
                  }}
                >
                  오늘로
                </button>
              )}
            </div>

            <button onClick={goNext} aria-label="다음 달" style={navBtn}>
              ›
            </button>
          </div>

          <button
            onClick={handleLogout}
            title="로그아웃"
            style={{
              background: "#fff",
              border: `1px solid ${C.border}`,
              color: C.text,
              height: 36,
              borderRadius: 12,
              padding: "0 12px",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 1px 8px #00000008",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>🏠</span>
            <span style={{ color: C.sub, fontWeight: 800 }}>로그아웃</span>
          </button>
</div>

        <div style={{ display: "flex" }}>
          {[
            ["monthly", "월별요약"],
            ["compare", "월별비교"],
            ["daily", "일별내역"],
            ["fixed", "고정항목"],
            ["manage", "관리"],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                flex: 1,
                padding: "10px 4px",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                background: "none",
                transition: "all .15s",
                color: tab === k ? C.accent : C.sub,
                borderBottom: tab === k ? `2px solid ${C.accent}` : `2px solid transparent`,
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: "center", paddingTop: 80, color: C.sub }}>불러오는 중…</div>
      ) : (
        <main style={{ padding: "16px" }}>
          {tab === "monthly" && (
            <div>
              <div style={{ background: C.card, borderRadius: 18, padding: "22px 20px", marginBottom: 12, border: `1px solid ${C.border}`, boxShadow: "0 1px 6px #00000008" }}>
                {/* ✅ '잔액' -> '순저축/순지출' */}
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 6, fontWeight: 600 }}>
                  {year}년 {MONTHS[month]} {stats.balance >= 0 ? "순저축" : "순지출"}
                </div>
                <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-1.5px", color: stats.balance >= 0 ? C.income : C.expense, marginBottom: 20 }}>
                  {stats.balance >= 0 ? "+" : "-"}
                  {fmt(Math.abs(stats.balance))}원
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: C.incomeL, borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: C.income, fontWeight: 700, marginBottom: 5 }}>▲ 수입</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: C.income }}>+{fmt(stats.income)}원</div>
                  </div>
                  <div style={{ background: C.expenseL, borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: C.expense, fontWeight: 700, marginBottom: 5 }}>▼ 지출</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: C.expense }}>-{fmt(stats.expense)}원</div>
                  </div>
                </div>
              </div>

              {activeFixedItems.length > 0 && (
                <div style={{ background: C.fixedL, borderRadius: 16, padding: "14px 18px", marginBottom: 12, border: `1px solid #FCD97A` }}>
                  <div style={{ fontSize: 12, color: C.fixed, fontWeight: 700, marginBottom: 10 }}>📌 고정항목 (월 합계에 포함)</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {stats.fixedInc > 0 && <span style={{ fontSize: 13, color: C.income }}>고정수입 +{fmt(stats.fixedInc)}원</span>}
                      {stats.fixedExp > 0 && <span style={{ fontSize: 13, color: C.expense }}>고정지출 -{fmt(stats.fixedExp)}원</span>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: C.sub, marginBottom: 2 }}>월 순고정</div>
                      <div style={{ fontSize: 19, fontWeight: 700, color: stats.fixedInc - stats.fixedExp >= 0 ? C.income : C.expense }}>
                        {stats.fixedInc - stats.fixedExp >= 0 ? "+" : "-"}
                        {fmt(Math.abs(stats.fixedInc - stats.fixedExp))}원
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {catStats.length > 0 ? (
                <div style={{ background: C.card, borderRadius: 16, padding: "16px", border: `1px solid ${C.border}`, boxShadow: "0 1px 6px #00000008" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>카테고리별</div>
                  {catStats.map(([cat, { type, total }]) => {
                    const max = Math.max(...catStats.map(([, { total: t }]) => t));
                    return (
                      <div key={cat} style={{ marginBottom: 13 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 13 }}>
                            {CAT_ICONS[cat] || "💳"} {cat}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: type === "income" ? C.income : C.expense }}>
                            {type === "income" ? "+" : "-"}
                            {fmt(total)}원
                          </span>
                        </div>
                        <div style={{ background: C.border, borderRadius: 4, height: 5 }}>
                          <div
                            style={{
                              height: "100%",
                              borderRadius: 4,
                              width: `${(total / max) * 100}%`,
                              background: type === "income" ? C.income : C.expense,
                              transition: "width .5s",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty text="이번 달 내역이 없어요" emoji="📊" />
              )}



            </div>
          )}

          {/* ✅ 월별 비교 탭 */}
          {tab === "compare" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>최근 6개월 비교</div>
                <div style={{ fontSize: 12, color: C.sub }}>수입 · 지출 · 순액</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {monthCompare.map((m) => (
                  <div
                    key={m.key}
                    style={{
                      background: C.card,
                      borderRadius: 16,
                      padding: "14px 16px",
                      border: `1px solid ${C.border}`,
                      boxShadow: "0 1px 4px #00000006",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: m.net >= 0 ? C.income : C.expense }}>
                        {m.net >= 0 ? "+" : "-"}
                        {fmt(Math.abs(m.net))}원
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: C.income }}>수입 +{fmt(m.income)}원</span>
                      <span style={{ color: C.expense }}>지출 -{fmt(m.expense)}원</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "daily" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                <MiniCard label="수입" value={stats.income} color={C.income} bg={C.incomeL} sign="+" />
                <MiniCard label="지출" value={stats.expense} color={C.expense} bg={C.expenseL} sign="-" />
                <MiniCard
                  label={stats.balance >= 0 ? "순저축" : "순지출"}
                  value={Math.abs(stats.balance)}
                  color={stats.balance >= 0 ? C.blue : C.expense}
                  bg={stats.balance >= 0 ? C.blueL : C.expenseL}
                  sign={stats.balance >= 0 ? "+" : "-"}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[
                  ["list", "리스트"],
                  ["calendar", "달력비교"],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => {
                      setDailyView(k);
                      if (k === "calendar") setSelectedDate((d) => d || todayStr());
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 12,
                      border: `1px solid ${dailyView === k ? C.accent : C.border}`,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: 800,
                      background: dailyView === k ? C.accentL : C.card,
                      color: dailyView === k ? C.accent : C.sub,
                      boxShadow: dailyView === k ? "0 1px 4px #00000006" : "none",
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {dailyView === "calendar" ? (
                <div>
                  <CalendarCompare
                    year={year}
                    month={month}
                    dailyTotals={dailyTotals}
                    prevDailyTotals={prevDailyTotals}
                    prevMonthInfo={prevMonthInfo}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />

                  {selectedDate && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{selectedDate.slice(5).replace("-", "/")} 내역</div>
                        <button
                          onClick={() => {
                            setEditItem(null);
                            setForm((f) => ({
                              ...f,
                              date: selectedDate,
                              type: "expense",
                              category: "식비",
                              name: "",
                              amount: "",
                              memo: "",
                              payInstrument: f.payInstrument || "신용카드",
                              payMethod: f.payMethod || "카드",
                            }));
                            setShowForm(true);
                          }}
                          style={{
                            background: C.accentL,
                            border: `1px solid ${C.accent}`,
                            color: C.accent,
                            borderRadius: 10,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          + 이 날 추가
                        </button>
                      </div>
                      <DayList date={selectedDate} items={monthTx.filter((t) => t.date === selectedDate)} openEdit={openEdit} onDelete={handleDeleteTx} />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {byDay.length === 0 && <Empty text="이번 달 내역이 없어요" emoji="📭" />}
                  {byDay.map(([date, items]) => (
                    <DaySection key={date} date={date} items={items} openEdit={openEdit} onDelete={handleDeleteTx} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "fixed" && (
            <div>
              {activeFixedItems.length > 0 && (
                <div style={{ background: C.card, borderRadius: 16, padding: "16px 18px", marginBottom: 14, border: `1px solid ${C.border}`, boxShadow: "0 1px 4px #00000006" }}>
                  <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 10 }}>월 고정 합산</div>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    {stats.fixedInc > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: C.income, fontWeight: 600, marginBottom: 2 }}>고정수입</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.income }}>+{fmt(stats.fixedInc)}원</div>
                      </div>
                    )}
                    {stats.fixedExp > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: C.expense, fontWeight: 600, marginBottom: 2 }}>고정지출</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.expense }}>-{fmt(stats.fixedExp)}원</div>
                      </div>
                    )}
                    <div style={{ marginLeft: "auto" }}>
                      <div style={{ fontSize: 11, color: C.sub, marginBottom: 2 }}>순고정</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: stats.fixedInc - stats.fixedExp >= 0 ? C.income : C.expense }}>
                        {stats.fixedInc - stats.fixedExp >= 0 ? "+" : "-"}
                        {fmt(Math.abs(stats.fixedInc - stats.fixedExp))}원
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>항목 목록</span>
                <button
                  onClick={() => {
                    setEditFixed(null);
                    setFixedForm({ group: "기본", name: "", amount: "", type: "expense", memo: "", payInstrument: "", payMethod: "" });
                    setShowFixedForm(true);
                  }}
                  style={{
                    background: C.accent,
                    border: "none",
                    borderRadius: 10,
                    padding: "7px 14px",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  + 추가
                </button>
              </div>

              {activeFixedItems.length === 0 && <Empty text="고정 항목이 없어요" emoji="📌" />}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {groupedFixed.map(({ group, items, income, expense }) => {
                  const open = expandedFixedGroups[group] !== false;
                  const net = income - expense;
                  return (
                    <div
                      key={group}
                      style={{
                        background: C.card,
                        borderRadius: 16,
                        border: `1px solid ${C.border}`,
                        boxShadow: "0 1px 3px #00000005",
                        overflow: "hidden",
                      }}
                    >
                      <button
                        onClick={() => setExpandedFixedGroups((p) => ({ ...p, [group]: !(p[group] !== false) }))}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "12px 14px",
                          background: "#fff",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ fontSize: 18, flexShrink: 0 }}>📁</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group}</div>
                          <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
                            {items.length}개 ·{" "}
                            <span style={{ color: C.income }}>+{fmt(income)}</span> ·{" "}
                            <span style={{ color: C.expense }}>-{fmt(expense)}</span> ·{" "}
                            <span style={{ color: net >= 0 ? C.blue : C.expense }}>{net >= 0 ? "+" : "-"}{fmt(Math.abs(net))}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 18, color: C.sub, flexShrink: 0 }}>{open ? "▾" : "▸"}</div>
                      </button>

                      {open && (
                        <div style={{ padding: "0 12px 12px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {items.map((f) => (
                              <div
                                key={f.id}
                                style={{
                                  background: C.bg,
                                  borderRadius: 14,
                                  padding: "12px 12px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  border: `1px solid ${C.border}`,
                                }}
                              >
                                <div
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 10,
                                    background: f.type === "income" ? C.incomeL : C.expenseL,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 20,
                                    flexShrink: 0,
                                  }}
                                >
                                  {f.type === "income" ? "💵" : "💸"}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                                  <div style={{ fontSize: 11, color: C.sub }}>
                                    {f.type === "income" ? "고정수입" : "고정지출"}
                                    {(f.payInstrument || f.payMethod || f.memo) && (
                                      <span style={{ marginLeft: 6 }}>
                                        • {[(f.payInstrument || "").trim(), (f.payMethod || "").trim()].filter(Boolean).join(" / ")}
                                        {f.memo ? ` • ${f.memo}` : ""}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: f.type === "income" ? C.income : C.expense, whiteSpace: "nowrap" }}>
                                  {f.type === "income" ? "+" : "-"}
                                  {fmt(f.amount)}원
                                </div>
                                <div style={{ display: "flex", gap: 2 }}>
                                  <IBtn
                                    onClick={() => {
                                      setEditFixed(f);
                                      setFixedForm({
                                        group: f.group || "기본",
                                        name: f.name,
                                        amount: String(f.amount),
                                        type: f.type,
                                        memo: f.memo || "",
                                        payInstrument: f.payInstrument || "",
                                        payMethod: f.payMethod || "",
                                      });
                                      setShowFixedForm(true);
                                    }}
                                    e="✏️"
                                  />
                                  <IBtn onClick={() => handleDeleteFixed(f)} e="🗑️" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

{/* ✅ 관리 탭 */}
{tab === "manage" && (
  <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.4px" }}>관리</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
          위험한 작업(삭제/초기화)은 되돌릴 수 없어요.
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.sub }}>기준 월: {manageMonthKey}</div>
    </div>

    {/* 기준 월 */}
    <div style={{ background: C.card, borderRadius: 18, padding: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: C.sub, fontWeight: 800, marginBottom: 8 }}>기준 월 선택</div>
      <input
        type="month"
        value={manageMonthKey}
        onChange={(e) => setManageMonthKey(e.target.value)}
        style={{
          width: "100%",
          padding: "12px 12px",
          borderRadius: 14,
          border: `1px solid ${C.border}`,
          background: "#fff",
          fontFamily: "inherit",
          fontSize: 13,
          outline: "none",
        }}
      />
      <div style={{ fontSize: 12, color: C.sub, marginTop: 10, lineHeight: 1.55 }}>
        • 이 월을 기준으로 “거래 초기화”, “고정항목 적용범위 초기화”를 실행해요.
      </div>
    </div>

    {/* 거래 초기화 */}
    <div style={{ background: C.card, borderRadius: 18, padding: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 900 }}>거래 데이터</div>
        <span style={{ fontSize: 12, color: C.sub }}>transactions</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
        <button
          onClick={() => resetTransactionsByMonthKey(manageMonthKey)}
          style={{
            width: "100%",
            padding: "12px 12px",
            borderRadius: 14,
            border: `1px solid ${C.expense}`,
            background: C.expenseL,
            color: C.expense,
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          선택 달 거래 초기화
        </button>

        <button
          onClick={() => resetAllTransactions()}
          style={{
            width: "100%",
            padding: "12px 12px",
            borderRadius: 14,
            border: `1px solid ${C.text}`,
            background: "#1118270A",
            color: C.text,
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          전체 거래 초기화
        </button>
      </div>

      <div style={{ fontSize: 12, color: C.sub, marginTop: 12, lineHeight: 1.55 }}>
        • “선택 달 거래 초기화”는 해당 월의 거래만 삭제해요.<br />
        • “전체 거래 초기화”는 모든 거래를 삭제해요(고정항목은 유지).
      </div>
    </div>

    {/* 고정항목 적용범위 */}
    <div style={{ background: C.card, borderRadius: 18, padding: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 900 }}>고정항목 적용범위</div>
        <span style={{ fontSize: 12, color: C.sub }}>fixed_items</span>
      </div>

      <button
        onClick={() => resetFixedHistoryFromMonth(manageMonthKey)}
        style={{
          width: "100%",
          padding: "12px 12px",
          borderRadius: 14,
          border: `1px solid ${C.fixed}`,
          background: C.fixedL,
          color: "#B45309",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        고정항목 과거 적용 초기화 (선택 월부터)
      </button>

      <div style={{ fontSize: 12, color: C.sub, marginTop: 12, lineHeight: 1.55 }}>
        이 작업은 “고정항목이 과거 전체에 적용돼서 월별비교가 같이 바뀌는 현상”을 정리해요.<br />
        • 과거 버전(히스토리)을 지우고<br />
        • 모든 고정항목을 <b>{manageMonthKey}</b>부터만 적용되게 재설정해요.
      </div>
    </div>
  </div>
)}
        </main>
      )}

      {(tab === "monthly" || tab === "daily") && !loading && (
        <button
          onClick={() => {
            setEditItem(null);
            setForm({
              date: todayStr(),
              type: "expense",
              category: "식비",
              name: "",
              amount: "",
              memo: "",
              payInstrument: "신용카드",
              payMethod: "카드",
            });
            setShowForm(true);
          }}
          style={{
            position: "fixed",
            bottom: 24,
            right: "max(calc(50% - 220px), 20px)",
            width: 54,
            height: 54,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: C.accent,
            color: "#fff",
            fontSize: 28,
            fontWeight: 700,
            boxShadow: `0 4px 18px ${C.accent}55`,
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
      )}

      {showMonthPick && (
        <Modal title="날짜 선택" onClose={() => setShowMonthPick(false)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={() => setYear((y) => y - 1)} style={yrNav}>
              ‹
            </button>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{year}년</span>
            <button onClick={() => setYear((y) => y + 1)} style={yrNav}>
              ›
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
            {MONTHS.map((m, i) => {
              const isCur = i === today.getMonth() && year === today.getFullYear();
              const isSel = i === month;
              return (
                <button
                  key={i}
                  onClick={() => {
                    setMonth(i);
                    setShowMonthPick(false);
                  }}
                  style={{
                    padding: "11px 0",
                    borderRadius: 10,
                    border: "1px solid",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 14,
                    fontWeight: 600,
                    transition: "all .15s",
                    background: isSel ? C.accent : C.bg,
                    color: isSel ? "#fff" : isCur ? C.accent : C.text,
                    borderColor: isSel ? C.accent : isCur ? C.accent : C.border,
                    fontStyle: isCur && !isSel ? "italic" : "normal",
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => {
              goToday();
              setShowMonthPick(false);
            }}
            style={{
              width: "100%",
              background: C.accentL,
              border: `1px solid ${C.accent}`,
              borderRadius: 10,
              padding: "11px 0",
              color: C.accent,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            오늘로 이동
          </button>
        </Modal>
      )}

      {showForm && (
        <Modal
          title={editItem ? "내역 수정" : "내역 추가"}
          onClose={() => {
            setShowForm(false);
            setEditItem(null);
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["expense", "income"].map((t) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "1px solid",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 700,
                  transition: "all .2s",
                  background: form.type === t ? (t === "income" ? C.incomeL : C.expenseL) : C.bg,
                  color: form.type === t ? (t === "income" ? C.income : C.expense) : C.sub,
                  borderColor: form.type === t ? (t === "income" ? C.income : C.expense) : C.border,
                }}
              >
                {t === "income" ? "💚 수입" : "❤️ 지출"}
              </button>
            ))}
          </div>
          <Lbl>날짜</Lbl>
          <Inp type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <Lbl>카테고리</Lbl>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {CATEGORIES[form.type].map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, category: c }))}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: "1px solid",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  transition: "all .15s",
                  background: form.category === c ? C.accent : C.bg,
                  color: form.category === c ? "#fff" : C.sub,
                  borderColor: form.category === c ? C.accent : C.border,
                }}
              >
                {CAT_ICONS[c]} {c}
              </button>
            ))}
          </div>
          <Lbl>이름</Lbl>
          <Inp
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="예) 스타벅스, 점심, 택시, 아이폰 할부..."
          />
          <Lbl>금액 (원)</Lbl>
          <Inp
            type="number"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="0"
            inputMode="numeric"
          />

          <Lbl>결제수단</Lbl>
          <Inp
            type="text"
            list="payInstrumentList"
            value={form.payInstrument}
            onChange={(e) => setForm((f) => ({ ...f, payInstrument: e.target.value }))}
            placeholder="예) 신용카드, 현금, 계좌이체..."
          />
          <datalist id="payInstrumentList">
            {PAY_INSTRUMENTS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <Lbl>결제방법</Lbl>
          <Inp
            type="text"
            list="payMethodList"
            value={form.payMethod}
            onChange={(e) => setForm((f) => ({ ...f, payMethod: e.target.value }))}
            placeholder="예) 카드, 카카오페이, 애플 구독..."
          />
          <datalist id="payMethodList">
            {PAY_METHODS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <Lbl>메모 (선택)</Lbl>
          <Inp
            type="text"
            value={form.memo}
            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
            placeholder="간단한 메모..."
          />
          <SBtn onClick={handleSaveTx}>{editItem ? "수정하기" : "저장하기"}</SBtn>
        </Modal>
      )}

      {showFixedForm && (
        <Modal
          title={editFixed ? "고정 항목 수정" : "고정 항목 추가"}
          onClose={() => {
            setShowFixedForm(false);
            setEditFixed(null);
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["expense", "income"].map((t) => (
              <button
                key={t}
                onClick={() => setFixedForm((f) => ({ ...f, type: t }))}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "1px solid",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 700,
                  transition: "all .2s",
                  background: fixedForm.type === t ? (t === "income" ? C.incomeL : C.expenseL) : C.bg,
                  color: fixedForm.type === t ? (t === "income" ? C.income : C.expense) : C.sub,
                  borderColor: fixedForm.type === t ? (t === "income" ? C.income : C.expense) : C.border,
                }}
              >
                {t === "income" ? "💚 고정수입" : "❤️ 고정지출"}
              </button>
            ))}
          </div>
          <Lbl>폴더</Lbl>
          <Inp
            type="text"
            list="fixedGroupList"
            value={fixedForm.group}
            onChange={(e) => setFixedForm((f) => ({ ...f, group: e.target.value }))}
            placeholder="예) 구독, 주거, 보험, 대출..."
          />
          <datalist id="fixedGroupList">
            {[...new Set(fixedItems.map((x) => x.group || "기본"))].sort((a,b)=>a.localeCompare(b)).map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <Lbl>항목명</Lbl>
          <Inp
            type="text"
            value={fixedForm.name}
            onChange={(e) => setFixedForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="월세, 넷플릭스, 월급 등"
          />
          <Lbl>금액 (원)</Lbl>
          <Inp
            type="number"
            value={fixedForm.amount}
            onChange={(e) => setFixedForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="0"
            inputMode="numeric"
          />
          <Lbl>결제수단</Lbl>
          <Inp
            type="text"
            list="fixedPayInstrumentList"
            value={fixedForm.payInstrument}
            onChange={(e) => setFixedForm((f) => ({ ...f, payInstrument: e.target.value }))}
            placeholder="예) 계좌이체, 신용카드..."
          />
          <datalist id="fixedPayInstrumentList">
            {PAY_INSTRUMENTS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <Lbl>결제방법</Lbl>
          <Inp
            type="text"
            list="fixedPayMethodList"
            value={fixedForm.payMethod}
            onChange={(e) => setFixedForm((f) => ({ ...f, payMethod: e.target.value }))}
            placeholder="예) 자동이체, 애플 구독..."
          />
          <datalist id="fixedPayMethodList">
            {PAY_METHODS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <Lbl>메모 (선택)</Lbl>
          <Inp
            type="text"
            value={fixedForm.memo}
            onChange={(e) => setFixedForm((f) => ({ ...f, memo: e.target.value }))}
            placeholder="간단한 메모..."
          />

          <SBtn onClick={handleSaveFixed}>{editFixed ? "수정하기" : "저장하기"}</SBtn>
        </Modal>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 92,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.ok ? "#18191B" : "#E84040",
            color: "#fff",
            padding: "10px 22px",
            borderRadius: 100,
            fontWeight: 600,
            fontSize: 14,
            zIndex: 100,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 14px #00000020",
          }}
        >
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
    <div style={{ background: bg, borderRadius: 12, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {sign}
        {fmt(value)}
      </div>
    </div>
  );
}

function DaySection({ date, items, openEdit, onDelete }) {
  const dayIncome = items.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
  const dayExpense = items.filter((t) => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
  const d = parseDate(date);
  const dow = d.getDay();
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, paddingLeft: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {date.slice(5).replace("-", "/")}
          <span style={{ fontSize: 12, marginLeft: 5, fontWeight: 600, color: dow === 0 ? C.expense : dow === 6 ? C.blue : C.sub }}>
            {DAYS[dow]}
          </span>
        </div>
        <div style={{ fontSize: 12, color: C.sub, display: "flex", gap: 8 }}>
          {dayIncome > 0 && <span style={{ color: C.income }}>+{fmt(dayIncome)}</span>}
          {dayExpense > 0 && <span style={{ color: C.expense }}>-{fmt(dayExpense)}</span>}
        </div>
      </div>
      <DayList date={date} items={items} openEdit={openEdit} onDelete={onDelete} />
    </div>
  );
}

function DayList({ date, items, openEdit, onDelete }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ background: C.card, borderRadius: 14, border: `1px dashed ${C.border}`, padding: "14px", color: C.sub, fontSize: 13, textAlign: "center" }}>
        이 날 내역이 없어요
      </div>
    );
  }
  return (
    <div style={{ background: C.card, borderRadius: 14, overflow: "hidden", border: `1px solid ${C.border}`, boxShadow: "0 1px 4px #00000006" }}>
      {items.map((t, i) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: t.type === "income" ? C.incomeL : C.expenseL,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {CAT_ICONS[t.category] || "💳"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name || t.category}</div>
            {t.name && (
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {CAT_ICONS[t.category] || "🏷️"} {t.category}
              </div>
            )}
            {t.memo && <div style={{ fontSize: 11, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.memo}</div>}
            {(t.payInstrument || t.payMethod) && (
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.payInstrument ? `💳 ${t.payInstrument}` : ""}
                {t.payInstrument && t.payMethod ? " · " : ""}
                {t.payMethod ? `⚡ ${t.payMethod}` : ""}
              </div>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.type === "income" ? C.income : C.expense, whiteSpace: "nowrap" }}>
            {t.type === "income" ? "+" : "-"}
            {fmt(t.amount)}원
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            <IBtn onClick={() => openEdit(t)} e="✏️" />
            <IBtn onClick={() => onDelete(t.id)} e="🗑️" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarCompare({ year, month, dailyTotals, prevDailyTotals, prevMonthInfo, selectedDate, onSelectDate }) {
  const totalDays = daysInMonth(year, month);
  const startDow = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const mm = String(month + 1).padStart(2, "0");
  const prevTotalDays = daysInMonth(prevMonthInfo.py, prevMonthInfo.pm);

  const isToday = (dateStr) => dateStr === todayStr();

  return (
    <div style={{ background: C.card, borderRadius: 16, padding: "14px 14px 12px", border: `1px solid ${C.border}`, boxShadow: "0 1px 4px #00000006" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>이번달 vs 지난달(같은 날짜)</div>
        <div style={{ fontSize: 11, color: C.sub }}>표시: 지출</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginBottom: 8 }}>
        {DAYS.map((d, i) => (
          <div key={d} style={{ fontSize: 11, color: i === 0 ? C.expense : i === 6 ? C.blue : C.sub, fontWeight: 800, textAlign: "center" }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
        {cells.map((d, idx) => {
          if (!d) return <div key={`e-${idx}`} />;
          const dd = String(d).padStart(2, "0");
          const dateStr = `${year}-${mm}-${dd}`;
          const cur = dailyTotals[dateStr];

          let prevExpense = 0;
          if (d <= prevTotalDays) {
            const pmm = String(prevMonthInfo.pm + 1).padStart(2, "0");
            const prevDateStr = `${prevMonthInfo.py}-${pmm}-${dd}`;
            prevExpense = prevDailyTotals[prevDateStr]?.expense || 0;
          }

          const expense = cur?.expense || 0;
          const hasData = expense > 0 || (cur?.income || 0) > 0;
          const isSel = selectedDate === dateStr;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              style={{
                border: `1px solid ${isSel ? C.accent : C.border}`,
                background: isSel ? C.accentL : C.bg,
                borderRadius: 12,
                padding: "10px 8px",
                cursor: "pointer",
                minWidth: 0,
                overflow: "hidden",
                fontFamily: "inherit",
                textAlign: "left",
                minHeight: 64,
                position: "relative",
                opacity: d ? 1 : 0,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: isToday(dateStr) ? C.accent : C.text }}>{d}</span>
                {hasData && <span style={{ fontSize: 10, color: C.sub, fontWeight: 800 }}>•</span>}
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: expense > 0 ? C.expense : C.sub, lineHeight: 1.15 }}>
                {expense > 0 ? `-${fmt(expense)}` : "-"}
              </div>
              <div style={{ fontSize: 10, color: C.sub, marginTop: 3, lineHeight: 1.1 }}>
                {prevExpense > 0 ? `지난달 -${fmt(prevExpense)}` : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function Empty({ text, emoji }) {
  return (
    <div style={{ textAlign: "center", color: C.sub, marginTop: 60, fontSize: 15 }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{emoji}</div>
      {text}
    </div>
  );
}
function IBtn({ onClick, e }) {
  return (
    <button
      onClick={onClick}
      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: "4px", opacity: 0.55, lineHeight: 1 }}
    >
      {e}
    </button>
  );
}
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "#00000035" }} onClick={onClose} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "#fff",
          borderRadius: "22px 22px 0 0",
          padding: "22px 18px 38px",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          animation: "slideUp .26s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.sub, lineHeight: 1 }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Lbl({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 6, letterSpacing: ".4px", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}
function Inp(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "12px 14px",
        color: C.text,
        fontSize: 15,
        fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
        marginBottom: 14,
        outline: "none",
      }}
    />
  );
}

function Sel(props) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "12px 14px",
        color: C.text,
        fontSize: 15,
        fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
        marginBottom: 14,
        outline: "none",
        appearance: "none",
      }}
    />
  );
}
function SBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        background: C.accent,
        border: "none",
        borderRadius: 12,
        padding: "14px 0",
        color: "#fff",
        fontSize: 16,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
        marginTop: 4,
      }}
    >
      {children}
    </button>
  );
}

const navBtn = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  color: C.text,
  width: 36,
  height: 36,
  borderRadius: 10,
  fontSize: 20,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "inherit",
};
const yrNav = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  color: C.text,
  width: 36,
  height: 36,
  borderRadius: 8,
  fontSize: 18,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "inherit",
};