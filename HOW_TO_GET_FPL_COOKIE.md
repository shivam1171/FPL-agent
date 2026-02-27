# How to Get Your FPL Cookie (with CSRF Token)

The FPL cookie must include the **csrftoken** for transfers to work. Follow these steps carefully:

## Step 1: Log into FPL

1. Open your browser (Chrome, Firefox, or Edge)
2. Go to **https://fantasy.premierleague.com**
3. Log in with your credentials
4. Make sure you're on the "My Team" page or any authenticated page

## Step 2: Open Developer Tools

**Chrome/Edge:**
- Press `F12` or `Ctrl+Shift+I` (Windows)
- Or right-click → "Inspect"

**Firefox:**
- Press `F12` or `Ctrl+Shift+I`
- Or right-click → "Inspect Element"

## Step 3: Go to Application/Storage Tab

**Chrome/Edge:**
1. Click the **"Application"** tab at the top
2. In the left sidebar, expand **"Cookies"**
3. Click on **"https://fantasy.premierleague.com"**

**Firefox:**
1. Click the **"Storage"** tab
2. Expand **"Cookies"**
3. Click on **"https://fantasy.premierleague.com"**

## Step 4: Find and Copy Cookies

You'll see a table with cookie names and values. You need **ALL cookies**, especially:
- ✅ **csrftoken** (REQUIRED for transfers!)
- ✅ **sessionid** (REQUIRED for authentication)
- pl_profile
- pl_euconsent-v2

### Option A: Copy Individual Cookies (Recommended)

1. Find the **csrftoken** row
2. Double-click the **Value** column
3. Copy the value (it will look like: `abcd1234efgh5678...`)
4. Do the same for **sessionid**

Then format them like this:
```
csrftoken=YOUR_CSRF_TOKEN_HERE; sessionid=YOUR_SESSION_ID_HERE
```

### Option B: Copy All Cookies from Network Tab

1. Click the **"Network"** tab
2. Refresh the page (F5)
3. Click on any request (like "me" or "bootstrap-static")
4. Find **"Request Headers"** section
5. Find the **"cookie:"** header
6. Copy the ENTIRE value (it's usually multiple lines)

**The cookie should look something like this:**
```
csrftoken=abcd1234efgh5678ijkl9012mnop3456; sessionid=xyz789abc456def123ghi456jkl789; pl_profile=eyJ...long_string...; pl_euconsent-v2=CPu...another_long_string...
```

## Step 5: Verify Your Cookie

Your cookie MUST contain both:
- `csrftoken=...`
- `sessionid=...`

**If your cookie doesn't have csrftoken**, try:
1. Clear browser cache
2. Log out of FPL
3. Log back in
4. Try copying the cookie again

## Step 6: Use in FPL Agent

1. Paste the **entire cookie string** into the login form
2. Enter your **Manager ID** (found in your FPL URL)
3. Click "Login"

## Common Issues

### "CSRF token not found"
- Your cookie doesn't include `csrftoken=...`
- Solution: Copy the cookie again using Option B (Network tab)

### "Authentication credentials were not provided"
- Your cookie is expired or incomplete
- Solution: Log out of FPL, log back in, get fresh cookie

### "Forbidden" error on transfer
- CSRF token is missing or invalid
- Solution: Get a fresh cookie and make sure it includes csrftoken

## Example Cookie (Redacted)

```
csrftoken=j8x9K2mP4nQ7rS1tU5vW6yZ3aB8cD0eF; sessionid=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p; pl_profile=eyJzIjogIldXSTZJbnNlYzpKV1FpT2lJeE1EQXdNREF3SWl3aWRYSnBJam9pYUhSMGNITTZMeTkzZDNjdWJXVmthV0V0YzNCc1lYa3VZMjl0TDJsdFlXZGxjeTl3Ykdsa2FYSmxZM1F2SWl3aWQzVnlJam9pYUhSMGNITTZMeTkzZDNjdVoyOXZaMnhsTG1OdmJTOWhZblZ6WlM5d2IyeHBZM2t2YzNKamZYMD0iLCAic3NpZCI6ICI3MDEwMDAwMDAwMDAwMDAiLCAicGx1Z2luIjogImZhY2Vib29rIn0
```

## Tips

1. ✅ **Copy the entire cookie** - don't miss any parts
2. ✅ **Include all semicolons** - they separate cookie values
3. ✅ **Get a fresh cookie** - if transfers fail, login again
4. ❌ **Don't share your cookie** - it's like your password
5. ❌ **Don't edit the cookie** - copy it exactly as-is

---

**After getting the correct cookie, transfers should work!** 🚀
