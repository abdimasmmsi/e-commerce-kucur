const { createFinanceService } = require("./financeService");
const { runWithReadContext } = require("../repositories/repositoryReadContext");

// Job ringan tiap jam (dan sekali saat server menyala): jalankan dua rekonsiliasi keuangan yang sama dengan tombol Admin.
// 1) Cicilan iuran pokok: tandai lewat jatuh tempo + tambahkan denda per 7 hari (idempoten, denda per periode sekali).
// 2) Biaya admin: tangguhkan lapak aktif yang biaya adminnya lewat cutoff, aktifkan lagi lapak yang sudah lunas (idempoten).
// Gagal hanya dicatat dengan console.warn; job tidak pernah melempar error.
function startFinanceReconcileJob(repository, { intervalMs = 60 * 60 * 1000, financeService = createFinanceService(repository) } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      // Path API dipakai supaya transaksi diarahkan ke repository final seperti request Admin biasa.
      await runWithReadContext("/api/admin/finance/reconcile-installments", () => financeService.reconcileInstallments(new Date(), null));
    } catch (error) { console.warn(`[finance-reconcile-job] cicilan: ${error.message}`); }
    try {
      await runWithReadContext("/api/admin/finance/reconcile-admin-fees", () => financeService.reconcileAdminFees(new Date(), null));
    } catch (error) { console.warn(`[finance-reconcile-job] biaya admin: ${error.message}`); }
    finally { running = false; }
  };
  const timer = setInterval(() => { void tick(); }, intervalMs);
  timer.unref?.();
  void tick();
  return () => clearInterval(timer);
}

module.exports = { startFinanceReconcileJob };
