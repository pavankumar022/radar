"""
RADAR — Replay Engine
Reads stored events and re-emits them over the same WebSocket pipeline
at a configurable speed multiplier (0.5x → 500x).
No separate code path — same event shape as live feed.
"""
import asyncio
import logging
import time
from typing import Callable, Awaitable, Optional

from backend import database as db

log = logging.getLogger(__name__)


class ReplayEngine:
    def __init__(self) -> None:
        self._active = False
        self._task: Optional[asyncio.Task] = None
        self._speed = 1.0
        self._index = 0
        self._total = 0
        self._start_time = 0.0
        self._events: list[dict] = []

    @property
    def is_active(self) -> bool:
        return self._active

    @property
    def status(self) -> dict:
        elapsed = time.monotonic() - self._start_time if self._active else 0.0
        return {
            "active": self._active,
            "speed_multiplier": self._speed,
            "current_index": self._index,
            "total_events": self._total,
            "elapsed_seconds": elapsed,
            "buffer_percent": (self._index / max(self._total, 1)) * 100,
        }

    async def start(
        self,
        speed_multiplier: float,
        on_event: Callable[[dict], Awaitable[None]],
    ) -> None:
        """
        Start replay. Loads events from DB and re-emits at speed_multiplier.
        If already active, stops current run and restarts.
        """
        await self.stop()

        # Load events sorted by timestamp ascending
        events, total = await db.get_events_paginated(
            page=1, page_size=5000,
        )
        # Re-sort ascending for replay
        events_sorted = sorted(events, key=lambda e: e.get("timestamp", ""))
        if not events_sorted:
            log.warning("Replay: no events in database to replay")
            return

        self._events = events_sorted
        self._total = len(events_sorted)
        self._index = 0
        self._speed = max(0.5, min(speed_multiplier, 500.0))
        self._active = True
        self._start_time = time.monotonic()

        log.info(f"Replay starting: {self._total} events at {self._speed}x")
        self._task = asyncio.create_task(self._run(on_event))

    async def stop(self) -> None:
        self._active = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        log.info("Replay stopped")

    async def _run(self, on_event: Callable[[dict], Awaitable[None]]) -> None:
        """
        Emit events at the configured speed multiplier.
        Base interval: 1 event / (rate * speed_multiplier).
        Minimum interval floor: 1ms (prevents 100% CPU spin at MAX speed).
        """
        # Target: emit at speed_multiplier × natural rate (10 eps baseline)
        base_eps = 10.0
        target_eps = base_eps * self._speed
        interval = max(0.001, 1.0 / target_eps)

        try:
            while self._active and self._index < self._total:
                event = self._events[self._index]
                self._index += 1

                # Tag as replay event
                event = dict(event)
                event["_replay"] = True
                event["_replay_speed"] = self._speed

                await on_event(event)
                await asyncio.sleep(interval)

            self._active = False
            log.info(f"Replay finished: {self._index}/{self._total} events")
        except asyncio.CancelledError:
            self._active = False
            raise


# Singleton used by FastAPI router
replay_engine = ReplayEngine()
