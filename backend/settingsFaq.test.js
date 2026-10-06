const test = require("node:test"); const assert = require("node:assert/strict");
const { createSettingsService } = require("./services/settingsService");

// Repository tiruan: menyimpan perubahan settings di memori.
const fakeRepository = () => { let settings = { faqEntries: null }; const tx = { settings: { update: async (changes) => (settings = { ...settings, ...changes }) }, audits: { append: async () => null } }; return { settings: { get: async () => settings }, transaction: (work) => work(tx) }; };
const admin = { id: "admin" };
const entry = { id: "custom-wifi", roles: ["visitor", "customer"], keywords: ["WiFi", "wifi", "internet"], q: { id: "Apakah ada wifi di desa?", en: "Is there wifi in the village?" }, a: { id: ["Ada, di balai desa."], en: ["Yes, at the village hall."] }, link: null };

test("admin FAQ entries are sanitized, stored, and readable publicly", async () => {
  const service = createSettingsService(fakeRepository());
  await service.update({ faqEntries: [entry, { id: "cancel-order", builtin: true, hidden: true }] }, admin);
  const rows = await service.faq();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].keywords, ["wifi", "internet"]);
  assert.equal(rows[1].hidden, true);
});

test("admin FAQ entries reject missing translations, bad roles, and external links", async () => {
  const service = createSettingsService(fakeRepository());
  await assert.rejects(service.update({ faqEntries: [{ ...entry, q: { id: "Ada wifi?" } }] }, admin), (error) => error.code === "VALIDATION_ERROR");
  await assert.rejects(service.update({ faqEntries: [{ ...entry, roles: ["hacker"] }] }, admin), (error) => error.code === "VALIDATION_ERROR");
  await assert.rejects(service.update({ faqEntries: [{ ...entry, link: { to: "https://evil.example", label: { id: "x", en: "x" } } }] }, admin), (error) => error.code === "VALIDATION_ERROR");
  await assert.rejects(service.update({ faqEntries: [entry, entry] }, admin), (error) => error.code === "VALIDATION_ERROR");
});

test("admin analytics reports keep only known metrics, groups, and views", async () => {
  const service = createSettingsService(fakeRepository());
  const report = { id: "kopi-bulanan", name: "Penjualan kopi", widgets: [{ id: "w1", title: "Pendapatan", metric: "revenue", group: "month", view: "line", size: "full", filters: { categories: ["Minuman"] } }] };
  const saved = await service.update({ analyticsReports: [report] }, admin);
  assert.equal(saved.analyticsReports[0].widgets[0].filters.categories[0], "Minuman");
  await assert.rejects(service.update({ analyticsReports: [{ ...report, widgets: [{ ...report.widgets[0], metric: "dropTables" }] }] }, admin), (error) => error.code === "VALIDATION_ERROR");
  await assert.rejects(service.update({ analyticsReports: [{ ...report, widgets: [] }] }, admin), (error) => error.code === "VALIDATION_ERROR");
});
