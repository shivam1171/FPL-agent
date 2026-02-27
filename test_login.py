import asyncio
import httpx
import re
import logging

logging.basicConfig(level=logging.INFO)

async def test_fpl_login():
    email = "shivam.mahajan117@gmail.com"
    password = "dummy_password" 
    
    login_url = "https://users.premierleague.com/accounts/login/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    
    async with httpx.AsyncClient(follow_redirects=True) as client:
        print("Sending GET request...")
        r1 = await client.get(login_url, headers=headers)
        print(f"GET Status: {r1.status_code}")
        print(f"Final URL: {r1.url}")
        print(f"GET Cookies: {r1.cookies}")
        
        print(r1.text[:500])

if __name__ == "__main__":
    asyncio.run(test_fpl_login())
