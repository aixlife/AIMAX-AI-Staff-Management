#!/usr/bin/env python3
"""Verify bulk Excel loading works without importing pandas."""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from openpyxl import Workbook


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> int:
    assert "pandas" not in sys.modules, "pandas imported before loader smoke"
    from bulk.excel_loader import load_bulk_rows

    assert "pandas" not in sys.modules, "bulk.excel_loader imported pandas"

    with tempfile.TemporaryDirectory(prefix="aimax-excel-loader-") as tmp:
        path = Path(tmp) / "bulk.xlsx"
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["아이디", "비밀번호", "핵심키워드"])
        sheet.append(["naver_id", "naver_pw", "AIMAX 테스트"])
        sheet.append(["numeric", 1234, "숫자 비밀번호 보존"])
        sheet.append([None, None, None])
        workbook.save(path)
        workbook.close()

        rows = load_bulk_rows(path)
        assert rows == [
            {"account_id": "naver_id", "account_pw": "naver_pw", "keyword": "AIMAX 테스트"},
            {"account_id": "numeric", "account_pw": "1234", "keyword": "숫자 비밀번호 보존"},
        ], rows

        bad_path = Path(tmp) / "bad.xlsx"
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["계정", "키워드"])
        sheet.append(["naver_id", "AIMAX 테스트"])
        workbook.save(bad_path)
        workbook.close()
        try:
            load_bulk_rows(bad_path)
        except ValueError as error:
            assert "비밀번호" in str(error), str(error)
        else:
            raise AssertionError("missing required column did not fail")

    assert "pandas" not in sys.modules, "pandas imported during loader smoke"
    print("EXCEL_LOADER_NO_PANDAS_SMOKE_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
