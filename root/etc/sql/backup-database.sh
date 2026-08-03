#!/usr/bin/env bash

# To restore the database:
# $ cat dumpfilename.sql | mysql -u root keylearn
# or
# $ bzcat dumpfilename.sql.bz2 | mysql -u root keylearn

mysqldump -u root keylearn | bzip2 -c > /var/lib/keylearn/backups/database.sql.bz2
