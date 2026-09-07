import os
import sys
import asyncio
from starlette.requests import Request
from starlette.datastructures import Headers

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.api.auth_router import login

async def run_async_tests():
    print("Testing Universal JSON & Form Login Endpoint directly...")
    db = SessionLocal()
    try:
        # 1. Test JSON login
        async def json_receive():
            return {
                "type": "http.request",
                "body": b'{"username": "admin", "password": "somesh123"}',
                "more_body": False
            }

        req_json = Request(scope={
            "type": "http",
            "method": "POST",
            "headers": [(b"content-type", b"application/json")],
        }, receive=json_receive)

        res = await login(request=req_json, db=db)
        assert "access_token" in res
        assert res["user"].username == "admin"
        assert res["user"].role.value == "OWNER"
        print(f"[PASS] JSON Login succeeded! User: {res['user'].username} (Role: {res['user'].role.value})")

        # 2. Test Staff JSON login
        async def staff_receive():
            return {
                "type": "http.request",
                "body": b'{"username": "staff", "password": "staff123"}',
                "more_body": False
            }

        req_staff = Request(scope={
            "type": "http",
            "method": "POST",
            "headers": [(b"content-type", b"application/json")],
        }, receive=staff_receive)

        res_staff = await login(request=req_staff, db=db)
        assert res_staff["user"].role.value == "STAFF"
        print(f"[PASS] Staff JSON Login succeeded! User: {res_staff['user'].username} (Role: {res_staff['user'].role.value})")

        # 3. Test Form URL-Encoded login
        async def form_receive():
            return {
                "type": "http.request",
                "body": b"username=admin&password=somesh123",
                "more_body": False
            }

        req_form = Request(scope={
            "type": "http",
            "method": "POST",
            "headers": [(b"content-type", b"application/x-www-form-urlencoded")],
        }, receive=form_receive)

        res_form = await login(request=req_form, db=db)
        assert "access_token" in res_form
        print("[PASS] Form-Encoded Login succeeded!")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_async_tests())
