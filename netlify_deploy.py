import os, sys, zipfile, tempfile, urllib.request, urllib.error, json

SITE_ID  = "f8165b63-cfda-4009-ba34-2971445b4f6b"
SRC_DIR  = os.path.join(os.path.dirname(__file__), "netlify")

def get_token():
    token = os.environ.get("NETLIFY_TOKEN")
    if token:
        return token
    token_file = os.path.join(os.path.dirname(__file__), ".netlify_token")
    if os.path.exists(token_file):
        return open(token_file).read().strip()
    print("Geen token gevonden.")
    print("Zet je token in een bestand genaamd '.netlify_token' naast dit script,")
    print("of stel de omgevingsvariabele NETLIFY_TOKEN in.")
    sys.exit(1)

def zip_folder(src):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    tmp.close()
    with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(src):
            for fname in files:
                full = os.path.join(root, fname)
                arc  = os.path.relpath(full, src)
                zf.write(full, arc)
    return tmp.name

def deploy(token, zip_path):
    url = f"https://api.netlify.com/api/v1/sites/{SITE_ID}/deploys"
    with open(zip_path, "rb") as f:
        data = f.read()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type":  "application/zip",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
        print(f"\nDeploy gestart! ID: {result.get('id')}")
        print(f"Status: {result.get('state')}")
        print(f"Bekijk: https://afterfile.nl  (duurt ~30 sec)")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"FOUT {e.code}: {body}")

if __name__ == "__main__":
    token = get_token()
    print(f"Zippen van {SRC_DIR}...")
    zp = zip_folder(SRC_DIR)
    print(f"Uploaden naar Netlify ({os.path.getsize(zp)//1024} KB)...")
    deploy(token, zp)
    os.unlink(zp)
