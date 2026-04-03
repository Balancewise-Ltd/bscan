#!/usr/bin/env python3
"""Seed script to create communities in the Wisers/BSCAN backend."""

import argparse
import sys

import requests

BASE_URL = "https://api-bscan.balancewises.io/api"

COMMUNITIES = [
    {
        "name": "Side Hustle Beginners",
        "description": (
            "A community for those just starting their side hustle journey. "
            "Share tips, ask questions, and celebrate wins."
        ),
        "category": "side-hustle",
        "privacy": "public",
    },
    {
        "name": "UK Ecommerce",
        "description": (
            "Everything about building and scaling ecommerce businesses "
            "in the UK market."
        ),
        "category": "ecommerce",
        "privacy": "public",
    },
    {
        "name": "FIRE Journey",
        "description": (
            "Financial Independence, Retire Early. Track your progress "
            "and share strategies."
        ),
        "category": "fire",
        "privacy": "public",
    },
    {
        "name": "Tech Founders",
        "description": (
            "For founders building tech startups and SaaS products. "
            "Share your journey."
        ),
        "category": "tech",
        "privacy": "public",
    },
    {
        "name": "Freelance and Agency",
        "description": (
            "Tips and discussions for freelancers and agency owners "
            "growing their business."
        ),
        "category": "freelance",
        "privacy": "public",
    },
]


def login(email: str, password: str) -> str:
    """Log in and return the auth token."""
    print(f"Logging in as {email}...")
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password},
    )
    if resp.status_code != 200:
        print(f"Login failed ({resp.status_code}): {resp.text}")
        sys.exit(1)

    data = resp.json()
    token = data.get("token") or data.get("access_token") or data.get("data", {}).get("token")
    if not token:
        print(f"Could not extract token from response: {data}")
        sys.exit(1)

    print("Login successful.")
    return token


def create_community(token: str, community: dict) -> None:
    """Create a single community via the API."""
    name = community["name"]
    resp = requests.post(
        f"{BASE_URL}/wisers/communities",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=community,
    )

    if resp.status_code in (200, 201):
        print(f"  [CREATED]  {name}")
    elif resp.status_code == 409:
        print(f"  [SKIPPED]  {name} (already exists)")
    else:
        print(f"  [FAILED]   {name} ({resp.status_code}): {resp.text}")


def main():
    parser = argparse.ArgumentParser(description="Seed BSCAN communities")
    parser.add_argument("--email", required=True, help="Admin email")
    parser.add_argument("--password", required=True, help="Admin password")
    args = parser.parse_args()

    token = login(args.email, args.password)

    print(f"\nCreating {len(COMMUNITIES)} communities...\n")
    for community in COMMUNITIES:
        create_community(token, community)

    print("\nDone.")


if __name__ == "__main__":
    main()
