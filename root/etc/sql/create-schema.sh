#!/usr/bin/env bash

mysql -v -u root -D keylearn < "$(dirname $0)/create-schema.sql"
