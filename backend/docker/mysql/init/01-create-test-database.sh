#!/bin/sh
set -eu

test_database="${KUCUR_TEST_DATABASE:-kucur_test}"
case "$test_database" in
  *[!A-Za-z0-9_]*) echo "Refusing unsafe test database identifier: $test_database" >&2; exit 1 ;;
  *_test) ;;
  *) echo "Refusing to create unsafe test database name: $test_database" >&2; exit 1 ;;
esac

mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" <<-SQL
  CREATE DATABASE IF NOT EXISTS \`$test_database\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  GRANT ALL PRIVILEGES ON \`$test_database\`.* TO '$MYSQL_USER'@'%';
  CREATE DATABASE IF NOT EXISTS \`kucur_demo\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  GRANT ALL PRIVILEGES ON \`kucur_demo\`.* TO '$MYSQL_USER'@'%';
  FLUSH PRIVILEGES;
SQL
