"""
Vercel 서버리스 진입점. 실제 앱은 be/main.py에 그대로 두고 여기서 재노출만 한다.

be/main.py가 이미 자기 위치 기준으로 저장소 루트를 sys.path에 넣어 두므로
(그래야 로컬에서 `python be/main.py`로도 돌아가니까), 여기서는 그걸 import만
하면 된다. 다만 Vercel 런타임에서도 동일하게 동작하도록 루트를 한 번 더 보장한다.
"""

import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from be.main import app  # noqa: E402
