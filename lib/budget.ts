export type Bill = {id:string; name:string; amount:number|null; date:string; monthly:boolean; category:'Bills'|'Tuition'; saved:number; weeklyReserve?:number; frequency?:Frequency; startDate?:string; endDate?:string};
export type Pay = {id:string; date:string; gross:number; tax:number; deductions:number};
export type Frequency = 'once'|'weekly'|'biweekly'|'monthly';
export type Expense = {id:string; date:string; name:string; amount:number; category:string; frequency?:Frequency; endDate?:string};
export type CashSettings = {openingDate:string; openingBalance:number; periodStart:string; periodEnd:string};
export type PaymentRecord = {id:string; billId:string; name:string; scheduledDate:string; date:string; amount:number};
export type Data = {cash?:CashSettings; payments?:PaymentRecord[];commitmentsVersion?:number;bills:Bill[]; pay:Pay[]; expenses:Expense[]; salary:{gross:number; tax:number; deductions:number; payday:number}};
export const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
export const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const date=(s:string)=>new Date(s+'T12:00:00');
export function nextMonth(s:string){const d=date(s); const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));return iso(d);}
export function weekStart(s:string,payday:number){const d=date(s);d.setDate(d.getDate()-(d.getDay()-payday+7)%7);return iso(d);}
export function reserve(b:Bill,week:string){if(b.amount===null)return 0;if(b.weeklyReserve!==undefined)return Math.min(b.weeklyReserve,Math.max(0,Math.round((b.amount-b.saved)*100)/100));const days=Math.round((date(b.date).getTime()-date(week).getTime())/86400000);const checks=Math.max(1,Math.floor(days/7)+1);return Math.ceil(Math.max(0,Math.round(b.amount*100)-Math.round(b.saved*100))/checks)/100;}
export const initial:Data={salary:{gross:1193,tax:243.72,deductions:0,payday:5},pay:[],expenses:[],bills:[
...[[18,9,56.16],[2,10,56.14],[8,10,43.86],[16,10,31.02],[8,11,43.86],[8,12,43.86],[8,1,43.86]].map(([d,m,a],i)=>({id:'installment'+i,name:'Installment '+(i+1)+' · confirm name',amount:a,date:`${m===1?2027:2026}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`,monthly:false,category:'Bills' as const,saved:0})),
...[['Monthly payment · confirm name',47.97,7],['Monthly payment · confirm name',20,16],['Capital One · card 1',null,27],['Capital One · card 2',null,27],['Discover',null,15],['NJIT tuition',null,15],['Car insurance',150.62,22],['Spotify',7.49,20],['Google',1.99,16],['iCloud · plan 1',2.12,4],['iCloud · plan 2',2.99,27]].map(([name,amount,day],i)=>({id:'bill'+i,name:String(name),amount:amount===null?null:Number(amount),date:`2026-${Number(day)<11?'10':'09'}-${String(day).padStart(2,'0')}`,monthly:true,category:(name==='NJIT tuition'?'Tuition':'Bills') as 'Bills'|'Tuition',saved:0}))]};

// Generate occurrences from the original anchor, preserving month-end dates.
export function expenseOccurrences(e:Expense,from:string,to:string):Expense[]{
 const last=e.endDate&&e.endDate<to?e.endDate:to;
 if(last<from||last<e.date)return [];
 const frequency=e.frequency||'once';
 if(frequency==='once')return e.date>=from&&e.date<=last?[e]:[];
 const anchor=date(e.date), start=date(from), result:Expense[]=[];
 const interval=frequency==='biweekly'?14:7;
 let index=frequency==='monthly'?Math.max(0,(start.getFullYear()-anchor.getFullYear())*12+start.getMonth()-anchor.getMonth()):Math.max(0,Math.floor((start.getTime()-anchor.getTime())/86400000/interval));
 for(;;index++){
  const occurrence=date(e.date);
  if(frequency==='monthly'){occurrence.setDate(1);occurrence.setMonth(occurrence.getMonth()+index);occurrence.setDate(Math.min(anchor.getDate(),new Date(occurrence.getFullYear(),occurrence.getMonth()+1,0).getDate()));}
  else occurrence.setDate(occurrence.getDate()+index*interval);
  const day=iso(occurrence);if(day>last)break;
  if(day>=from)result.push({...e,date:day});
 }
 return result;
}
export function applyCommitments(data:Data,today:string):Data{
 if(data.commitmentsVersion===1)return data;
 const friday=weekStart(today,5);
 const due=date(today);due.setDate(15);if(iso(due)<today)due.setMonth(due.getMonth()+1);
 const existing=data.bills.find(b=>b.id==='bill5'||b.name.toLowerCase()==='njit tuition');
 const tuition:Bill={...(existing||{id:'njit-tuition',name:'NJIT tuition',saved:0}),amount:1600,date:existing?.date||iso(due),monthly:true,category:'Tuition',weeklyReserve:400};
 return {...data,commitmentsVersion:1,bills:existing?data.bills.map(b=>b.id===existing.id?tuition:b):[...data.bills,tuition],expenses:[...data.expenses,
 ...([{id:'family-mom-food',name:'Mom ? food',amount:200,category:'Food & drinks'}, {id:'family-dad-rent',name:'Dad ? rent',amount:100,category:'Housing'}]).filter(e=>!data.expenses.some(x=>x.id===e.id)).map(e=>({...e,date:friday,frequency:'weekly' as const}))]};
}

export const billFrequency=(b:Bill):Frequency=>b.frequency??(b.monthly?'monthly':'once');
export function advanceBill(b:Bill):Bill{
 const frequency=billFrequency(b);
 const d=date(b.date);d.setDate(d.getDate()+(frequency==='biweekly'?14:7));
 return {...b,date:frequency==='monthly'?nextMonth(b.date):iso(d),saved:0};
}


export function addDays(s:string,days:number){const d=date(s);d.setDate(d.getDate()+days);return iso(d);}
export function dayDifference(a:string,b:string){return Math.round((Date.UTC(date(a).getFullYear(),date(a).getMonth(),date(a).getDate())-Date.UTC(date(b).getFullYear(),date(b).getMonth(),date(b).getDate()))/86400000);}
export function periodFor(data:Data,today:string,offset=0){
 const anchor=data.cash?.periodStart||weekStart(today,data.salary.payday);
 const length=data.cash?dayDifference(data.cash.periodEnd,anchor)+1:7;
 const start=addDays(anchor,(Math.floor(dayDifference(today,anchor)/length)+offset)*length);
 return {start,end:addDays(start,length-1)};
}
export function billOccurrences(b:Bill,from:string,to:string):Bill[]{
 return expenseOccurrences({id:b.id,name:b.name,category:b.category,amount:b.amount||0,date:b.startDate||b.date,frequency:billFrequency(b),...(b.endDate?{endDate:b.endDate}:{})},from,to).map(e=>({...b,startDate:b.startDate||b.date,date:e.date}));
}
export function isPaid(data:Data,b:Bill){return (data.payments||[]).some(p=>p.billId===b.id&&p.scheduledDate===b.date);}
export function recordPayment(data:Data,b:Bill,paidDate:string,id:string):Data{
 if(b.amount===null)throw Error('Set the payment amount before marking it paid.');
 if(isPaid(data,b))throw Error('This occurrence is already marked paid.');
 return {...data,bills:data.bills.map(x=>x.id===b.id?{...x,saved:0}:x),payments:[...(data.payments||[]),{id,billId:b.id,name:b.name,scheduledDate:b.date,date:paidDate,amount:b.amount}]};
}
export function nextUnpaidBill(data:Data,b:Bill):Bill|null{
 const from=b.startDate||b.date;
 // A bounded search covers old schedules without an unbounded loop.
 const latest=(data.payments||[]).filter(p=>p.billId===b.id).reduce((last,p)=>p.scheduledDate>last?p.scheduledDate:last,from);
 const limit=addDays(latest,366);
 const to=b.endDate&&b.endDate<limit?b.endDate:limit;
 return billOccurrences(b,from,to).find(x=>!isPaid(data,x))||null;
}
const cents=(n:number)=>Math.round(n*100);
export function cashFlow(data:Data,from:string,to:string,projected:boolean){
 if(to<from)return {income:0,bills:0,spending:0,unknown:0};
 let income=data.pay.filter(p=>p.date>=from&&p.date<=to).reduce((sum,p)=>sum+cents(p.gross-p.tax-p.deductions),0);
 if(projected){
  const first=addDays(from,(data.salary.payday-date(from).getDay()+7)%7);
  for(let day=first;day<=to;day=addDays(day,7)){
   // A recorded paycheck anywhere in this pay week replaces its salary estimate.
   if(!data.pay.some(p=>weekStart(p.date,data.salary.payday)===day))income+=cents(data.salary.gross-data.salary.tax-data.salary.deductions);
  }
 }
 let bills=(data.payments||[]).filter(p=>p.date>=from&&p.date<=to).reduce((sum,p)=>sum+cents(p.amount),0),unknown=0;
 if(projected)for(const b of data.bills)for(const occurrence of billOccurrences(b,from,to)){
  if(isPaid(data,occurrence))continue;
  if(occurrence.amount===null)unknown++;else bills+=cents(occurrence.amount);
 }
 const spending=data.expenses.filter(e=>projected||(e.frequency||'once')==='once').flatMap(e=>expenseOccurrences(e,from,to)).reduce((sum,e)=>sum+cents(e.amount),0);
 return {income:income/100,bills:bills/100,spending:spending/100,unknown};
}
export function balanceAt(data:Data,through:string,projected:boolean){
 if(!data.cash||through<data.cash.openingDate)return null;
 const flow=cashFlow(data,data.cash.openingDate,through,projected);
 return Math.round((data.cash.openingBalance+flow.income-flow.bills-flow.spending)*100)/100;
}
export function periodSummary(data:Data,start:string,end:string){
 if(data.cash&&end<data.cash.openingDate)return {income:0,bills:0,spending:0,unknown:0,opening:0,closing:0};
 const from=data.cash&&start<data.cash.openingDate?data.cash.openingDate:start;
 const flow=cashFlow(data,from,end,true);
 const opening=data.cash?(start<=data.cash.openingDate?data.cash.openingBalance:balanceAt(data,addDays(start,-1),true)||0):0;
 return {...flow,opening,closing:Math.round((opening+flow.income-flow.bills-flow.spending)*100)/100};
}
