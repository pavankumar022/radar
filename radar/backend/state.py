"""
RADAR — Application State
Global mutable state for the running server.
Encapsulated here so it's importable anywhere without circular deps.
"""
import time
from dataclasses import dataclass, field
from typing import Optional
import asyncio


@dataclass
class AppState:
    feed_state: str = "LOADING_SYNTHETIC"
    monitoring_active: bool = True
    input_mode: str = "synthetic"
    start_time: float = field(default_factory=time.monotonic)
    generator_task: Optional[asyncio.Task] = field(default=None, repr=False)
    live_capture_task: Optional[asyncio.Task] = field(default=None, repr=False)
    synthetic_delay: float = 3.0
    monitored_ips: list[str] = field(default_factory=list)


app_state = AppState()
