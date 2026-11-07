#!/usr/bin/env bash
# On-server shortcut → same as deploy remote phase
set -euo pipefail
exec bash /var/www/topovik/deploy/remote-up.sh
