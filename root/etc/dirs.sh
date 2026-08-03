#!/usr/bin/env bash

if [[ "$(id -u)" != "0" ]]; then
    echo "This script must be run as root." 1>&2
    exit 1
fi

mkdir -p /etc/keylearn

chown -R root:root /etc/keylearn

mkdir -p /var/lib/keylearn
mkdir -p /var/lib/keylearn/backups
mkdir -p /var/lib/keylearn/sessions
mkdir -p /var/lib/keylearn/user_settings
mkdir -p /var/lib/keylearn/user_stats

chown -R www-data:www-data /var/lib/keylearn
chmod -R u=rwX,g=rX,o=rX /var/lib/keylearn
