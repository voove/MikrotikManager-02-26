"""
RouterOS script library.
Each script returns a command string to execute via SSH.
Output is parsed by the corresponding parser function.
"""
from typing import Optional


SCRIPTS = {
    "sim_info": {
        "label": "SIM Card Info",
        "description": "Read SIM card details, ICCID, operator, and data usage",
        "icon": "sim-card",
        "command": (
            ":local iface [/interface lte find];\n"
            ":foreach i in=$iface do={\n"
            "  :local info [/interface lte monitor $i once as-value];\n"
            "  :put (\"iface=\" . [/interface get $i name]);\n"
            "  :put (\"operator=\" . ($info->\"operator\"));\n"
            "  :put (\"band=\" . ($info->\"current-operator-band\"));\n"
            "  :put (\"rssi=\" . ($info->\"rssi\"));\n"
            "  :put (\"rsrp=\" . ($info->\"rsrp\"));\n"
            "  :put (\"rsrq=\" . ($info->\"rsrq\"));\n"
            "  :put (\"sinr=\" . ($info->\"sinr\"));\n"
            "  :put (\"status=\" . ($info->\"status\"));\n"
            "  :local sim [/interface lte apn export verbose];\n"
            "};\n"
            "/interface lte info [/interface lte find] once;"
        ),
    },
    "signal_strength": {
        "label": "Signal Strength",
        "description": "LTE signal metrics: RSSI, RSRP, RSRQ, SINR and band info",
        "icon": "signal",
        "command": (
            ":foreach i in=[/interface lte find] do={\n"
            "  :local n [/interface get $i name];\n"
            "  :local m [/interface lte monitor $i once as-value];\n"
            "  :put (\"iface=\" . $n);\n"
            "  :put (\"rssi=\" . ($m->\"rssi\"));\n"
            "  :put (\"rsrp=\" . ($m->\"rsrp\"));\n"
            "  :put (\"rsrq=\" . ($m->\"rsrq\"));\n"
            "  :put (\"sinr=\" . ($m->\"sinr\"));\n"
            "  :put (\"band=\" . ($m->\"current-operator-band\"));\n"
            "  :put (\"operator=\" . ($m->\"operator\"));\n"
            "  :put (\"pin-status=\" . ($m->\"pin-status\"));\n"
            "  :put (\"session-uptime=\" . ($m->\"session-uptime\"));\n"
            "};"
        ),
    },
    "reboot": {
        "label": "Reboot Router",
        "description": "Gracefully reboot the router",
        "icon": "power",
        "dangerous": True,
        "confirm_message": "Are you sure you want to reboot this router? It will be offline for 60-90 seconds.",
        "command": "/system reboot",
    },
    "system_info": {
        "label": "System Info",
        "description": "CPU, memory, uptime and RouterOS version",
        "icon": "cpu",
        "command": (
            ":local res [/system resource get];\n"
            ":put (\"uptime=\" . [/system resource get uptime]);\n"
            ":put (\"version=\" . [/system package get [find name=routeros] version]);\n"
            ":put (\"cpu-load=\" . [/system resource get cpu-load]);\n"
            ":put (\"free-memory=\" . [/system resource get free-memory]);\n"
            ":put (\"total-memory=\" . [/system resource get total-memory]);\n"
            ":put (\"board-name=\" . [/system resource get board-name]);\n"
            ":put (\"model=\" . [/system routerboard get model]);\n"
            ":put (\"serial=\" . [/system routerboard get serial-number]);"
        ),
    },
    "interfaces": {
        "label": "Interface Status",
        "description": "Status of all network interfaces",
        "icon": "network",
        "command": "/interface print detail without-paging",
    },
    "ip_addresses": {
        "label": "IP Addresses",
        "description": "All configured IP addresses",
        "icon": "globe",
        "command": "/ip address print without-paging",
    },
    "firewall_log": {
        "label": "Recent Logs",
        "description": "Last 50 log entries",
        "icon": "scroll",
        "command": "/log print count-only=50 without-paging",
    },
}


def get_script(name: str) -> Optional[dict]:
    return SCRIPTS.get(name)


def list_scripts() -> list[dict]:
    return [{"name": k, **v} for k, v in SCRIPTS.items()]


def parse_kv_output(output: str) -> dict:
    """Parse RouterOS key=value output into a dict."""
    result = {}
    for line in output.strip().splitlines():
        line = line.strip()
        if "=" in line:
            key, _, value = line.partition("=")
            result[key.strip()] = value.strip()
    return result
