"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  LayoutDashboard,
  CalendarDays,
  GraduationCap,
  Receipt,
  Wallet,
  Settings,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Pencil,
  Check,
  X,
  Leaf,
  Menu,
} from "lucide-react";
import {
  Bill,
  Expense,
  Data,
  Frequency,
  applyCommitments,
  expenseOccurrences,
  initial,
  money,
  iso,
  date,
  weekStart,
  reserve,
  nextMonth,
  billFrequency,
  advanceBill,
  periodFor, periodSummary, balanceAt, billOccurrences, isPaid, recordPayment, nextUnpaidBill, dayDifference,
} from "../lib/budget";
import { validData } from "../lib/validation";
const tabs = [
  "Overview",
  "Bills & payments",
  "Spending",
  "School tuition",
  "Income & taxes",
  "Settings",
];
const icons = [
  LayoutDashboard,
  CalendarDays,
  Wallet,
  GraduationCap,
  Receipt,
  Settings,
];
const id = () => crypto.randomUUID();
function download(data: Data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "weekly-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}
export default function Dashboard({
  data,
  setData, profileName, email, onSignOut, onSaveName, syncStatus,
}: {
  profileName:string; email:string; onSignOut:()=>Promise<void>; onSaveName:(name:string)=>Promise<void>; syncStatus:string;
  data: Data;
  setData: React.Dispatch<React.SetStateAction<Data>>;
}) {
  const [expenseEdit,setExpenseEdit]=useState<Expense|null>(null);
  const [menuOpen,setMenuOpen]=useState(true);
  const [profileOpen,setProfileOpen]=useState(false);
  const firstName=profileName.trim().split(/\s+/)[0]||'My';
  const workspaceName=firstName+' workspace';
  const initialLetter=Array.from(profileName.trim()||email||'?')[0].toUpperCase();
  useEffect(()=>{setMenuOpen(window.innerWidth>800);},[]);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setProfileOpen(false);setMenuOpen(false);}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[]);
  const [ready, setReady] = useState(false),
    [tab, setTab] = useState("Overview"),
    [today, setToday] = useState("2026-09-11"),
    [offset, setOffset] = useState(0),
    [modal, setModal] = useState<"bill" | "expense" | "pay" | null>(null),
    [edit, setEdit] = useState<Bill | null>(null),
    [notice, setNotice] = useState(""),
    [year, setYear] = useState(2026);
  useEffect(() => {
    const now = iso(new Date());
    setToday(now);
    setYear(date(now).getFullYear());
    setReady(true);
  }, []);
  const period=periodFor(data,today,offset);
  const week=period.start,weekEnd=period.end,d=date(week),end=date(weekEnd);
  const summary=periodSummary(data,week,weekEnd);
  const net=summary.income;
  const bills=summary.bills;
  const tuition=data.bills.filter(b=>b.category==='Tuition').map(b=>nextUnpaidBill(data,b)).filter((b):b is Bill=>b!==null).reduce((sum,b)=>sum+reserve(b,week),0);
  const weeklyExpenses=data.expenses.flatMap(e=>expenseOccurrences(e,week,weekEnd));
  const spending=summary.spending;
  const available=summary.closing;
  const unknown=summary.unknown;
  const recordedBalance=balanceAt(data,today,false);
  const upcoming=data.bills.flatMap(b=>billOccurrences(b,week,weekEnd)).filter(b=>!isPaid(data,b)).sort((a,b)=>a.date.localeCompare(b.date));
  const yearly = data.pay.filter((p) => p.date.startsWith(String(year)));
  const taxes = yearly.reduce((s, p) => s + p.tax, 0);
  const updateBill = (b: Bill) =>
    setData((v) => ({
      ...v,
      bills: v.bills.map((x) => (x.id === b.id ? b : x)),
    }));
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => Number(f.get(k));
    const s = (k: string) => String(f.get(k) || "");
    if(modal!=='pay'&&s('endDate')&&s('endDate')<s('date')){setNotice('End date must be on or after the start date.');return;}
    if (modal === "bill") {
      const b: Bill = {
        id: edit?.id || id(),
        name: s("name"),
        amount: s("amount") === "" ? null : n("amount"),
        date: s("date"),
        startDate:s("date"),
        ...(s("endDate")?{endDate:s("endDate")}:{ }),
        monthly: s("frequency") === "monthly",
        frequency: s("frequency") as Frequency,
        category: s("category") as Bill["category"],
        saved: n("saved"),
        ...(s("weeklyReserve") !== ""
          ? { weeklyReserve: n("weeklyReserve") }
          : {}),
      };
      setData((v) => ({
        ...v,
        bills: edit
          ? v.bills.map((x) => (x.id === b.id ? b : x))
          : [...v.bills, b],
      }));
    }
    if(modal==='expense'){
      const expense:Expense={id:expenseEdit?.id||id(),name:s('name'),date:s('date'),amount:n('amount'),category:s('category'),frequency:s('frequency') as Frequency,...(s('endDate')?{endDate:s('endDate')}:{})};
      setData(v=>({...v,expenses:expenseEdit?v.expenses.map(x=>x.id===expense.id?expense:x):[...v.expenses,expense]}));
    }
    if (modal === "pay") {
      if (n("tax") + n("deductions") > n("gross")) {
        setNotice("Taxes and deductions cannot exceed gross pay.");
        return;
      }
      if (data.pay.some((p) => p.date === s("date"))) {
        setNotice("A paycheck is already recorded on this date.");
        return;
      }
      setData((v) => ({
        ...v,
        pay: [
          ...v.pay,
          {
            id: id(),
            date: s("date"),
            gross: n("gross"),
            tax: n("tax"),
            deductions: n("deductions"),
          },
        ],
      }));
    }
    setModal(null);
    setEdit(null);setExpenseEdit(null);
  }
  function billRows(items: Bill[]) {
    return (
      <div className="bill-list">
        {items.length === 0 && (
          <p className="empty">All clear. Add a payment to start planning.</p>
        )}
        {items.map((b) => (
          <div className="bill-row" key={`${b.id}-${b.date}`}>
            <span
              className={
                "bill-icon " + (b.category === "Tuition" ? "purple" : "")
              }
            >
              {b.category === "Tuition" ? (
                <GraduationCap size={19} />
              ) : (
                <Receipt size={18} />
              )}
            </span>
            <div className="grow">
              <strong>{b.name}</strong>
              <small>
                {date(b.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                · {{once:"One-time",weekly:"Weekly",biweekly:"Biweekly",monthly:"Monthly"}[billFrequency(b)]}
                {b.date < today ? " · Overdue / confirm paid" : ""}
              </small>
            </div>
            <div className="amount">
              <strong>
                {b.amount === null ? "Set amount" : money(b.amount)}
              </strong>
              <small>{billFrequency(b)==="once"?"One-time":`Repeats ${billFrequency(b)}`}</small>
              {b.weeklyReserve !== undefined && (
                <small>
                  {money(b.saved)} of {money(b.amount || 0)} set aside
                </small>
              )}
            </div>
            <button
              className="icon"
              aria-label={"Edit " + b.name}
              onClick={() => {
                setEdit(b);
                setModal("bill");
              }}
            >
              <Pencil size={16} />
            </button>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`shell ${menuOpen?"sidebar-open":"sidebar-closed"}`}>
      <button className="sidebar-toggle icon" aria-label={menuOpen?"Hide menu":"Show menu"} aria-expanded={menuOpen} aria-controls="workspace-sidebar" onClick={()=>{setMenuOpen(!menuOpen);setProfileOpen(false);}}><Menu size={22}/></button>
      {menuOpen&&<button className="sidebar-backdrop" aria-label="Close menu" onClick={()=>setMenuOpen(false)}/>}
      <aside id="workspace-sidebar" inert={!menuOpen}>
        <a className="brand" href="#" onClick={() => setTab("Overview")}>
          <span>
            <Leaf size={24} />
          </span>
          weekly<span className="brand-dot">.</span>
        </a>
        <div className="workspace">PERSONAL WORKSPACE</div>
        <nav>
          {tabs.map((t, i) => {
            const Icon = icons[i];
            return (
              <button
                key={t}
                className={tab === t ? "selected" : ""}
                onClick={() => {setTab(t);setProfileOpen(false);if(window.innerWidth<=800)setMenuOpen(false);}}
              >
                <Icon size={19} />
                {t}
                {t === "Overview" && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span>
            Small plans.
            <br />
            More peace of mind.
          </span>
          <p>Give every payday a purpose.</p>
          <div className="mini-lines">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="profile-area">
          {profileOpen&&<div className="profile-popover" id="profile-actions"><strong>{profileName||'Complete your profile'}</strong><small>{email}</small><button onClick={()=>{setTab('Settings');setProfileOpen(false);}}>Profile settings</button><button onClick={onSignOut}>Sign out</button></div>}
          <button className="profile" aria-expanded={profileOpen} aria-controls="profile-actions" onClick={()=>setProfileOpen(!profileOpen)}><span>{initialLetter}</span><div><strong>{workspaceName}</strong><small>{syncStatus}</small></div><span className="online"/></button>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            {workspaceName} <span>/</span> {tab}
          </div>
          <span className="local-badge">
            <i /> {syncStatus}
          </span>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR MONEY, A LITTLE CLEARER</div>
              <h1>{tab === "Overview" ? "Your week, in balance." : tab}</h1>
              <p>
                {tab === "Overview"
                  ? "A plan for your paycheck. Room for your life."
                  : tab === "Income & taxes"
                    ? "Your earnings and withholding, all in one place."
                    : "Make a little space for what matters."}
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setEdit(null);setExpenseEdit(null);
                setModal(
                  tab === "Bills & payments" || tab === "School tuition"
                    ? "bill"
                    : tab === "Income & taxes"
                      ? "pay"
                      : "expense",
                );
              }}
            >
              <Plus size={18} />
              {tab === "Bills & payments" || tab === "School tuition"
                ? "Add payment"
                : tab === "Income & taxes"
                  ? "Record paycheck"
                  : "Add spending"}
            </button>
          </div>
          {notice && (
            <div className="alert">
              {notice}
              <button
                className="icon"
                onClick={() => setNotice("")}
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          )}
          {!ready ? (
            <p>Loading your workspace…</p>
          ) : (
            <>
              {tab === "Overview" && (
                <>
                  <div className="week-bar">
                    <div className="week-picker">
                      <CalendarDays size={17} />
                      <strong>
                        {d.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        –{" "}
                        {end.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </strong>
                      <span>
                        {offset === 0 ? "Current period" : "Planning view"}
                      </span>
                    </div>
                    <div>
                      <button
                        className="icon"
                        aria-label="Previous period"
                        onClick={() => setOffset(offset - 1)}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        className="icon"
                        aria-label="Next period"
                        onClick={() => setOffset(offset + 1)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                  <details className="period-editor card"><summary>Edit starting money and period cycle</summary><CashSettingsForm data={data} today={today} onSave={value=>{setData(value);setOffset(0);}}/></details>
                  {data.cash&&weekEnd<data.cash.openingDate&&<p className="alert">This period is before your opening balance date; no balance history is assumed.</p>}
                  {unknown > 0 && (
                    <div className="setup">
                      <span>
                        <strong>A few details to finish your plan</strong> ·{" "}
                        {unknown} payment amounts still need your input.
                      </span>
                      <button onClick={() => setTab("Bills & payments")}>
                        Review payments <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                  <div className="stats">
                    <div className="stat">
                      <span>
                        Recorded balance <Wallet size={17} />
                      </span>
                      <h2>{recordedBalance===null?"Set starting money":money(recordedBalance)}</h2>
                      <small>Opening balance + recorded pay - recorded outflows</small>
                    </div>
                    <div className="stat">
                      <span>
                        Payments this period <CalendarDays size={17} />
                      </span>
                      <h2>{money(bills)}</h2>
                      <small>Due within the selected dates</small>
                    </div>
                    <div className="stat green">
                      <span>
                        {available < 0
                          ? "Projected shortfall"
                          : "Projected leftover"}{" "}
                        <ArrowUpRight size={18} />
                      </span>
                      <h2>{money(available)}</h2>
                      <small>
                        {unknown
                          ? "Provisional · missing payment amounts"
                          : "Carries into the next period"}
                      </small>
                    </div>
                  </div>
                  <div className="dashboard-grid">
                    <section className="card allocation"><h3>Your running balance</h3><p>Projected cash flow for {week} through {weekEnd}.</p><div className="legend cash-legend">{[['Starting / carried money',summary.opening],['Income (recorded or estimated)',summary.income],['Payments due',-summary.bills],['Spending & commitments',-summary.spending],['Leftover for the next period',summary.closing]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{money(Number(value))}</strong></div>)}</div><p className="footnote">Estimates use your weekly salary only when no paycheck is recorded for that pay week. Future bills affect the period they are due. Saving toward a bill is not an extra expense.</p>{!data.cash&&<button className="wide-link" onClick={()=>setTab('Settings')}>Set starting money and period</button>}</section>
                    <section className="card">
                      <div className="card-heading">
                        <div>
                          <h3>Due this period</h3>
                          <p>Only payments within the selected dates.</p>
                        </div>
                        <button
                          className="text-btn"
                          onClick={() => setTab("Bills & payments")}
                        >
                          View all <ArrowUpRight size={16} />
                        </button>
                      </div>
                      {billRows(upcoming.slice(0, 5))}
                      <button
                        className="wide-link"
                        onClick={() => {
                          setEdit(null);setExpenseEdit(null);
                          setModal("bill");
                        }}
                      >
                        <Plus size={16} /> Add an upcoming payment
                      </button>
                    </section>
                  </div>
                  <div className="bottom-grid">
                    <section className="tuition-banner">
                      <div className="college-icon">
                        <GraduationCap size={28} />
                      </div>
                      <div className="grow">
                        <span className="eyebrow">
                          INVESTING IN YOUR NEXT CHAPTER
                        </span>
                        <h3>School, one paycheck at a time.</h3>
                        <p>
                          {data.bills.find((b) => b.category === "Tuition")
                            ?.amount == null
                            ? "Set your tuition amount to build your weekly plan."
                            : `${money(tuition)} to reserve this week for tuition.`}
                        </p>
                      </div>
                      <button
                        onClick={() => setTab("School tuition")}
                        className="icon"
                        aria-label="Open tuition"
                      >
                        <ArrowUpRight />
                      </button>
                    </section>
                    <section className="card tax-peek">
                      <Receipt size={22} />
                      <div>
                        <small>{year} TAXES · RECORDED</small>
                        <h3>{money(taxes)}</h3>
                        <span>{yearly.length} paychecks recorded</span>
                      </div>
                      <button
                        className="icon"
                        aria-label="Open taxes"
                        onClick={() => setTab("Income & taxes")}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </section>
                  </div>
                </>
              )}
              {(tab === "Bills & payments" || tab === "School tuition") && (
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h3>
                        {tab === "School tuition"
                          ? "Your tuition plan"
                          : "Your payment calendar"}
                      </h3>
                      <p>
                        Edit a payment to set its amount, due date, or balance
                        already reserved. Unpaid items stay visible.
                      </p>
                    </div>
                  </div>
                  {tab === "School tuition" && (
                    <p className="footnote">
                      Reserve $400 each Friday toward $1,600 due on the 15th.
                      Four contributions fund the goal; pause once fully funded.
                      Update the saved balance after each transfer, then mark
                      the bill paid to record the actual outflow. If fewer than four
                      Fridays remain, you may need a catch-up contribution.
                    </p>
                  )}
                  {billRows(
                    data.bills
                      .filter(
                        (b) =>
                          tab !== "School tuition" || b.category === "Tuition",
                      )
                      .map(b=>nextUnpaidBill(data,b)||b).sort((a, b) => a.date.localeCompare(b.date)),
                  )}
                </section>
              )}
              {tab === "Spending" && (
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h3>Spending journal</h3><div className="period-spending"><h3>Selected period: {week} to {weekEnd}</h3>{weeklyExpenses.length?weeklyExpenses.map(e=><div className="bill-row" key={`${e.id}-${e.date}`}><div className="grow"><strong>{e.name}</strong><small>{e.date}</small></div><strong>{money(e.amount)}</strong></div>):<p>No spending in this period.</p>}</div>
                      <p>
                        {money(spending)} planned for {week} through {weekEnd}
                      </p>
                      <p>
                        One-time purchases and scheduled recurring payments
                        reduce the available money in their pay week. Recurring
                        entries are plans, not confirmation of a transfer.
                      </p>
                    </div>
                  </div>
                  {!data.expenses.length && (
                    <div className="empty">
                      <Wallet size={32} />
                      <h3>A fresh start for your spending.</h3>
                      <p>Add your first purchase when you’re ready.</p>
                    </div>
                  )}
                  {[...data.expenses]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((e) => (
                      <div className="bill-row" key={e.id}>
                        <div className="grow">
                          <strong>{e.name}</strong>
                          <small>
                            {e.date} · {e.category} ?{" "}
                            {
                              {
                                once: "One-time",
                                weekly: "Weekly",
                                biweekly: "Every 2 weeks",
                                monthly: "Monthly",
                              }[e.frequency || "once"]
                            }{e.endDate&&` - Ends ${e.endDate}`}
                          </small>
                        </div>
                        <strong>{money(e.amount)}</strong>
                        <button className="icon" aria-label={'Edit '+e.name} onClick={()=>{setEdit(null);setExpenseEdit(e);setModal('expense');}}><Pencil size={16}/></button>
                        <button
                          className="icon"
                          aria-label={"Delete " + e.name}
                          onClick={() => {
                            if (
                              confirm(
                                "Delete this spending entry and its entire recurring schedule?",
                              )
                            )
                              setData((v) => ({
                                ...v,
                                expenses: v.expenses.filter(
                                  (x) => x.id !== e.id,
                                ),
                              }));
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                </section>
              )}
              {tab === "Income & taxes" && (
                <>
                  <div className="week-bar">
                    <h3>Annual overview</h3>
                    <label>
                      Year{" "}
                      <input
                        className="year"
                        type="number"
                        value={year}
                        min="2000"
                        max="2100"
                        onChange={(e) => setYear(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <div className="stats">
                    <div className="stat">
                      <span>Gross pay recorded</span>
                      <h2>{money(yearly.reduce((s, p) => s + p.gross, 0))}</h2>
                      <small>
                        {yearly.length} paychecks in {year}
                      </small>
                    </div>
                    <div className="stat">
                      <span>Taxes withheld</span>
                      <h2>{money(taxes)}</h2>
                      <small>Recorded paychecks only</small>
                    </div>
                    <div className="stat green">
                      <span>52-week tax projection</span>
                      <h2>{money(data.salary.tax * 52)}</h2>
                      <small>At current pay · not actual tax liability</small>
                    </div>
                  </div>
                  <section className="card">
                    <div className="card-heading">
                      <div>
                        <h3>Paycheck history</h3>
                        <p>
                          Recording a paycheck preserves its amounts when your
                          salary changes. No paychecks are assumed.
                        </p>
                      </div>
                    </div>
                    {!yearly.length && (
                      <p className="empty">
                        No paychecks recorded for {year}. Add a paycheck with
                        its actual payment date.
                      </p>
                    )}
                    {[...yearly]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((p) => (
                        <div className="bill-row" key={p.id}>
                          <div className="grow">
                            <strong>{p.date}</strong>
                            <small>
                              Gross {money(p.gross)} · Taxes {money(p.tax)} ·
                              Deductions {money(p.deductions)}
                            </small>
                          </div>
                          <strong>
                            {money(p.gross - p.tax - p.deductions)}
                          </strong>
                          <button
                            className="icon"
                            aria-label={"Delete paycheck " + p.date}
                            onClick={() =>
                              setData((v) => ({
                                ...v,
                                pay: v.pay.filter((x) => x.id !== p.id),
                              }))
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                  </section>
                </>
              )}
              {tab === "Settings" && (
                <div className="settings-grid">
                  <section className="card"><h3>Starting money & period cycle</h3><CashSettingsForm data={data} today={today} onSave={setData}/></section>
                  <ProfileSettings name={profileName} email={email} onSave={onSaveName}/>
                  <section className="card">
                    <h3>Your weekly paycheck</h3>
                    <p>
                      Update this when your raise arrives. Recorded paychecks
                      keep their original amounts; planning views use this
                      current salary.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const salary = {
                          gross: Number(f.get("gross")),
                          tax: Number(f.get("tax")),
                          deductions: Number(f.get("deductions")),
                          payday: Number(f.get("payday")),
                        };
                        if (salary.tax + salary.deductions > salary.gross) {
                          setNotice(
                            "Taxes and deductions cannot exceed gross pay.",
                          );
                          return;
                        }
                        setData((v) => ({ ...v, salary }));
                      }}
                    >
                      <label>
                        Weekly gross pay
                        <input
                          name="gross"
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          defaultValue={data.salary.gross}
                        />
                      </label>
                      <label>
                        Weekly taxes withheld
                        <input
                          name="tax"
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          defaultValue={data.salary.tax}
                        />
                      </label>
                      <label>
                        Other deductions
                        <input
                          name="deductions"
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          defaultValue={data.salary.deductions}
                        />
                      </label>
                      <label>
                        Payday
                        <select name="payday" defaultValue={data.salary.payday}>
                          {[
                            "Sunday",
                            "Monday",
                            "Tuesday",
                            "Wednesday",
                            "Thursday",
                            "Friday",
                            "Saturday",
                          ].map((x, i) => (
                            <option key={x} value={i}>
                              {x}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="primary">Save paycheck</button>
                    </form>
                  </section>
                  <section className="card">
                    <h3>Your data belongs to you.</h3>
                    <p>
                      Saved to your account and available on your other devices.
                      Export a backup whenever you want a separate copy.
                    </p>
                    <button
                      className="secondary"
                      onClick={() => download(data)}
                    >
                      <Download size={17} /> Export backup
                    </button>
                    <label className="import">
                      Restore a backup
                      <input
                        type="file"
                        accept="application/json"
                        onChange={async (e) => {
                          try {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const v = JSON.parse(await file.text());
                            if (!validData(v)) throw Error();
                            if (
                              confirm("Replace current data with this backup?")
                            ) {
                              setData(applyCommitments(v, today));
                            }
                          } catch {
                            setNotice(
                              "This is not a valid Weekly backup. Current data was kept.",
                            );
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <p className="footnote">
                      Your notes were transcribed as draft payments. Unnamed
                      installments and recurring payments need confirmation. The
                      draft assumes September 2026–January 2027 dates and a
                      Friday payday.
                    </p>
                  </section>
                </div>
              )}
            </>
          )}
          {tab==='Spending'&&!!data.payments?.length&&<section className="card"><h3>Recorded bill payments</h3>{data.payments.map(p=><div className="bill-row" key={p.id}><div className="grow"><strong>{p.name}</strong><small>Paid {p.date} - scheduled {p.scheduledDate}</small></div><strong>{money(p.amount)}</strong></div>)}</section>}
          <footer>
            <Leaf size={14} /> A little clarity. Every payday.
            <span>Weekly · Made for your real life</span>
          </footer>
        </div>
      </main>
      {modal && (
        <div
          className="overlay"
          onClick={() => {
            setModal(null);
            setEdit(null);setExpenseEdit(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "bill"
                ? "Payment details"
                : modal === "pay"
                  ? "Record paycheck"
                  : "Add spending"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-heading">
              <h3>
                {modal === "bill"
                  ? edit
                    ? "Edit payment"
                    : "Add payment"
                  : modal === "pay"
                    ? "Record paycheck"
                    : "Add spending"}
              </h3>
              <button
                className="icon"
                aria-label="Close"
                onClick={() => {
                  setModal(null);
                  setEdit(null);setExpenseEdit(null);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submit}>
              {modal !== "pay" && (
                <label>
                  Name
                  <input
                    name="name"
                    required
                    autoFocus
                    defaultValue={edit?.name||expenseEdit?.name}
                    placeholder={
                      modal === "bill"
                        ? "e.g. Car insurance"
                        : "e.g. Lunch at campus"
                    }
                  />
                </label>
              )}
              <label>
                {modal === "bill" ? "Start date (first payment)" : modal === "expense" ? "Purchase / first payment date" : "Payment date"}
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={edit?.startDate || edit?.date || expenseEdit?.date || today}
                />
              </label>
              {modal!=='pay'&&<label>End date (optional)<input name="endDate" type="date" defaultValue={edit?.endDate||expenseEdit?.endDate||''}/><small>Includes payments on this day. Leave blank for no scheduled end.</small></label>}
              {modal === "pay" ? (
                <>
                  {[
                    ["gross", "Gross pay", data.salary.gross],
                    ["tax", "Taxes withheld", data.salary.tax],
                    ["deductions", "Other deductions", data.salary.deductions],
                  ].map(([key, label, value]) => (
                    <label key={key}>
                      {label}
                      <input
                        name={String(key)}
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        defaultValue={value}
                      />
                    </label>
                  ))}
                </>
              ) : (
                <>
                  <label>
                    Amount ($)
                    {modal === "bill" && (
                      <small>Leave blank if you still need to confirm.</small>
                    )}
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required={modal === "expense"}
                      defaultValue={edit?.amount ?? expenseEdit?.amount ?? ""}
                    />
                  </label>
                  <label>
                    Category
                    <select
                      name="category"
                      defaultValue={
                        edit?.category || expenseEdit?.category ||
                        (tab === "School tuition"
                          ? "Tuition"
                          : modal === "bill"
                            ? "Bills"
                            : "Food & drinks")
                      }
                    >
                      {(modal === "bill"
                        ? ["Bills", "Tuition"]
                        : [
                            "Food & drinks",
                            "Housing",
                            "Transport",
                            "Shopping",
                            "Entertainment",
                            "Other",
                          ]
                      ).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {modal === "expense" && (
                <label>
                  Repeat
                  <select name="frequency" defaultValue={expenseEdit?.frequency||"once"}>
                    <option value="once">One-time</option>
                    <option value="weekly">Weekly (every 7 days)</option>
                    <option value="biweekly">Bi-weekly (every 14 days)</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <small>
                    Starts on the payment date. Monthly repeats keep that day,
                    or the last day of shorter months.
                  </small>
                </label>
              )}
              {modal === "bill" && (
                <>
                  <label>
                    Weekly reserve ($)
                    <input
                      name="weeklyReserve"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={edit?.weeklyReserve ?? ""}
                    />
                    <small>
                      Leave blank to spread the balance across remaining
                      paydays.
                    </small>
                  </label>
                  <label>
                    Already set aside ($)
                    <input
                      name="saved"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={edit?.saved || 0}
                      required
                    />
                  </label>
                  <label>Repeat<select name="frequency" defaultValue={edit?billFrequency(edit):'monthly'}><option value="once">One-time</option><option value="weekly">Weekly (every 7 days)</option><option value="biweekly">Biweekly (every 14 days)</option><option value="monthly">Monthly</option></select><small>Mark paid records this occurrence. Future payments stop at the end date.</small></label>
                </>
              )}
              <button className="primary" type="submit">
                <Check size={17} /> Save{" "}
                {modal === "bill"
                  ? "payment"
                  : modal === "pay"
                    ? "paycheck"
                    : "spending"}
              </button>
            </form>
            {edit && (
              <div className="modal-actions">
                <button
                  className="secondary"
                  disabled={isPaid(data,edit)}
                  onClick={() => {
                    try{setData(v=>recordPayment(v,edit,today,id()));}catch(error){setNotice(error instanceof Error?error.message:'Could not record payment.');return;}
                    setModal(null);
                    setEdit(null);setExpenseEdit(null);
                    setNotice(
                      "Payment recorded in your balance history. This scheduled occurrence will not be charged twice.",
                    );
                  }}
                >
                  Mark {edit.date} paid today
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (confirm("Delete this payment?")) {
                      setData((v) => ({
                        ...v,
                        bills: v.bills.filter((b) => b.id !== edit.id),
                      }));
                      setModal(null);
                      setEdit(null);setExpenseEdit(null);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ProfileSettings({name,email,onSave}:{name:string;email:string;onSave:(name:string)=>Promise<void>}){
 const [message,setMessage]=useState(''),[saving,setSaving]=useState(false);
 return <section className="card"><h3>Your profile</h3><p>Your name appears on your personal workspace.</p><form onSubmit={async e=>{e.preventDefault();const name=String(new FormData(e.currentTarget).get('fullName')||'').trim();if(!name){setMessage('Enter your name.');return;}setSaving(true);setMessage('');try{await onSave(name);setMessage('Profile saved.');}catch{setMessage('Could not save your name. Please try again.');}finally{setSaving(false);}}}><label>Full name<input key={name} name="fullName" defaultValue={name} autoComplete="name" maxLength={100} required/></label><label>Email<input value={email} readOnly type="email"/></label><button className="primary" disabled={saving}>{saving?'Saving...':'Save profile'}</button>{message&&<p role="status">{message}</p>}</form></section>;
}

function CashSettingsForm({data,today,onSave}:{data:Data;today:string;onSave:(data:Data)=>void}){
 const [error,setError]=useState('');const current=periodFor(data,today);
 return <form className="cash-settings" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const cash={openingDate:String(f.get('openingDate')),openingBalance:Number(f.get('openingBalance')),periodStart:String(f.get('periodStart')),periodEnd:String(f.get('periodEnd'))};if(cash.periodEnd<cash.periodStart||dayDifference(cash.periodEnd,cash.periodStart)>365){setError('Choose a period of 1 to 366 days, with the end on or after the start.');return;}setError('');onSave({...data,cash});}}><label>Starting money ($)<input name="openingBalance" type="number" step="0.01" required defaultValue={data.cash?.openingBalance??0}/></label><label>Balance as of the start of<input name="openingDate" type="date" required defaultValue={data.cash?.openingDate||today}/><small>Enter the balance before this date's transactions. Earlier transactions are already included; do not add today's paycheck twice.</small></label><label>First period starts<input name="periodStart" type="date" required defaultValue={data.cash?.periodStart||current.start}/></label><label>First period ends<input name="periodEnd" type="date" required defaultValue={data.cash?.periodEnd||current.end}/><small>Both dates are included. The next cycle starts the following day and keeps the same length. Friday through Thursday is 7 days.</small></label><button className="primary">Save balance & cycle</button>{error&&<p role="alert">{error}</p>}<p className="footnote">Opening money is the baseline for your balance history. Changing it recalculates carryover. Recorded balance uses confirmed paychecks, one-time spending, and bills marked paid. Projections also include scheduled recurring spending and estimated pay.</p></form>;
}
