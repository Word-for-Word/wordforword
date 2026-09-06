#!/usr/bin/env python3
"""Builds article pages + the publications listing from content/articles/*.md.

Deliberately dependency-free (Python 3 standard library only) — no `pip
install` step, no requirements.txt, nothing for a future non-technical
maintainer to have to keep working. Frontmatter and markdown are both a
small, HAND-WRITTEN subset (flat key: value pairs; paragraphs, **bold**,
*italic*, [links](url), and > blockquotes) rather than real YAML/Markdown
parsers, since this only ever needs to read files THIS script also defines
the shape of.

Run from the repo root:
    python3 scripts/build_articles.py
"""

import html
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content" / "articles"
OUTPUT_DIR = ROOT / "articles"
TEMPLATES_DIR = ROOT / "templates"

# The only categories this system manages — "Editions" (whole issues) is a
# separate, already-existing, hand-maintained concept (see index.html's own
# #publications section) and deliberately out of scope here.
CATEGORIES = ["interviews", "essays", "narratives", "outreach"]

REQUIRED_FIELDS = ["title", "category", "author", "editor", "designer", "illustration"]


class ContentError(Exception):
    """Raised for a problem in a specific content file — caught at the top
    level so the error message names the file, instead of a raw traceback."""


def read_current_asset_versions():
    """Reads the ?v=N cache-busting numbers straight out of index.html, so
    every generated page always matches whatever index.html is currently
    on — one source of truth, nothing to remember to keep in sync by hand."""
    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    css_match = re.search(r"css/style\.css\?v=(\d+)", index_html)
    js_match = re.search(r"js/main\.js\?v=(\d+)", index_html)
    if not css_match or not js_match:
        raise ContentError("Couldn't find css/style.css?v= or js/main.js?v= in index.html")
    return css_match.group(1), js_match.group(1)


def parse_frontmatter(text, filename):
    """Splits a content file into its frontmatter dict and markdown body.

    Frontmatter format is intentionally flat (no nested YAML, no lists) —
    just `---`, then one `key: value` per line, then closing `---`:

        ---
        title: My Article
        category: essays
        ---
        Body text goes here.
    """
    if not text.startswith("---"):
        raise ContentError(f"{filename}: must start with a --- frontmatter block")
    parts = text.split("---", 2)
    if len(parts) < 3:
        raise ContentError(f"{filename}: frontmatter block isn't closed with a second ---")
    _, frontmatter_block, body = parts

    fields = {}
    for lineno, line in enumerate(frontmatter_block.splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        if ":" not in line:
            raise ContentError(f"{filename}: frontmatter line {lineno} isn't 'key: value' — {line!r}")
        key, _, value = line.partition(":")
        fields[key.strip()] = value.strip()

    for field in REQUIRED_FIELDS:
        if not fields.get(field):
            raise ContentError(f"{filename}: missing required frontmatter field '{field}'")
    if fields["category"] not in CATEGORIES:
        raise ContentError(
            f"{filename}: category '{fields['category']}' must be one of {', '.join(CATEGORIES)}"
        )

    return fields, body.strip()


def format_date(date_str, filename):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise ContentError(f"{filename}: date '{date_str}' must be in YYYY-MM-DD format")


def render_inline(text):
    """Escapes raw HTML, then applies the one small set of inline markers
    this format supports. Order matters: escape first (safety), links
    before bold before italic (so ** is consumed before a bare * would
    otherwise grab half of it)."""
    text = html.escape(text, quote=False)
    text = re.sub(r"\[(.+?)\]\((.+?)\)", lambda m: f'<a href="{html.escape(m.group(2), quote=True)}">{m.group(1)}</a>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    return text


def render_body_html(body):
    """Splits on blank lines into blocks; each block is either a
    blockquote (every line starts with "> ") or a plain paragraph. Single
    newlines WITHIN a block are joined with a space (soft-wrap), matching
    how a plain paragraph of prose reads.

    Also recognizes ## / ### headers and "- " bullet lists — not just
    prose — since Decap CMS's own markdown widget can produce these even
    though this parser doesn't support the rest of full Markdown; without
    handling them, a contributor's list or heading would silently render
    as raw "- item" / "## Heading" text instead of breaking obviously."""
    blocks = re.split(r"\n\s*\n", body.strip())
    html_blocks = []
    for block in blocks:
        lines = block.splitlines()
        if not lines:
            continue
        stripped_first = lines[0].strip()
        if all(line.strip().startswith(">") for line in lines):
            quoted = " ".join(line.strip().lstrip(">").strip() for line in lines)
            html_blocks.append(f"        <blockquote><p>{render_inline(quoted)}</p></blockquote>")
        elif stripped_first.startswith("### "):
            html_blocks.append(f"        <h3>{render_inline(stripped_first[4:].strip())}</h3>")
        elif stripped_first.startswith("## "):
            html_blocks.append(f"        <h2>{render_inline(stripped_first[3:].strip())}</h2>")
        elif all(line.strip().startswith("- ") for line in lines):
            items = "\n".join(f"          <li>{render_inline(line.strip()[2:].strip())}</li>" for line in lines)
            html_blocks.append(f"        <ul>\n{items}\n        </ul>")
        else:
            joined = " ".join(line.strip() for line in lines if line.strip())
            html_blocks.append(f"        <p>{render_inline(joined)}</p>")
    return "\n".join(html_blocks)


def load_template(name):
    return (TEMPLATES_DIR / name).read_text(encoding="utf-8")


def fill(template, values):
    """Replaces every {{KEY}} in the template with values[KEY] — errors
    loudly if the template references a key that was never provided,
    rather than silently leaving a literal {{KEY}} in the published page."""
    def repl(match):
        key = match.group(1)
        if key not in values:
            raise ContentError(f"Template references unknown placeholder {{{{{key}}}}}")
        return str(values[key])

    return re.sub(r"\{\{(\w+)\}\}", repl, template)


def build_partial(name, base, js_version):
    return fill(load_template(name), {"BASE": base, "JS_VERSION": js_version})


def build_article(md_path, css_version, js_version, base_url):
    filename = md_path.name
    text = md_path.read_text(encoding="utf-8")
    fields, body = parse_frontmatter(text, filename)
    slug = md_path.stem

    date = format_date(fields.get("date", ""), filename)
    date_suffix = f" · {date.strftime('%B %Y')}" if date else ""

    # "true"/"false" as literal unquoted text — that's how Decap's boolean
    # widget serializes into this project's own flat key:value frontmatter
    # (see parse_frontmatter's own docstring; this isn't real YAML parsing).
    show_in_carousel = fields.get("show_in_carousel", "").strip().lower() == "true"

    illustration_caption_block = ""
    if fields.get("illustration_caption"):
        illustration_caption_block = (
            f'        <p class="article-page__illustration-caption">{html.escape(fields["illustration_caption"])}</p>'
        )

    # Falls back to a generic line rather than shipping an empty meta
    # description/og:description when a contributor leaves "summary"
    # blank in the CMS — an empty tag is worse than a generic one, since
    # some crawlers then fall back to guessing a snippet from whatever
    # body text happens to render first.
    description = fields.get("summary", "").strip() or (
        f'{fields["title"]} — published in Word for Word, the University '
        "of Pennsylvania's undergraduate medical humanities journal."
    )
    canonical_url = f"{base_url}/articles/{slug}.html"
    og_image_url = base_url + "/" + fields["illustration"]

    # Built and serialized here (not via {{...}} placeholders like the
    # rest of this template's values) specifically so it goes through
    # JSON's own escaping rules (json.dumps), not fill()'s html.escape —
    # a raw ' or " inside e.g. an article's summary is exactly the kind
    # of thing a real submission will contain, and HTML-escaping it would
    # embed literal "&#x27;"/"&quot;" text INSIDE the JSON string values
    # here (a <script type="application/ld+json"> block is parsed as
    # plain JSON, not HTML, so those entities are never decoded back) —
    # confirmed live: Google's own rich-results output showed those raw
    # entity sequences verbatim in place of the real punctuation.
    # datePublished is only included when a real date exists — an
    # inaccurate one (e.g. today's build date) would be worse for a
    # reader/crawler than simply omitting it, and REQUIRED_FIELDS doesn't
    # mandate date.
    article_json_ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": fields["title"],
        "author": {"@type": "Person", "name": fields["author"]},
        "publisher": {"@type": "Organization", "name": "Word for Word"},
        "image": og_image_url,
        "description": description,
        "mainEntityOfPage": canonical_url,
        **({"datePublished": date.strftime("%Y-%m-%d")} if date else {}),
        "isPartOf": {"@type": "Periodical", "name": "Word for Word"},
    }
    # </script> inside a JSON string value would otherwise prematurely
    # close the real <script> tag this gets embedded in — json.dumps has
    # no built-in HTML-safe mode, so this is the standard manual guard.
    article_json_ld_str = json.dumps(article_json_ld, indent=2, ensure_ascii=False).replace("</", "<\\/")

    values = {
        "TITLE": html.escape(fields["title"]),
        "CATEGORY_UPPER": fields["category"].upper(),
        "AUTHOR": html.escape(fields["author"]),
        "EDITOR": html.escape(fields["editor"]),
        "DESIGNER": html.escape(fields["designer"]),
        "DATE_SUFFIX": date_suffix,
        "ILLUSTRATION_SRC": "/" + fields["illustration"],
        "ILLUSTRATION_ALT": html.escape(fields.get("illustration_alt", fields["title"])),
        "ILLUSTRATION_CAPTION_BLOCK": illustration_caption_block,
        "BODY_HTML": render_body_html(body),
        "BASE": "/",
        "CSS_VERSION": css_version,
        "HEADER": build_partial("_header.html", "/", js_version),
        "FOOTER": build_partial("_footer.html", "/", js_version),
        "DESCRIPTION": html.escape(description, quote=True),
        "CANONICAL_URL": html.escape(canonical_url, quote=True),
        "OG_IMAGE_URL": html.escape(og_image_url, quote=True),
        "ARTICLE_JSON_LD": article_json_ld_str,
    }
    output_html = fill(load_template("article.html"), values)

    OUTPUT_DIR.mkdir(exist_ok=True)
    (OUTPUT_DIR / f"{slug}.html").write_text(output_html, encoding="utf-8")

    return {
        "slug": slug,
        "title": fields["title"],
        "category": fields["category"],
        "summary": fields.get("summary", ""),
        "illustration": fields["illustration"],
        "illustration_alt": fields.get("illustration_alt", fields["title"]),
        "date": date,
        "date_display": date.strftime("%B %Y") if date else "",
        "show_in_carousel": show_in_carousel,
        "carousel_image": fields.get("carousel_image", ""),
        "volume": fields.get("volume", ""),
    }


def build_category_page(category, articles_in_category, css_version, js_version, base_url):
    label = category.capitalize()
    if not articles_in_category:
        body = f'      <p class="publications-category__empty">More {label.lower()} coming soon.</p>\n'
    else:
        cards = []
        for art in sorted(articles_in_category, key=lambda a: a["date"] or datetime.min, reverse=True):
            meta = art["date_display"] or ""
            cards.append(
                "        <a class=\"article-teaser\" href=\"/articles/{slug}.html\">\n"
                "          <div class=\"article-teaser__cover\">\n"
                "            <img src=\"/{illustration}\" alt=\"{alt}\" />\n"
                "          </div>\n"
                "          <p class=\"article-teaser__title\">{title}</p>\n"
                "          <p class=\"article-teaser__summary\">{summary}</p>\n"
                "          <p class=\"article-teaser__meta\">{meta}</p>\n"
                "        </a>".format(
                    slug=art["slug"],
                    illustration=html.escape(art["illustration"], quote=True),
                    alt=html.escape(art["illustration_alt"], quote=True),
                    title=html.escape(art["title"]),
                    summary=html.escape(art["summary"]),
                    meta=html.escape(meta),
                )
            )
        body = '      <div class="article-teaser-grid">\n' + "\n".join(cards) + "\n      </div>\n"

    values = {
        "CATEGORY": category,
        "LABEL": label,
        "LABEL_LOWER": label.lower(),
        "BODY_HTML": body,
        "BASE": "/",
        "CSS_VERSION": css_version,
        "HEADER": build_partial("_header.html", "/", js_version),
        "FOOTER": build_partial("_footer.html", "/", js_version),
        "DESCRIPTION": html.escape(
            f"Read {label.lower()} published by Word for Word, the University of "
            "Pennsylvania's undergraduate medical humanities journal.",
            quote=True,
        ),
        "CANONICAL_URL": html.escape(f"{base_url}/{category}/", quote=True),
        "OG_IMAGE_URL": html.escape(f"{base_url}/assets/images/Slogan.jpg", quote=True),
    }
    output_html = fill(load_template("category.html"), values)
    category_dir = ROOT / category
    category_dir.mkdir(exist_ok=True)
    (category_dir / "index.html").write_text(output_html, encoding="utf-8")


def build_publications_page(css_version, js_version, base_url):
    values = {
        "BASE": "/",
        "CSS_VERSION": css_version,
        "HEADER": build_partial("_header.html", "/", js_version),
        "FOOTER": build_partial("_footer.html", "/", js_version),
        "DESCRIPTION": html.escape(
            "Browse published volumes and articles from Word for Word, the "
            "University of Pennsylvania's undergraduate medical humanities journal.",
            quote=True,
        ),
        "CANONICAL_URL": html.escape(f"{base_url}/publications/", quote=True),
        "OG_IMAGE_URL": html.escape(f"{base_url}/assets/images/Slogan.jpg", quote=True),
    }
    output_html = fill(load_template("publications.html"), values)
    publications_dir = ROOT / "publications"
    publications_dir.mkdir(exist_ok=True)
    (publications_dir / "index.html").write_text(output_html, encoding="utf-8")


# Every hand-authored nav page — kept as a plain list here rather than
# derived from index.html's own nav markup (there's no reliable way to
# parse "which hrefs are real pages" back out of that HTML without
# essentially re-implementing a nav parser). Add to this by hand if a new
# permanent nav page is ever added; CATEGORIES + the articles loop below
# already cover everything that varies with content.
STATIC_PAGES = ["/", "/about/", "/get-involved/"]


def build_sitemap(all_articles):
    """Writes sitemap.xml at the repo root from the SAME site structure
    this script already tracks — one source of truth, so a new category
    page or a newly published article shows up here automatically instead
    of needing a second, hand-maintained list to remember. Reads the
    domain out of CNAME (rather than hardcoding it a second time here) for
    the same one-source-of-truth reason.

    Regenerated on every build like every other output in this file — see
    .gitignore's own comment on why these don't need to live in git
    history; the GitHub Actions workflow rebuilds it on every push."""
    domain = (ROOT / "CNAME").read_text(encoding="utf-8").strip()
    base_url = f"https://{domain}"

    urls = []
    for path in STATIC_PAGES:
        urls.append((f"{base_url}{path}", None))
    for category in CATEGORIES:
        urls.append((f"{base_url}/{category}/", None))
    urls.append((f"{base_url}/publications/", None))
    for article in sorted(all_articles, key=lambda a: a["date"] or datetime.min, reverse=True):
        lastmod = article["date"].strftime("%Y-%m-%d") if article["date"] else None
        urls.append((f"{base_url}/articles/{article['slug']}.html", lastmod))

    entries = []
    for loc, lastmod in urls:
        lastmod_tag = f"\n    <lastmod>{lastmod}</lastmod>" if lastmod else ""
        entries.append(f"  <url>\n    <loc>{html.escape(loc, quote=True)}</loc>{lastmod_tag}\n  </url>")

    sitemap_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    (ROOT / "sitemap.xml").write_text(sitemap_xml, encoding="utf-8")


# The homepage carousel is sized (in both markup and CSS) for exactly this
# many slides — see index.html's own comment on .featured-carousel__track.
CAROUSEL_SLOTS = 4


def build_carousel_slide_html(article, index, is_first):
    number = f"({index + 1:02d})"
    article_url = f"/articles/{article['slug']}.html"
    title_attr = html.escape(article["title"], quote=True)
    volume_attr = html.escape(article["volume"], quote=True)
    image_src = "/" + html.escape(article["carousel_image"], quote=True)
    alt_attr = html.escape(article["illustration_alt"], quote=True)
    hover_tiles = "\n".join(
        '              <div class="featured-carousel__hover-tile" aria-hidden="true"></div>' for _ in range(8)
    )
    slide_class = "featured-carousel__slide featured-carousel__slide--first" if is_first else "featured-carousel__slide"
    # Only the first slide gets the mask-reveal treatment (masks + the
    # mosaic-reveal class on its scrim) — matching the hand-authored
    # original: the other 3 only ever appear via a click, never a
    # scroll-into-view, so there's no "first paint" moment for them to
    # reveal into (see the original HTML comment this replaced).
    if is_first:
        masks = "\n".join(
            '              <div class="featured-carousel__mask" aria-hidden="true"></div>' for _ in range(8)
        )
        extra = (
            '            <div class="featured-carousel__scrim mosaic-reveal" aria-hidden="true"></div>\n'
            '            <div class="featured-carousel__masks">\n'
            f"{masks}\n"
            "            </div>\n"
        )
    else:
        extra = '            <div class="featured-carousel__scrim" aria-hidden="true"></div>\n'
    return (
        f'          <div class="{slide_class}" data-title="{title_attr}" data-edition="{volume_attr}" '
        f'data-number="{number}" data-article-url="{article_url}">\n'
        f'            <img class="featured-carousel__photo" src="{image_src}" alt="{alt_attr}" />\n'
        f"{extra}"
        '            <div class="featured-carousel__hover-tiles">\n'
        f"{hover_tiles}\n"
        "            </div>\n"
        "          </div>"
    )


def build_carousel_html(all_articles):
    """Picks the CAROUSEL_SLOTS most-recent articles with "Feature in
    homepage carousel?" checked. Returns (None, count) — meaning: leave
    index.html's carousel exactly as it already is — unless there are
    enough. A half-replaced carousel (some real slides, some leftover
    placeholders) would look like a bug, not a deliberate in-progress
    state, so this is all-or-nothing rather than a partial swap."""
    candidates = [a for a in all_articles if a["show_in_carousel"] and a["carousel_image"]]
    candidates.sort(key=lambda a: a["date"] or datetime.min, reverse=True)
    chosen = candidates[:CAROUSEL_SLOTS]
    if len(chosen) < CAROUSEL_SLOTS:
        return None, len(chosen)

    slides_html = "\n".join(build_carousel_slide_html(a, i, i == 0) for i, a in enumerate(chosen))
    first = chosen[0]
    caption_html = (
        f'        <a href="/articles/{first["slug"]}.html" class="featured-carousel__title mosaic-reveal mosaic-reveal--slide">'
        f'{html.escape(first["title"])}</a>\n'
        f'        <a href="/publications/" class="featured-carousel__edition mosaic-reveal mosaic-reveal--slide">'
        f'{html.escape(first["volume"])}</a>\n'
        '        <p class="featured-carousel__number mosaic-reveal mosaic-reveal--slide">(01)</p>'
    )
    return (slides_html, caption_html), len(chosen)


def replace_between_sentinels(text, start_sentinel, end_sentinel, new_content, filename):
    """Replaces everything strictly BETWEEN two exact, single-line sentinel
    comments (kept as-is) with new_content — the sentinels are plain fixed
    strings (not regex, not spanning any free-form prose), so a human can
    freely reword the explanatory comments around them without ever
    breaking this match. Preserves the end sentinel's own original
    indentation rather than assuming one fixed amount, since
    CAROUSEL_SLIDES:END and CAROUSEL_CAPTION:END sit at different depths."""
    start_at = text.find(start_sentinel)
    end_at = text.find(end_sentinel)
    if start_at == -1 or end_at == -1 or end_at < start_at:
        raise ContentError(f"{filename}: couldn't find {start_sentinel} ... {end_sentinel}")
    line_start = text.rfind("\n", 0, end_at) + 1
    end_indent = text[line_start:end_at]
    before = text[: start_at + len(start_sentinel)]
    after = text[end_at:]
    return f"{before}\n{new_content}\n{end_indent}{after}"


def update_homepage_carousel(all_articles):
    carousel, qualifying_count = build_carousel_html(all_articles)
    if carousel is None:
        print(
            f"Homepage carousel: {qualifying_count}/{CAROUSEL_SLOTS} articles marked "
            "\"Feature in homepage carousel?\" — leaving today's placeholder slides in place."
        )
        return

    slides_html, caption_html = carousel
    index_path = ROOT / "index.html"
    text = index_path.read_text(encoding="utf-8")
    text = replace_between_sentinels(text, "<!-- CAROUSEL_SLIDES:START -->", "<!-- CAROUSEL_SLIDES:END -->", slides_html, "index.html")
    text = replace_between_sentinels(text, "<!-- CAROUSEL_CAPTION:START -->", "<!-- CAROUSEL_CAPTION:END -->", caption_html, "index.html")
    index_path.write_text(text, encoding="utf-8")
    print(f"Homepage carousel: updated with the {CAROUSEL_SLOTS} most recent featured articles.")


INSTAGRAM_DATA_FILE = ROOT / "content" / "instagram_feed.json"


def build_instagram_card_html(post):
    permalink = html.escape(post.get("permalink", "https://www.instagram.com/pennword4word/"), quote=True)
    image_src = "/" + html.escape(post["image"], quote=True)
    # First line only — real Instagram captions are often many lines/
    # hashtags long, and .instagram-card__caption's own CSS already
    # clamps display to 2 lines with an ellipsis, so shipping the whole
    # (possibly huge) caption into the page's HTML would just be dead
    # weight never fully shown anyway.
    caption = post.get("caption", "").strip()
    first_line = caption.splitlines()[0] if caption else "View this post on Instagram."
    caption_html = html.escape(first_line)
    return (
        f'        <a class="instagram-card" href="{permalink}" target="_blank" rel="noopener">\n'
        f'          <div class="instagram-card__cover">\n'
        f'            <img src="{image_src}" alt="" loading="lazy" />\n'
        f'          </div>\n'
        f'          <p class="instagram-card__caption">{caption_html}</p>\n'
        f'        </a>'
    )


def update_instagram_feed():
    """Mirrors update_homepage_carousel() above: reads
    content/instagram_feed.json (kept current by scripts/fetch_instagram.py
    on a schedule — see that script's own docstring) and injects the
    actual card HTML into index.html's "On Instagram" section. Same
    "leave the placeholders alone until there's real data" fallback as
    the carousel — this file doesn't exist at all until
    fetch_instagram.py has successfully run at least once."""
    if not INSTAGRAM_DATA_FILE.exists():
        print(
            "Instagram feed: content/instagram_feed.json doesn't exist yet — "
            "leaving today's placeholder cards in place (see scripts/fetch_instagram.py)."
        )
        return

    data = json.loads(INSTAGRAM_DATA_FILE.read_text(encoding="utf-8"))
    posts = data.get("posts", [])
    if not posts:
        print("Instagram feed: content/instagram_feed.json has no posts — leaving today's placeholder cards in place.")
        return

    cards_html = "\n".join(build_instagram_card_html(p) for p in posts)
    index_path = ROOT / "index.html"
    text = index_path.read_text(encoding="utf-8")
    text = replace_between_sentinels(text, "<!-- INSTAGRAM_FEED:START -->", "<!-- INSTAGRAM_FEED:END -->", cards_html, "index.html")
    index_path.write_text(text, encoding="utf-8")
    print(f"Instagram feed: updated with the {len(posts)} latest posts.")


def main():
    css_version, js_version = read_current_asset_versions()
    # Read once here (rather than each place that needs it independently
    # re-reading CNAME, as build_sitemap below still does on its own) so
    # every per-page canonical/og:url this function builds is guaranteed
    # to agree with each other.
    base_url = f"https://{(ROOT / 'CNAME').read_text(encoding='utf-8').strip()}"

    md_files = sorted(CONTENT_DIR.glob("*.md"))
    all_articles = []
    for md_path in md_files:
        article = build_article(md_path, css_version, js_version, base_url)
        all_articles.append(article)
        print(f"Built articles/{article['slug']}.html")

    if not md_files:
        print("No content files found under content/articles/ — nothing to build.")

    by_category = {c: [a for a in all_articles if a["category"] == c] for c in CATEGORIES}
    for category in CATEGORIES:
        build_category_page(category, by_category[category], css_version, js_version, base_url)
        print(f"Built {category}/index.html")

    build_publications_page(css_version, js_version, base_url)
    print("Built publications/index.html")

    build_sitemap(all_articles)
    print("Built sitemap.xml")

    update_homepage_carousel(all_articles)
    update_instagram_feed()


if __name__ == "__main__":
    try:
        main()
    except ContentError as err:
        print(f"Content error: {err}", file=sys.stderr)
        sys.exit(1)
