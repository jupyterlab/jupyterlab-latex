import json
from pathlib import Path

__all__ = ["__version__"]

def _fetchVersion():
    settings = Path(__file__).parent.resolve() / "labextension/package.json"

    try:
        with settings.open() as f:
            return json.load(f)["version"]
    except FileNotFoundError:
        pass

    raise FileNotFoundError(f"Could not find package.json at {settings!s}")

__version__ = _fetchVersion()