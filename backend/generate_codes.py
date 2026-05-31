#!/usr/bin/env python3
"""Generate redeem codes for FinFlow into the `redeem_codes` collection.

Matches the schema used by the backend `/codes/redeem` and `/admin/codes`
endpoints (db.redeem_codes), so generated codes redeem normally in the app.

Usage:
    .venv/bin/python generate_codes.py                       # 100 PRO codes, 7 days
    .venv/bin/python generate_codes.py --count 50 --grant-tier power --days 30
    .venv/bin/python generate_codes.py --out codes.csv       # also write a CSV
"""
import argparse
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

# Unambiguous alphabet (no 0/O/1/I/L) for easy typing.
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def make_code(prefix: str = "FINFLOW") -> str:
    part = lambda n: "".join(secrets.choice(ALPHABET) for _ in range(n))
    return f"{prefix}-{part(4)}-{part(4)}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=100)
    ap.add_argument("--grant-tier", default="pro")
    ap.add_argument("--days", type=int, default=7, help="subscription days granted")
    ap.add_argument("--max-uses", type=int, default=1)
    ap.add_argument("--prefix", default="FINFLOW")
    ap.add_argument("--out", default=None, help="optional CSV output path")
    args = ap.parse_args()

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db = MongoClient(mongo_url)[os.environ.get("DB_NAME", "finflow")]
    db.redeem_codes.create_index([("code", ASCENDING)], unique=True)

    now = datetime.now(timezone.utc)
    codes = []
    attempts = 0
    while len(codes) < args.count and attempts < args.count * 20:
        attempts += 1
        code = make_code(args.prefix)
        try:
            db.redeem_codes.insert_one({
                "code": code,
                "type": "trial",
                "grant_tier": args.grant_tier,
                "duration_days": args.days,
                "max_uses": args.max_uses,
                "used_count": 0,
                "per_user_once": True,
                "active": True,
                "valid_from": now,
                "valid_until": None,
                "created_at": now,
            })
            codes.append(code)
        except Exception:
            continue  # unique-index collision — retry

    print(f"\nGenerated {len(codes)} '{args.grant_tier}' codes ({args.days} days each):\n")
    for i, c in enumerate(codes, 1):
        print(f"{i:>3}. {c}")

    if args.out:
        with open(args.out, "w") as f:
            f.write("code,grant_tier,duration_days\n")
            for c in codes:
                f.write(f"{c},{args.grant_tier},{args.days}\n")
        print(f"\nCSV written to {args.out}")

    total = db.redeem_codes.count_documents({})
    active = db.redeem_codes.count_documents({"active": True, "used_count": 0})
    print(f"\ndb.redeem_codes now holds {total} codes ({active} active & unused).")


if __name__ == "__main__":
    main()
