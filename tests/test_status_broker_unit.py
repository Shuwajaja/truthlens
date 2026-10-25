"""Static inactive unit contract; this does not install or start systemd."""

import configparser
from pathlib import Path


def test_inactive_broker_unit_matches_entrypoint_and_hardening():
    unit = Path(__file__).parents[1] / "deploy/server/truthlens-status-broker.service"
    assert unit.is_file()
    config = configparser.ConfigParser(interpolation=None)
    config.read(unit)
    service = config["Service"]
    assert service["User"] == service["Group"] == "root"
    assert service["ExecStart"] == (
        "/opt/truthlens/venv/bin/python -m truthlens.status_broker "
        "--socket /run/truthlens/status.sock --socket-gid SOCKET_GID --allow-uid AGENT_UID"
    )
    for name, value in {
        "RuntimeDirectory": "truthlens",
        "RuntimeDirectoryMode": "0755",
        "UMask": "0077",
        "NoNewPrivileges": "true",
        "PrivateTmp": "true",
        "ProtectHome": "true",
        "ProtectSystem": "strict",
        "ReadOnlyPaths": "/var/lib/truthlens /opt/truthlens",
        "InaccessiblePaths": "-/etc/truthlens/audit.key",
        "RestrictAddressFamilies": "AF_UNIX",
        "CapabilityBoundingSet": "CAP_CHOWN",
        "ProtectKernelTunables": "true",
        "ProtectKernelModules": "true",
        "ProtectControlGroups": "true",
        "RestrictSUIDSGID": "true",
        "LockPersonality": "true",
        "StandardOutput": "null",
        "StandardError": "null",
    }.items():
        assert service[name] == value
    assert "ReadWritePaths" not in service
    assert "Install" not in config
