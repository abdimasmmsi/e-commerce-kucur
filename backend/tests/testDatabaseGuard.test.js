const test = require("node:test");
const assert = require("node:assert/strict");
const { assertDedicatedTestDatabase } = require("./helpers/testDatabaseGuard");

test("test database guard accepts only explicit MySQL _test database", () => {
  assert.equal(assertDedicatedTestDatabase("mysql://user:secret@localhost:3307/kucur_test").databaseName, "kucur_test");
  for (const unsafe of ["mysql://user:secret@localhost:3307/kucur", "mysql://user:secret@localhost:3307/production", "postgresql://user:secret@localhost:5432/kucur_test", "not-a-url"]) {
    assert.throws(() => assertDedicatedTestDatabase(unsafe));
  }
});
