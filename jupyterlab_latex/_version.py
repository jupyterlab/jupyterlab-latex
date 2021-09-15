import json
from pathlib import Path

__all__ = ["__version__", "__js__"]

def _fetchJS():
    settings = Path(__file__).parent.resolve() / "labextension/package.json"

    try:
        with settings.open() as f:
            return json.load(f)
    except FileNotFoundError:
        pass

    raise FileNotFoundError(f"Could not find package.json at {settings!s}")


def _fetchVersion():
    return _fetchJS()["version"]

__js__ = _fetchJS()
__version__ = _fetchVersion()