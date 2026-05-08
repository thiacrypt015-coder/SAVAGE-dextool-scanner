import logging
import os
import re
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://savage:savage@localhost:5432/savage_trading')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
JWT_SECRET = os.getenv('JWT_SECRET', 'change-me-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRE_HOURS = int(os.getenv('JWT_EXPIRE_HOURS', '72'))
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
ADMIN_TELEGRAM_IDS = [int(x.strip()) for x in os.getenv('ADMIN_TELEGRAM_IDS', os.getenv('TELEGRAM_CHAT_ID', '0')).split(',') if x.strip()]
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

_HELIUS_HOSTS = ('mainnet.helius-rpc.com', 'rpc.helius.xyz', 'devnet.helius-rpc.com')
_UUID_RE = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')


def _normalize_rpc_url(url: str) -> str:
    """Auto-fix common Helius URL mistakes: '?KEY' or '?key=KEY' -> '?api-key=KEY'."""
    raw = url.strip()
    if not raw:
        return raw
    try:
        parsed = urlparse(raw)
        host = (parsed.hostname or '').lower()
        if host not in _HELIUS_HOSTS:
            return raw
        qs = parse_qsl(parsed.query, keep_blank_values=True)
        if any(k.lower() == 'api-key' and v for k, v in qs):
            return raw
        rewritten = []
        moved = False
        for k, v in qs:
            if not moved and k.lower() in ('key', 'apikey', 'api_key') and v:
                rewritten.append(('api-key', v))
                moved = True
            else:
                rewritten.append((k, v))
        if moved:
            return urlunparse(parsed._replace(query=urlencode(rewritten)))
        if len(qs) == 1 and qs[0][1] == '' and _UUID_RE.match(qs[0][0]):
            return urlunparse(parsed._replace(query=urlencode([('api-key', qs[0][0])])))
        return raw
    except Exception:
        return raw


_RPC_URL_SOL_RAW = os.getenv('RPC_URL_SOL', 'https://api.mainnet-beta.solana.com')
RPC_URL_SOL = ','.join(_normalize_rpc_url(u.strip()) for u in _RPC_URL_SOL_RAW.split(',') if u.strip())
RPC_URLS_SOL = [u for u in RPC_URL_SOL.split(',') if u]
RPC_URL_SOL_REWRITTEN = _RPC_URL_SOL_RAW != RPC_URL_SOL

if RPC_URL_SOL_REWRITTEN:
    logger.warning(
        "RPC_URL_SOL was auto-fixed to add 'api-key=' — original env value used a malformed Helius URL. "
        "Update the env var to %s for clarity.",
        RPC_URL_SOL,
    )

ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', '')
BIRDEYE_API_KEY = os.getenv('BIRDEYE_API_KEY', '')
BACKEND_PORT = int(os.getenv('BACKEND_PORT', '8000'))
