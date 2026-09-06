#!/usr/bin/env python3
"""Fetches the account's latest Instagram posts and writes
content/instagram_feed.json — scripts/build_articles.py reads that file
and injects the actual HTML into index.html's "On Instagram" section
(see its own update_instagram_feed()), the same way it already turns
content/articles/*.md into real pages. This script's only job is talking
to Instagram and downloading images; it never touches HTML itself.

Deliberately dependency-free (Python 3 standard library only), same
reasoning as build_articles.py.

Run from the repo root:
    python3 scripts/fetch_instagram.py

Meant to run on a schedule via .github/workflows/fetch-instagram.yml,
which commits+pushes whatever this script changes — that push then
triggers the existing deploy workflow (build_articles.py + publish),
so a new Instagram post shows up live within one polling interval with
nobody touching anything by hand.

=======================================================================
ONE-TIME SETUP (do this once; everything after is automatic)
=======================================================================
Instagram has no public "give me the latest post" endpoint — this has
to go through Meta's official Instagram API, which means:

1. The Instagram account must be a Business or Creator account (Settings
   -> Account type in the Instagram app; free, no real downside for an
   org account). Skip this if it already is one.

2. Create a Meta Developer App:
   - https://developers.facebook.com/apps -> Create App -> type
     "Business" -> give it any name (e.g. "Word for Word Website").
   - In the app dashboard, Add Product -> "Instagram" (the current
     "Instagram API with Instagram Login" product — NOT the old
     Basic Display API, which Meta shut down in December 2024).
   - Under that product's settings, add the Instagram account as a
     tester and generate a token via the "Generate access token" flow
     in the dashboard (it walks you through logging into the actual
     Instagram account in a popup). This gives you a SHORT-lived token.

3. Exchange that short-lived token for a LONG-lived one (lasts ~60 days,
   refreshable indefinitely — see refresh_token_if_possible() below):

       curl -i -X GET "https://graph.instagram.com/access_token \\
         ?grant_type=ig_exchange_token \\
         &client_secret=<your app's Instagram secret, same dashboard page> \\
         &access_token=<the short-lived token from step 2>"

   The response's "access_token" is what this script needs.

4. Store it as a GitHub Actions secret on this repo:
   Settings -> Secrets and variables -> Actions -> New repository secret
     Name:  INSTAGRAM_ACCESS_TOKEN
     Value: <the long-lived token from step 3>

That's the whole setup. From here, .github/workflows/fetch-instagram.yml
runs this script on a schedule automatically.

Optional, to stop needing to repeat step 3 every ~60 days: this script
already asks Instagram to refresh the token on every run (extending it
another ~60 days each time, well before it'd expire) — but a refreshed
token is only useful if it actually gets back into the
INSTAGRAM_ACCESS_TOKEN secret above. To let it do that automatically,
also add a second secret:
     Name:  SECRETS_UPDATE_TOKEN
     Value: a GitHub personal access token (fine-grained, scoped to just
            this repo, with "Secrets" repository permission set to
            Read and write) — https://github.com/settings/personal-access-tokens
Without this second secret, the refresh still happens on Instagram's
side, but the extended token only lives in that one run's memory —
you'd need to repeat step 3 by hand once the original one nears
expiry (a "Error validating access token" failure in the Action's log
is the tell).
"""

import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "assets" / "images" / "instagram"
DATA_FILE = ROOT / "content" / "instagram_feed.json"

GRAPH_API = "https://graph.instagram.com"
MEDIA_FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp"
POST_LIMIT = 6


class FetchError(Exception):
    """Raised for anything that should stop this run without touching
    the previously-saved feed — a failed fetch should leave the site
    showing its last-known-good posts, not go blank."""


def http_get_json(url):
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        try:
            message = json.loads(body)["error"]["message"]
        except Exception:
            message = body
        raise FetchError(f"HTTP {err.code} from {url.split('?')[0]}: {message}") from err
    except urllib.error.URLError as err:
        raise FetchError(f"Couldn't reach {url.split('?')[0]}: {err.reason}") from err


def download_file(url, dest_path):
    with urllib.request.urlopen(url, timeout=30) as resp, open(dest_path, "wb") as f:
        shutil.copyfileobj(resp, f)


def refresh_token_if_possible(token):
    """Asks Instagram to extend this long-lived token another ~60 days.
    Only works once the token is at least 24h old (the normal case for
    almost this entire function's ~60-day life) — expected to fail
    otherwise, which is why failures of ANY kind here are logged and
    swallowed rather than raised: this refresh is purely a bonus, never
    the thing that should decide whether this run succeeds. A token
    that's actually broken (expired/revoked, not just "too young to
    refresh yet") still gets a real, fatal error — just from
    fetch_latest_media() below, the call that's actually load-bearing,
    not from here."""
    url = f"{GRAPH_API}/refresh_access_token?grant_type=ig_refresh_token&access_token={urllib.parse.quote(token, safe='')}"
    try:
        data = http_get_json(url)
        new_token = data.get("access_token")
        if not new_token:
            raise FetchError(f"refresh response had no access_token: {data}")
        return new_token, new_token != token
    except FetchError as err:
        print(f"Token refresh skipped (this is normal unless the token is close to its ~60-day expiry): {err}")
        return token, False


def maybe_update_github_secret(new_token):
    """Best-effort: pushes a refreshed token back into the
    INSTAGRAM_ACCESS_TOKEN repo secret via the gh CLI, so the NEXT
    scheduled run picks it up too instead of the extension being
    forgotten the moment this run ends. Entirely optional (see this
    file's own setup docstring) — silently does nothing if the
    SECRETS_UPDATE_TOKEN secret isn't configured or gh isn't
    available, since the fetch above already succeeded either way."""
    repo = os.environ.get("GITHUB_REPOSITORY")
    pat = os.environ.get("SECRETS_UPDATE_TOKEN")
    if not repo or not pat or not shutil.which("gh"):
        print("Skipping auto-refresh of the INSTAGRAM_ACCESS_TOKEN secret (SECRETS_UPDATE_TOKEN not set) — see this script's docstring if you want that automated too.")
        return
    try:
        subprocess.run(
            ["gh", "secret", "set", "INSTAGRAM_ACCESS_TOKEN", "--repo", repo, "--body", new_token],
            env={**os.environ, "GH_TOKEN": pat},
            check=True,
            capture_output=True,
            text=True,
        )
        print("Refreshed INSTAGRAM_ACCESS_TOKEN secret with the newly extended token.")
    except subprocess.CalledProcessError as err:
        # Non-fatal — this run already has a perfectly good token in hand,
        # this was only ever about setting NEXT run up.
        print(f"Couldn't update the INSTAGRAM_ACCESS_TOKEN secret (continuing anyway): {err.stderr}")


def fetch_latest_media(token):
    url = f"{GRAPH_API}/me/media?fields={MEDIA_FIELDS}&limit={POST_LIMIT}&access_token={urllib.parse.quote(token, safe='')}"
    data = http_get_json(url)
    if "data" not in data:
        raise FetchError(f"Unexpected response shape from Instagram: {data}")
    return data["data"]


def build_post_records(media_items):
    """Turns Instagram's own raw media objects into this repo's own
    small, stable shape (also downloading each post's image) —
    build_articles.py's update_instagram_feed() only ever reads THIS
    shape, never Instagram's response directly, so a future change to
    what Instagram's API returns is contained to just this function."""
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    posts = []
    for item in media_items:
        # VIDEO/REEL posts have no media_url usable as a plain <img src>
        # (it's a video file) — thumbnail_url is the still frame Instagram
        # itself generates, which is what every other post's cover is
        # anyway. CAROUSEL_ALBUM's media_url is already just its own
        # first slide, so it needs no special handling.
        image_url = item.get("thumbnail_url") or item.get("media_url")
        if not image_url:
            continue
        post_id = item["id"]
        image_path = IMAGES_DIR / f"{post_id}.jpg"
        if not image_path.exists():
            download_file(image_url, image_path)
        posts.append(
            {
                "id": post_id,
                "caption": item.get("caption", ""),
                "permalink": item.get("permalink", "https://www.instagram.com/pennword4word/"),
                "timestamp": item.get("timestamp", ""),
                "image": f"assets/images/instagram/{post_id}.jpg",
            }
        )
    return posts


def prune_stale_images(current_posts):
    """Deletes any previously-downloaded post image that's aged out of
    the current top POST_LIMIT — otherwise every post ever fetched
    stays in the repo forever, since download_file() above only ever
    adds files, never removes them."""
    keep = {Path(p["image"]).name for p in current_posts}
    if not IMAGES_DIR.exists():
        return
    for existing in IMAGES_DIR.iterdir():
        if existing.name not in keep:
            existing.unlink()


def main():
    token = os.environ.get("INSTAGRAM_ACCESS_TOKEN")
    if not token:
        raise FetchError("INSTAGRAM_ACCESS_TOKEN isn't set — see this script's own docstring for one-time setup.")

    token, changed = refresh_token_if_possible(token)
    if changed:
        maybe_update_github_secret(token)

    media_items = fetch_latest_media(token)
    posts = build_post_records(media_items)
    if not posts:
        raise FetchError("Instagram returned no usable posts (empty account, or every item was an unsupported type).")

    prune_stale_images(posts)

    # Compares against whatever's already saved so a run that finds
    # nothing new doesn't still rewrite the file with a fresh
    # fetched_at — that field changing on every single run regardless
    # of real content would make the fetch-instagram workflow's own
    # git-diff-based "only commit if something changed" check always
    # see a diff, triggering a full site rebuild+redeploy every polling
    # interval even when nothing was actually posted.
    previous_posts = []
    if DATA_FILE.exists():
        try:
            previous_posts = json.loads(DATA_FILE.read_text(encoding="utf-8")).get("posts", [])
        except json.JSONDecodeError:
            previous_posts = []
    if posts == previous_posts:
        print(f"No new posts ({len(posts)} unchanged) — leaving content/instagram_feed.json as-is.")
        return

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(
        json.dumps(
            {"fetched_at": datetime.now(timezone.utc).isoformat(), "posts": posts},
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Fetched {len(posts)} latest Instagram posts -> content/instagram_feed.json")


if __name__ == "__main__":
    try:
        main()
    except FetchError as err:
        print(f"Instagram fetch error: {err}", file=sys.stderr)
        sys.exit(1)
