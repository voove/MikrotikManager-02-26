import pytest
from app.api.metrics import validate_range


def test_valid_ranges():
    for r in ["1m", "5m", "30m", "1h", "6h", "24h", "1d", "7d", "1w", "2w"]:
        assert validate_range(r) == r


def test_invalid_ranges_raise():
    for r in [
        "abc",
        "1h) |> drop()",
        "-1h",
        "24h; rm -rf /",
        "",
        "1x",
        "1h\n|> drop()",
        "999999999h",
    ]:
        with pytest.raises(ValueError):
            validate_range(r)
