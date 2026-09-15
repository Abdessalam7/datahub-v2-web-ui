import time
from typing import Any, Optional

class SimpleCache:
    def __init__(self, ttl: int = 300):
        self.ttl = ttl
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Optional[Any]:
        if key not in self._store:
            return None
        value, timestamp = self._store[key]
        if time.time() - timestamp > self.ttl:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (value, time.time())

cache = SimpleCache(ttl=300)
