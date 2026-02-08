#!/usr/bin/env python3
"""Temple Management System - Full Demo"""
import json
import urllib.request

BASE = "http://127.0.0.1:3000/api"

def api(endpoint, method="GET", body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{BASE}{endpoint}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

print("=" * 50)
print("  TEMPLE MANAGEMENT SYSTEM - LIVE DEMO")
print("=" * 50)
print()

# 1. Login
print("1. LOGIN AS ADMIN")
print("-" * 30)
res = api("/auth/login", "POST", {"email": "admin@temple.com", "password": "admin123"})
token = res["data"]["token"]
user = res["data"]["user"]
print(f"   Welcome: {user['firstName']} {user['lastName']} ({user['role']})")
print()

# 2. Temples
print("2. TEMPLES")
print("-" * 30)
res = api("/temples")
for t in res["data"]:
    wheelchair = "Yes" if t["hasWheelchairAccess"] else "No"
    print(f"   {t['name']}")
    print(f"     Deity: {t['deity']}")
    print(f"     Location: {t['city']}, {t['state']}")
    print(f"     Parking: {t['parkingCapacity']} | Wheelchair: {wheelchair}")
    print()

# 3. Rituals - find Ganesh Mandir
print("3. RITUALS (Shri Ganesh Mandir)")
print("-" * 30)
ganesh_temple = [t for t in res["data"] if "Ganesh" in t["name"]]
temple_id = ganesh_temple[0]["id"] if ganesh_temple else res["data"][0]["id"]
rituals = api(f"/temples/{temple_id}/rituals")
for r in rituals["data"]:
    price_str = f"Rs.{r['price']}" if r["price"] > 0 else "Free"
    print(f"   {r['name']} ({r['type']}) - {r['duration']}min - {price_str}")
print()

# 4. Bookings
print("4. BOOKINGS")
print("-" * 30)
res = api("/bookings", token=token)
for b in res["data"]:
    print(f"   {b['bookingNumber']} | Status: {b['status']} | Persons: {b['numberOfPersons']} | Rs.{b['totalAmount']}")
if not res["data"]:
    print("   No bookings")
print()

# 5. Donations
print("5. DONATIONS")
print("-" * 30)
res = api("/donations", token=token)
total = 0
for d in res["data"]:
    total += d["amount"]
    tag = " [80G Eligible]" if d["is80GEligible"] else ""
    print(f"   {d['donationNumber']} | Rs.{d['amount']:,.0f} | {d['category'].replace('_',' ')} | {d['paymentStatus']}{tag}")
print(f"\n   TOTAL COLLECTION: Rs.{total:,.0f}")
print()

# 6. Prasad Items
print("6. PRASAD MENU")
print("-" * 30)
res = api(f"/prasad/items?templeId={temple_id}")
for p in res["data"]:
    tags = []
    if p["isVegetarian"]: tags.append("Veg")
    if p["isSugarFree"]: tags.append("Sugar-Free")
    tag_str = f" [{', '.join(tags)}]" if tags else ""
    print(f"   {p['name']} - Rs.{p['price']}{tag_str}")
    if p.get("description"):
        print(f"     {p['description']}")
print()

# 7. Volunteers
print("7. VOLUNTEER LEADERBOARD")
print("-" * 30)
res = api("/volunteers/leaderboard")
for i, v in enumerate(res["data"]):
    print(f"   #{i+1} {v['user']['firstName']} {v['user']['lastName']} | {v['totalHours']}h | {v['totalPoints']} pts | {v['tier'].upper()}")
print()

# 8. Announcements
print("8. ANNOUNCEMENTS")
print("-" * 30)
res = api(f"/communication/announcements?templeId={temple_id}")
for a in res["data"]:
    print(f"   [{a['priority'].upper()}] {a['title']}")
    print(f"     {a['content'][:90]}...")
    print()

# 9. Spiritual Content
print("9. SPIRITUAL CONTENT")
print("-" * 30)
res = api("/communication/content")
for c in res["data"]:
    print(f"   [{c['type'].upper()}] {c['title']} ({c['language']})")
print()

# 10. Notifications
print("10. NOTIFICATIONS")
print("-" * 30)
# Login as devotee to see notifications
res2 = api("/auth/login", "POST", {"email": "devotee@example.com", "password": "devotee123"})
dev_token = res2["data"]["token"]
res = api("/communication/notifications", token=dev_token)
for n in res["data"]:
    read = "READ" if n["isRead"] else "NEW"
    print(f"   [{read}] {n['title']}")
    print(f"     {n['message']}")
    print()

print("=" * 50)
print("  ALL 8 MODULES WORKING!")
print("=" * 50)
print()
print("Login credentials:")
print("  Admin:   admin@temple.com / admin123")
print("  Devotee: devotee@example.com / devotee123")
print("  Priest:  priest@temple.com / priest123")
