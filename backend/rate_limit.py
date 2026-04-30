"""Shared slowapi limiter.
Named `rate_limit.py` (not `limits.py`) so it doesn't shadow the PyPI
`limits` package that slowapi imports internally — the previous name
caused a circular ImportError on container start."""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
