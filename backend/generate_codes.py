#!/usr/bin/env python3
"""Generate single-use promo codes for FinFlow and store them in MongoDB.

Each code can be redeemed once (POST /api/redeem-code) to unlock a subscription
tier for N days.

Usage:
    .venv/bin/python generate_codes.py                 # 100 PRO codes, 7 days
    .venv/bin/python generate_codes.py --count 50 --tier power --days 30
    .venv/bin/python generate_codes.py --out codes.csv # also write a CSV

The codes are printed to stdout so you can copy/distribute them.
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
    ap.add_argument("--tier", default="pro")
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--prefix", default="FINFLOW")
    ap.add_argument("--out", default=None, help="optional CSV output path")
    args = ap.parse_args()

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db = MongoClient(mongo_url)[os.environ.get("DB_NAME", "finflow")]
    db.redemption_codes.create_index([("code", ASCENDING)], unique=True)

    now = datetime.now(timezone.utc)
    codes = []
    attempts = 0
    while len(codes) < args.count and attempts < args.count * 20:
        attempts += 1
        code = make_code(args.prefix)
        try:
            db.redemption_codes.insert_one({
                "code": code,
                "tier": args.tier,
                "duration_days": args.days,
                "redeemed": False,
                "redeemed_by": None,
                "redeemed_at": None,
                "created_at": now,
            })
            codes.append(code)
        except Exception:
            # Unique-index collision — extremely rare; just retry.
            continue

    print(f"\nGenerated {len(codes)} '{args.tier}' codes ({args.days} days each):\n")
    for i, c in enumerate(codes, 1):
        print(f"{i:>3}. {c}")

    if args.out:
        with open(args.out, "w") as f:
            f.write("code,tier,duration_days\n")
            for c in codes:
                f.write(f"{c},{args.tier},{args.days}\n")
        print(f"\nCSV written to {args.out}")

    total = db.redemption_codes.count_documents({})
    unredeemed = db.redemption_codes.count_documents({"redeemed": False})
    print(f"\nDB now holds {total} codes total ({unredeemed} unredeemed).")


if __name__ == "__main__":
    main()
