import {test} from 'node:test';import assert from 'node:assert/strict';import {reserve,nextMonth,weekStart,initial,applyCommitments,expenseOccurrences} from './budget';
test('due-date funding counts current payday and uses cents',()=>{const b={...initial.bills[0],amount:150.62,saved:0,date:'2026-09-22'};assert.equal(reserve(b,'2026-09-11'),75.31);assert.equal(reserve({...b,saved:50},'2026-09-11'),50.31);assert.equal(reserve({...b,amount:null},'2026-09-11'),0);assert.equal(reserve({...b,date:'2026-09-01'},'2026-09-11'),150.62);});
test('monthly dates clamp and week follows payday',()=>{assert.equal(nextMonth('2027-01-31'),'2027-02-28');assert.equal(weekStart('2026-09-17',5),'2026-09-11');assert.equal(weekStart('2026-09-18',5),'2026-09-18');});

test('fixed tuition reserve caps at remaining goal',()=>{
 const b={...initial.bills[0],amount:1600,saved:0,weeklyReserve:400};
 assert.equal(reserve(b,'2026-09-11'),400);
 assert.equal(reserve({...b,saved:1400},'2026-09-11'),200);
 assert.equal(reserve({...b,saved:1600},'2026-09-11'),0);
});
test('weekly and fortnightly schedules respect start and inclusive week boundaries',()=>{
 const e={id:'test',name:'Food',category:'Food',amount:200,date:'2026-09-11',frequency:'weekly' as const};
 assert.deepEqual(expenseOccurrences(e,'2026-09-18','2026-09-24').map(x=>x.date),['2026-09-18']);
 assert.equal(expenseOccurrences(e,'2026-09-01','2026-09-10').length,0);
 assert.equal(expenseOccurrences({...e,frequency:'biweekly'},'2026-09-18','2026-09-24').length,0);
 assert.equal(expenseOccurrences({...e,frequency:'biweekly'},'2026-09-25','2026-10-01').length,1);
 assert.equal(expenseOccurrences({...e,frequency:undefined},'2026-09-18','2026-09-24').length,0);
});
test('monthly recurrence returns to the original day after February',()=>{
 const e={id:'test',name:'Rent',category:'Housing',amount:100,date:'2027-01-31',frequency:'monthly' as const};
 assert.deepEqual(expenseOccurrences(e,'2027-01-01','2027-03-31').map(x=>x.date),['2027-01-31','2027-02-28','2027-03-31']);
});
test('commitment migration keeps data and is idempotent even after deletion',()=>{
 const data=applyCommitments(initial,'2026-09-12');
 assert.equal(data.expenses.length,2);
 assert.equal(data.expenses.reduce((s,e)=>s+expenseOccurrences(e,'2026-09-11','2026-09-17').reduce((n,x)=>n+x.amount,0),0),300);
 assert.equal(data.bills.find(b=>b.id==='bill5')?.amount,1600);
 assert.equal(data.bills.length,initial.bills.length);
 assert.deepEqual(applyCommitments(data,'2026-10-01'),data);
 const deleted={...data,expenses:[]};assert.deepEqual(applyCommitments(deleted,'2026-10-01'),deleted);
});


test('cloud import validation rejects malformed recurrence and salary data',async()=>{
 const {validData}=await import('./validation');
 const migrated=applyCommitments(initial,'2026-09-12');
 assert.equal(validData(migrated),true);
 assert.equal(validData({...migrated,salary:{...migrated.salary,tax:999999}}),false);
 assert.equal(validData({...migrated,expenses:[{...migrated.expenses[0],frequency:'daily'}]}),false);
 assert.equal(validData({...migrated,bills:[{...migrated.bills[0],weeklyReserve:-1}]}),false);
 assert.equal(validData({commitmentsVersion:1,salary:{gross:0,tax:0,deductions:0,payday:5},bills:[],expenses:[],pay:[]}),true);
});


test('payment recurrence advances by 7 or 14 days and preserves legacy monthly bills',async()=>{
 const {advanceBill,billFrequency}=await import('./budget');
 const b={...initial.bills[0],date:'2026-12-25',saved:100};
 assert.equal(advanceBill({...b,frequency:'weekly'}).date,'2027-01-01');
 assert.equal(advanceBill({...b,frequency:'biweekly'}).date,'2027-01-08');
 assert.equal(advanceBill({...b,frequency:'biweekly'}).saved,0);
 assert.equal(billFrequency({...b,monthly:true}),'monthly');
 assert.equal(billFrequency({...b,monthly:true,frequency:'once'}),'once');
 assert.equal(advanceBill({...b,monthly:true,date:'2027-01-31'}).date,'2027-02-28');
 const {validData}=await import('./validation');
 assert.equal(validData({...initial,bills:[{...b,frequency:'weekly'}]}),true);
 assert.equal(validData({...initial,bills:[{...b,frequency:'daily'}]}),false);
});


test('bounded monthly and fortnightly payments stop inclusively',async()=>{
 const {billOccurrences}=await import('./budget');
 const b={...initial.bills[0],date:'2027-01-31',frequency:'monthly' as const,endDate:'2027-06-30'};
 assert.deepEqual(billOccurrences(b,'2027-01-01','2027-12-31').map(x=>x.date),['2027-01-31','2027-02-28','2027-03-31','2027-04-30','2027-05-31','2027-06-30']);
 assert.equal(billOccurrences({...b,frequency:'biweekly',date:'2026-09-11',endDate:'2026-11-06'},'2026-09-01','2026-12-31').length,5);
 assert.equal(expenseOccurrences({id:'gas',name:'Gas',date:'2026-09-12',category:'Transport',amount:45,frequency:'once',endDate:'2026-12-31'},'2026-09-01','2026-12-31').length,1);
});
test('Friday cycles exclude the following Friday and custom cycles stay contiguous',async()=>{
 const {periodFor}=await import('./budget');
 assert.deepEqual(periodFor(initial,'2026-09-17'),{start:'2026-09-11',end:'2026-09-17'});
 assert.deepEqual(periodFor(initial,'2026-09-18'),{start:'2026-09-18',end:'2026-09-24'});
 const data={...initial,cash:{openingBalance:100,openingDate:'2026-09-11',periodStart:'2026-09-11',periodEnd:'2026-09-24'}};
 assert.deepEqual(periodFor(data,'2026-09-18',1),{start:'2026-09-25',end:'2026-10-08'});
});
test('starting money and gas carry forward without charging next Friday early',async()=>{
 const {periodSummary,balanceAt}=await import('./budget');
 const data={...initial,salary:{gross:1000,tax:0,deductions:0,payday:5},pay:[],bills:[{...initial.bills[0],amount:200,date:'2026-09-18',frequency:'once' as const}],expenses:[{id:'gas',name:'Gas',category:'Transport',amount:50,date:'2026-09-12'}],cash:{openingBalance:100,openingDate:'2026-09-11',periodStart:'2026-09-11',periodEnd:'2026-09-17'}};
 const first=periodSummary(data,'2026-09-11','2026-09-17');
 assert.equal(first.bills,0);assert.equal(first.closing,1050);
 const second=periodSummary(data,'2026-09-18','2026-09-24');
 assert.equal(second.opening,1050);assert.equal(second.closing,1850);
 assert.equal(balanceAt(data,'2026-09-12',false),50);
 assert.equal(balanceAt(data,'2026-09-10',false),null);
 assert.equal(periodSummary(data,'2026-09-04','2026-09-10').closing,0);
});
test('recorded paycheck replaces estimate and paid bill is charged once with retained history',async()=>{
 const {periodSummary,balanceAt,recordPayment,nextUnpaidBill}=await import('./budget');
 const b={...initial.bills[0],amount:200,date:'2026-09-11',frequency:'weekly' as const,endDate:'2026-09-18'};
 const base={...initial,salary:{gross:1000,tax:0,deductions:0,payday:5},pay:[{id:'pay',date:'2026-09-11',gross:900,tax:0,deductions:0}],bills:[b],expenses:[],cash:{openingBalance:100,openingDate:'2026-09-11',periodStart:'2026-09-11',periodEnd:'2026-09-17'}};
 const paid=recordPayment(base,b,'2026-09-12','paid');
 assert.equal(periodSummary(paid,'2026-09-11','2026-09-17').closing,800);
 assert.equal(balanceAt(paid,'2026-09-12',false),800);
 assert.throws(()=>recordPayment(paid,b,'2026-09-12','duplicate'));
 assert.equal(nextUnpaidBill(paid,b)?.date,'2026-09-18');
 const complete=recordPayment(paid,{...b,date:'2026-09-18'},'2026-09-18','second');
 assert.equal(nextUnpaidBill(complete,b),null);
 assert.equal(balanceAt({...paid,bills:[]},'2026-09-12',false),800);
});
test('cash and schedule validation preserves old backups and rejects reversed dates',async()=>{
 const {validData}=await import('./validation');assert.equal(validData(initial),true);
 assert.equal(validData({...initial,cash:{openingBalance:50,openingDate:'2026-09-11',periodStart:'2026-09-18',periodEnd:'2026-09-11'}}),false);
 assert.equal(validData({...initial,bills:[{...initial.bills[0],date:'2026-09-18',endDate:'2026-09-11'}]}),false);
});
