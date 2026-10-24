# Lenovo Wazuh single-node setup

**Status:** Not deployed. This runbook is for the Lenovo lab host. Do not run it on the Mac development machine.

**Version pin:** official `wazuh/wazuh-docker` tag `v4.14.9`. Images are `wazuh/wazuh-manager:4.14.9`, `wazuh/wazuh-indexer:4.14.9`, and `wazuh/wazuh-dashboard:4.14.9`. Do not use the repository `main` branch. That branch tracks a later major line.

**Authority:** [Wazuh Docker deployment](https://documentation.wazuh.com/current/deployment-options/docker/wazuh-container.html) and [Linux agent packages](https://documentation.wazuh.com/current/installation-guide/wazuh-agent/wazuh-agent-package-linux.html).

AegisBridge stays disconnected until this stack is healthy and a later, explicit LAN or lab-bridge decision is made. Leave `WAZUH_ENABLED=false` on the Mac.

## Architecture choice

Use the official single-node container stack, not native manager packages and not a multi-node cluster.

```text
Lenovo
├── Wazuh manager   wazuh/wazuh-manager:4.14.9
├── Wazuh indexer   wazuh/wazuh-indexer:4.14.9
├── Wazuh dashboard wazuh/wazuh-dashboard:4.14.9
└── one host agent  official wazuh-agent 4.14.9 package
```

The containerized Wazuh agent image cannot see the host. The one agent is the official package on the Lenovo itself, talking to the manager at `127.0.0.1`. Suricata, Kali, Windows, and Sysmon are out of scope.

Lab files live in `~/aegis-lab/wazuh/`, outside the AegisBridge git repository. Do not copy certificates, `docker-compose.yml`, or password files into the application repo. The upstream compose file contains vendor default passwords. After any local edit, treat that copy as a secret.

## Resource budget

This is a portfolio lab. The pinned compose already sets the indexer heap to 1 GB (`-Xms1g -Xmx1g`). Leave that value. Do not raise it on a 16 GB machine.

| Check | Stop if |
|---|---|
| Host RAM | Under 8 GB available before start |
| Free disk | Under 50 GB |
| CPU | Under 4 logical cores |

Expect about 4–6 GB resident memory for the three containers once they are idle, plus about 1 GB for the heap inside that total. On a 16 GB Lenovo, do not also run Windows, Linux, and Kali VMs. On 32 GB, those VMs can wait until this stack is stable. Do not launch them in this slice.

## 1. Host review

Run this on the Lenovo and keep the output in the lab notes. Do not paste private addresses into AegisBridge docs.

```bash
uname -srm
. /etc/os-release && printf '%s %s\n' "$NAME" "$VERSION"
nproc
free -h
df -h /
lscpu | awk '/Virtualization|Model name|Architecture/ {print}'
docker --version
docker compose version
systemctl is-active docker || true
ip -br addr
ss -lntup
sudo ufw status || sudo firewall-cmd --state || true
sysctl vm.max_map_count
```

Checkpoint: Linux, x86_64 or arm64, at least 4 cores, at least 8 GB RAM, at least 50 GB free, Docker Engine and the Compose plugin installed. If Docker is missing, install Docker Engine from Docker's own documentation, then return to this runbook. Do not install Wazuh on the Mac to substitute.

## 2. Indexer kernel limit

The indexer needs `vm.max_map_count` of at least `262144`.

```bash
sudo sysctl -w vm.max_map_count=262144
echo "vm.max_map_count=262144" | sudo tee /etc/sysctl.d/99-wazuh-max-map-count.conf
sudo sysctl --system
sysctl vm.max_map_count
```

Checkpoint: the printed value is `262144` or higher.

## 3. Official stack

```bash
mkdir -p "$HOME/aegis-lab"
git clone https://github.com/wazuh/wazuh-docker.git -b v4.14.9 "$HOME/aegis-lab/wazuh"
cd "$HOME/aegis-lab/wazuh"
git rev-parse --short HEAD
git describe --tags --exact-match
cd single-node
docker compose -f generate-indexer-certs.yml run --rm generator
test -f config/wazuh_indexer_ssl_certs/root-ca.pem
```

Checkpoint: `git describe` prints `v4.14.9`. `root-ca.pem` exists. Certificates stay in this directory.

Before the first start, edit only the local `single-node/docker-compose.yml`:

- Set every service `restart:` value to `"no"`. Upstream uses `always`, which would start the stack on boot. This lab starts manually.
- Bind published ports to loopback:

```yaml
# manager
- "127.0.0.1:1514:1514"
- "127.0.0.1:1515:1515"
- "127.0.0.1:514:514/udp"
- "127.0.0.1:55000:55000"
# indexer
- "127.0.0.1:9200:9200"
# dashboard
- "127.0.0.1:443:5601"
```

Do not publish `0.0.0.0`. Do not add router port forwards, tunnels, or a public proxy. Do not change the host firewall for this loopback binding.

Change the vendor default passwords with the official Wazuh procedure before any future bind that is not `127.0.0.1`. Until then, loopback is the only listener. Do not record the new passwords in this repository.

## 4. Start and health

```bash
cd "$HOME/aegis-lab/wazuh/single-node"
docker compose up -d
docker compose ps
```

Wait until the indexer is healthy. The dashboard logs may say it cannot reach port 9200 for about a minute. That message should stop.

```bash
docker compose ps --format '{{.Name}} {{.Status}}'
docker compose logs --tail=40 wazuh.indexer
docker compose logs --tail=40 wazuh.manager
docker compose logs --tail=40 wazuh.dashboard
ss -lntup | awk 'NR==1 || /127.0.0.1:(443|1514|1515|55000|9200)|127.0.0.1:514/'
```

Checkpoint: three containers are running and not restarting. Listeners for 443, 1514, 1515, 514/udp, 55000, and 9200 are on `127.0.0.1` only. Stop if any listener is on `0.0.0.0` or a LAN address.

Indexer search, using the local CA so TLS stays verified:

```bash
cd "$HOME/aegis-lab/wazuh/single-node"
read -r WAZUH_INDEXER_USER
read -rs WAZUH_INDEXER_PASSWORD
echo
curl --fail --silent --show-error \
  --cacert config/wazuh_indexer_ssl_certs/root-ca.pem \
  --user "${WAZUH_INDEXER_USER}:${WAZUH_INDEXER_PASSWORD}" \
  "https://127.0.0.1:9200/_cluster/health?pretty"
curl --fail --silent --show-error \
  --cacert config/wazuh_indexer_ssl_certs/root-ca.pem \
  --user "${WAZUH_INDEXER_USER}:${WAZUH_INDEXER_PASSWORD}" \
  "https://127.0.0.1:9200/wazuh-alerts*/_count"
unset WAZUH_INDEXER_PASSWORD
```

Checkpoint: cluster health HTTP 200 and status `green` or `yellow`. The alert count request returns HTTP 200. A missing index before the first alert is acceptable; a TLS or authentication failure is not. Do not add `--insecure`.

Dashboard: open `https://127.0.0.1` on the Lenovo. Import `root-ca.pem` into the browser trust store if you want to remove the warning. A warning with a working login still means TLS is on. Confirm the manager module loads and there is no crash loop. Do not customize the dashboard.

Unset the password variable when finished. Do not put it in shell history files or the AegisBridge `.env`.

## 5. One host agent

Install the official 4.14.9 agent package. Do not install the Docker agent image.

Debian or Ubuntu:

```bash
sudo apt-get install -y gnupg apt-transport-https curl
curl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH \
  | sudo gpg --no-default-keyring --keyring gnupg-ring:/usr/share/keyrings/wazuh.gpg --import
sudo chmod 644 /usr/share/keyrings/wazuh.gpg
echo "deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main" \
  | sudo tee /etc/apt/sources.list.d/wazuh.list
sudo apt-get update
apt-cache madison wazuh-agent | awk '{print $3}' | grep '^4.14.9-'
sudo WAZUH_MANAGER='127.0.0.1' WAZUH_AGENT_NAME='lenovo-host' \
  apt-get install -y wazuh-agent
sudo apt-mark hold wazuh-agent
```

RHEL-compatible 9 or newer: import `https://packages.wazuh.com/key/GPG-KEY-WAZUH`, add the official `4.x` yum repository from the Linux agent guide, then:

```bash
sudo WAZUH_MANAGER='127.0.0.1' WAZUH_AGENT_NAME='lenovo-host' \
  dnf install -y wazuh-agent-4.14.9
sudo sed -i 's/^enabled=1/enabled=0/' /etc/yum.repos.d/wazuh.repo
```

Stop if the package list has no `4.14.9` build. Do not install a newer 4.x package to get past that check.

Start the agent for this session only. Do not enable it at boot:

```bash
sudo systemctl daemon-reload
sudo systemctl start wazuh-agent
sudo systemctl is-enabled wazuh-agent || true
```

Checkpoint: `is-enabled` is `disabled`. Enrollment uses the manager on `127.0.0.1:1515`. Confirm one enrolled agent:

```bash
cd "$HOME/aegis-lab/wazuh/single-node"
docker compose exec wazuh.manager /var/ossec/bin/agent_control -l
```

Checkpoint: agent id `001`, name `lenovo-host`, status active or connected. The dashboard Agents page shows the same single agent. Do not copy the enrollment key into the application repo.

## 6. One harmless alert

Do not install malware, scan public hosts, or change account privileges. If `sudo` requires a password, this records one denied non-interactive attempt and does not grant a shell:

```bash
sudo -k
sudo -n true || true
```

Wait up to two minutes, then request one alert with only the fields AegisBridge stores:

```bash
cd "$HOME/aegis-lab/wazuh/single-node"
read -r WAZUH_INDEXER_USER
read -rs WAZUH_INDEXER_PASSWORD
echo
curl --fail --silent --show-error \
  --cacert config/wazuh_indexer_ssl_certs/root-ca.pem \
  --user "${WAZUH_INDEXER_USER}:${WAZUH_INDEXER_PASSWORD}" \
  -H 'Content-Type: application/json' \
  "https://127.0.0.1:9200/wazuh-alerts*/_search" \
  -d '{"size":1,"sort":[{"timestamp":"desc"}],"_source":["id","timestamp","rule.id","rule.level","rule.description","rule.groups","rule.mitre.id","rule.mitre.tactic","agent.id","agent.name","manager.name","decoder.name","data.srcip","data.dstip","data.srcuser","data.dstuser"]}'
unset WAZUH_INDEXER_PASSWORD
```

Checkpoint: HTTP 200, one hit, and `_source.id` is a non-empty string. AegisBridge deduplicates on that field. Also record whether `timestamp`, `rule.id`, `rule.level`, `agent.id`, and `agent.name` are present. `rule.mitre.id` may be absent on this authentication event. That does not fail ingestion. Do not print `full_log` or event XML.

If `_source.id` is missing, stop. Write down the actual JSON paths. Do not change the AegisBridge parser until that shape is known.

## 7. Persistence and one restart

Volumes `wazuh-indexer-data`, `wazuh_etc`, and `wazuh_queue` hold indexer data and manager state. Certificates stay in `config/wazuh_indexer_ssl_certs/`.

```bash
cd "$HOME/aegis-lab/wazuh/single-node"
docker compose down
docker compose up -d
docker compose ps
sudo systemctl start wazuh-agent
```

`docker compose down` without `-v` keeps volumes. Never use `down -v` as a stop command.

Repeat the selected-field search. Checkpoint: the same `_source.id` is still present, the agent returns to active, and the dashboard answers on `https://127.0.0.1`.

## 8. Auto-start

Leave auto-start off. `restart: "no"` and a disabled `wazuh-agent` unit keep the laptop from running the stack after boot. Start and stop by hand.

## 9. Commands

From `~/aegis-lab/wazuh/single-node`:

```bash
docker compose up -d
sudo systemctl start wazuh-agent
docker compose ps
docker compose logs --tail=80 wazuh.indexer
docker compose logs --tail=80 wazuh.manager
docker compose logs --tail=80 wazuh.dashboard
sudo systemctl stop wazuh-agent
docker compose stop
```

`docker compose stop` keeps containers and volumes. Use it when the Lenovo should cool down.

## 10. AegisBridge connection, later

Do not edit the Mac `.env` in this slice.

| Setting | Later value |
|---|---|
| `WAZUH_ENABLED` | `true` only after a reachability decision |
| `WAZUH_INDEXER_URL` | `https://127.0.0.1:9200` on the Lenovo, or a LAN name if that decision is made |
| `WAZUH_USERNAME` | indexer user, server-side only |
| `WAZUH_PASSWORD` | server-side only, never in git |
| `WAZUH_VERIFY_TLS` | `true` |
| `WAZUH_ALERT_INDEX` | `wazuh-alerts*` |

TLS verification for AegisBridge means trusting `config/wazuh_indexer_ssl_certs/root-ca.pem`. `WAZUH_VERIFY_TLS=false` is not the plan.

The Mac cannot use `127.0.0.1` for the Lenovo. A direct LAN connection would require all of the following, and none of them are authorized by this runbook:

- passwords already changed from the vendor defaults
- indexer bound to a LAN address, or an SSH tunnel started from the Mac
- a host firewall rule limited to the Mac source, not a wide subnet
- the Wazuh CA installed for the AegisBridge process

Until that decision, the connector stays disabled. The later production path is still:

```text
Lenovo cyber range --> Wazuh --> outbound-only Lab Bridge --> AegisBridge
```

The hosted application must not accept inbound connections into the lab. The lab bridge is not part of this setup.

## 11. Security checks before calling the slice done

- `ss` shows Wazuh ports on `127.0.0.1` only
- no router forwarding and no tunnel
- host firewall rules were not widened
- certificates and the compose file are only under `~/aegis-lab/wazuh/`
- agent count is one
- the test event is one denied local `sudo -n`
- active response and remote command execution were not enabled
- AegisBridge application code was not changed unless `_source.id` was missing and a follow-up slice says so
