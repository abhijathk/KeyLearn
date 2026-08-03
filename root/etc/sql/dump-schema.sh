#!/usr/bin/env bash

mysqldump -u keylearn \
    --verbose \
    --no-data \
    keylearn | sed 's/ AUTO_INCREMENT=[0-9]*//g' > "$(dirname $0)/create-schema.sql"
