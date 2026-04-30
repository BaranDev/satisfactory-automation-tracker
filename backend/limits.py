"""Shared slowapi limiter so routes can decorate their handlers
without circular-importing the FastAPI app."""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
