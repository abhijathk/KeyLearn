#!/usr/bin/env bash

find /var/lib/keylearn/sessions -type f -mtime +14 -exec rm {} \;
