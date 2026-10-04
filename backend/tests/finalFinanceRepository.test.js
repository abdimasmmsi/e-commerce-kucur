const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { getPrisma, disconnectPrisma } = require("../config/prisma");
const { createFinalPrismaRepository } = require("../repositories/finalPrismaRepository");
const { createFinanceService, generateCommerceFinance } = require("../services/financeService");

const prisma = getPrisma(); const ROLLBACK = Symbol("ROLLBACK");
const rollback = async (work) => { try { await prisma.$transaction(async(tx)=>{await work(createFinalPrismaRepository(tx),tx);throw ROLLBACK;},{timeout:30000}); } catch(error){if(error!==ROLLBACK)throw error;} };
async function fixture(tx) {
  const merchantId=randomUUID(),customerId=randomUUID(),adminId=randomUUID(),storeId=randomUUID();
  await tx.targetUser.createMany({data:[{id:merchantId,email:`${merchantId}@qa.invalid`,passwordHash:"x",fullName:"Merchant",phone:"081"},{id:customerId,email:`${customerId}@qa.invalid`,passwordHash:"x",fullName:"Customer",phone:"082"},{id:adminId,email:`${adminId}@qa.invalid`,passwordHash:"x",fullName:"Admin",phone:"083"}]});
  await tx.targetUserRole.createMany({data:[{userId:merchantId,role:"MERCHANT"},{userId:customerId,role:"CUSTOMER"},{userId:adminId,role:"ADMIN"}]});
  await tx.targetStore.create({data:{id:storeId,merchantUserId:merchantId,name:"Finance Disposable",status:"ACTIVE"}});
  await tx.targetPlatformSettings.upsert({where:{id:"qa-final-finance"},update:{},create:{id:"qa-final-finance",initialStoreFeeAmount:100000,installmentLateInterestPercent:2,adminFeeType:"PERCENTAGE",adminFeeValue:5,adminFeeCutoffDay:1}});
  return {merchant:{id:merchantId,roles:["merchant"]},customerId,admin:{id:adminId,roles:["admin"]},storeId};
}

test("MerchantFee-native initial fee, installments and late penalty preserve finance contract",()=>rollback(async(repo,tx)=>{
  const f=await fixture(tx); repo.settings.get=async()=>({initialStoreFeeAmount:100000,installmentLateInterestPercent:2,installmentFullEnabled:true,installment3MonthsEnabled:true,installment6MonthsEnabled:true});
  const service=createFinanceService(repo); const created=await service.setupInitialFee(f.storeId,{planType:"THREE_MONTHS"},f.merchant);
  assert.equal(created.installments.length,3); assert.equal(created.installments.reduce((s,x)=>s+Number(x.principalAmount),0),100000);
  await tx.targetMerchantFee.update({where:{id:created.installments[0].id},data:{dueAt:new Date(Date.now()-15*86400000)}});
  const reconciliation=await service.reconcileInstallments(new Date(),f.admin); assert.ok(reconciliation.penaltiesCreated>=2);
  const current=await repo.finance.findInstallment(created.installments[0].id); assert.equal(current.status,"OVERDUE"); assert.ok(current.penaltyOutstanding>0);
}));

test("MerchantFee PaymentAttempt retains failed/expired attempts and succeeds on retry",()=>rollback(async(repo,tx)=>{
  const f=await fixture(tx); const fee=await tx.targetMerchantFee.create({data:{id:randomUUID(),merchantUserId:f.merchant.id,storeId:f.storeId,feeType:"ADMIN_FEE",amount:5000,status:"OUTSTANDING"}});
  const failed=await repo.finance.createPaymentAttempt({merchantFeeId:fee.id,provider:"MANUAL",paymentMethod:"MANUAL",amount:5000,status:"FAILED"});
  const expired=await repo.finance.createPaymentAttempt({merchantFeeId:fee.id,provider:"MANUAL",paymentMethod:"MANUAL",amount:5000,status:"EXPIRED",expiresAt:new Date()});
  const paid=await repo.finance.createPaymentAttempt({merchantFeeId:fee.id,provider:"MANUAL",paymentMethod:"MANUAL",amount:5000,status:"PAID",paidAt:new Date()});
  assert.deepEqual((await tx.targetPaymentAttempt.findMany({where:{merchantFeeId:fee.id},orderBy:{createdAt:"asc"}})).map(x=>x.status),[failed.paymentStatus,expired.paymentStatus,paid.paymentStatus]);
  assert.equal(await tx.targetPaymentAttempt.count({where:{merchantFeeId:fee.id}}),3);
}));

test("Commerce completion creates one AdminFee and grouped settlement completes MerchantFee",()=>rollback(async(repo,tx)=>{
  const f=await fixture(tx); repo.settings.get=async()=>({taxPercent:0,adminFeeType:"percentage",adminFeeValue:5,adminFeeCutoffDay:1,adminFeeGraceTime:"12:00"});
  const order=await tx.targetCommerceOrder.create({data:{id:randomUUID(),checkoutGroupId:randomUUID(),checkoutIdempotencyKey:randomUUID(),storeId:f.storeId,customerUserId:f.customerId,orderCode:`QA-${randomUUID()}`,fulfillmentStatus:"COMPLETED",paymentStatus:"PAID",subtotal:100000,grandTotal:100000,recipientName:"QA",recipientPhone:"081",deliveryAddress:"QA",completedAt:new Date()}});
  const logical={id:order.id,storeId:f.storeId,customerUserId:f.customerId,productTotal:100000,totalAmount:100000,paymentStatus:"paid"};
  await generateCommerceFinance(repo,logical,new Date()); await generateCommerceFinance(repo,logical,new Date());
  const fees=await repo.finance.listAdminFees(f.storeId); assert.equal(fees.length,1); assert.equal(fees[0].feeAmount,5000);
  const service=createFinanceService(repo); const settlement=await service.createSettlement(f.storeId,{obligationIds:[fees[0].id],amount:5000},f.merchant);
  assert.equal(settlement.paymentStatus,"PENDING"); const confirmed=await service.confirmPayment("settlement",settlement.id,f.admin,true);
  assert.equal(confirmed.paymentStatus,"PAID"); assert.equal((await repo.finance.listAdminFees(f.storeId))[0].status,"PAID");
}));

test("MerchantFee voluntary contribution remains standalone and confirmable",()=>rollback(async(repo,tx)=>{
  const f=await fixture(tx); repo.settings.get=async()=>({voluntaryContributionEnabled:true}); const service=createFinanceService(repo);
  const row=await service.createContribution({amount:2500},f.merchant); assert.equal(row.paymentStatus,"PENDING");
  const paid=await service.confirmPayment("contribution",row.id,f.admin,true); assert.equal(paid.paymentStatus,"PAID");
  assert.equal(await tx.targetMerchantFee.count({where:{id:row.id,feeType:"VOLUNTARY_CONTRIBUTION"}}),1);
}));

test.after(disconnectPrisma);
