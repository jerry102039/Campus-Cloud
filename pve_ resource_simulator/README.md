# PVE Resource Simulator

Standalone FastAPI prototype for testing PVE-style resource scheduling.

## Features

- Define any number of servers with CPU, RAM, Disk, and GPU capacity.
- Seed each server with existing used resources.
- Add multiple VM templates with no fixed placement limit.
- Auto-place workloads until no enabled VM template fits anywhere.
- Pick the destination server using the minimum dominant-share rule.
- Visualize every placement step through a static UI.

## Run

```bash
cd "pve_ resource_simulator"
pip install -r requirements.txt
python main.py
```

Open `http://127.0.0.1:8012`.

Allocation logic notes:

```bash
pve_ resource_simulator/docs/allocation-logic.md
```

Monthly analytics page:

```bash
http://127.0.0.1:8012/monthly-analytics
```

This project also includes `pve_ resource_simulator/.env.example`, and the local
`pve_ resource_simulator/.env` can use the same `PROXMOX_*` naming as the backend.

Optional Proxmox settings for the analytics page:

```bash
PROXMOX_HOST=192.168.100.2
PROXMOX_USER=ccapiuser@pve
PROXMOX_PASSWORD=your-password
PROXMOX_VERIFY_SSL=false
PROXMOX_API_TIMEOUT=20
PROXMOX_ISO_STORAGE=ISO
PROXMOX_DATA_STORAGE=data-ssd-2
PVE_ANALYTICS_TIMEZONE=Asia/Taipei
```

The analytics page reads these values from process env, the repo root `.env`, or
`pve_ resource_simulator/.env`.

## Test

```bash
cd "pve_ resource_simulator"
pytest
```
