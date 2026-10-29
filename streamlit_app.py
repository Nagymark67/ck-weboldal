import os
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import requests
import streamlit as st


API_BASE_URL = os.environ.get("CK_API_BASE_URL", "http://localhost:3000").rstrip("/")
REQUEST_TIMEOUT = 10
BLOCK_TAGS = {
    "address",
    "article",
    "blockquote",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "ol",
    "p",
    "section",
    "ul",
}


class PostTextParser(HTMLParser):
    """Convert the editor's HTML to readable text without rendering untrusted HTML."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip_tags = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.skip_tags.append(tag)
            return
        if self.skip_tags:
            return
        if tag in BLOCK_TAGS or tag == "br":
            self._newline()
        elif tag == "img":
            alt = dict(attrs).get("alt", "").strip()
            if alt:
                self.parts.append(alt)

    def handle_endtag(self, tag):
        if self.skip_tags:
            if tag == self.skip_tags[-1]:
                self.skip_tags.pop()
            return
        if tag in BLOCK_TAGS:
            self._newline()

    def handle_data(self, data):
        if not self.skip_tags:
            self.parts.append(data)

    def _newline(self):
        if self.parts and not self.parts[-1].endswith("\n"):
            self.parts.append("\n")

    def text(self):
        return "".join(self.parts).strip()


def new_api_session():
    return requests.Session()


def api_request(session, method, path, **kwargs):
    return session.request(
        method,
        f"{API_BASE_URL}{path}",
        timeout=REQUEST_TIMEOUT,
        **kwargs,
    )


def response_message(response):
    try:
        body = response.json()
    except requests.exceptions.JSONDecodeError:
        body = {}
    if isinstance(body, dict) and body.get("message"):
        return str(body["message"])
    return f"HTTP {response.status_code}: {response.reason}"


def post_text(content):
    parser = PostTextParser()
    parser.feed(content or "")
    return parser.text()


def attachment_url(value):
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    if parsed.scheme or parsed.netloc or not parsed.path.startswith("/uploads/"):
        return None
    return urljoin(f"{API_BASE_URL}/", value.lstrip("/"))


def render_feed(session):
    st.subheader("Hírek és események")
    if st.button("Frissítés", key="refresh_feed"):
        st.rerun()

    response = api_request(session, "GET", "/posts")
    if not response.ok:
        st.error(f"A hírek betöltése nem sikerült: {response_message(response)}")
        return

    try:
        payload = response.json()
    except requests.exceptions.JSONDecodeError:
        st.error("A szerver érvénytelen választ adott a hírek lekérésekor.")
        return
    posts = payload.get("posts") if isinstance(payload, dict) else None
    if not isinstance(posts, list):
        st.error("A szerver válaszából hiányzik a hírek listája.")
        return
    if not posts:
        st.info("Még nincsenek nyilvános hírek.")
        return

    for post in posts:
        if not isinstance(post, dict):
            continue
        author = post.get("author_username", "Ismeretlen szerző")
        created_at = post.get("created_at", "")
        st.markdown(f"**{author}** · {created_at}")

        text = post_text(post.get("content", ""))
        if text:
            st.markdown(text)

        attachments = post.get("attachments", [])
        if isinstance(attachments, list):
            for index, value in enumerate(attachments, start=1):
                url = attachment_url(value)
                if url:
                    st.link_button(f"Csatolmány {index} megnyitása", url)
        st.divider()


def render_login(session):
    st.sidebar.subheader("Bejelentkezés")
    with st.sidebar.form("login_form"):
        username = st.text_input("Felhasználónév")
        password = st.text_input("Jelszó", type="password")
        submitted = st.form_submit_button("Bejelentkezés")

    if submitted:
        if not username.strip() or not password:
            st.sidebar.error("Add meg a felhasználónevedet és a jelszavadat.")
            return
        try:
            response = api_request(
                session,
                "POST",
                "/login",
                json={"username": username, "password": password},
            )
        except requests.exceptions.RequestException as exc:
            st.sidebar.error(f"Nem sikerült elérni az Express szervert: {exc}")
            return
        if response.ok:
            st.session_state.username = username
            st.rerun()
        st.sidebar.error(response_message(response))


def main():
    st.set_page_config(page_title="Cantusok Köre", page_icon="🎼", layout="centered")
    st.title("Cantusok Köre")
    logo_path = os.path.join(os.path.dirname(__file__), "ck_cimer_szines.png")
    if os.path.exists(logo_path):
        st.image(logo_path, width=120)

    if "api_session" not in st.session_state:
        st.session_state.api_session = new_api_session()
    session = st.session_state.api_session
    username = st.session_state.get("username")

    if username:
        try:
            response = api_request(session, "GET", "/me")
        except requests.exceptions.RequestException as exc:
            st.error(f"Nem sikerült ellenőrizni a bejelentkezést: {exc}")
            return
        if response.status_code == 401:
            st.session_state.pop("username", None)
            st.warning("A bejelentkezési munkamenet lejárt. Kérjük, jelentkezz be újra.")
            username = None
        elif not response.ok:
            st.error(f"A bejelentkezés ellenőrzése nem sikerült: {response_message(response)}")
            return

    if username:
        st.sidebar.write(f"Bejelentkezve: **{username}**")
        if st.sidebar.button("Kijelentkezés"):
            try:
                response = api_request(session, "POST", "/logout")
            except requests.exceptions.RequestException as exc:
                st.sidebar.error(f"A kijelentkezés nem sikerült: {exc}")
                return
            if not response.ok:
                st.sidebar.error(response_message(response))
                return
            st.session_state.pop("username", None)
            st.session_state.api_session = new_api_session()
            st.rerun()
    else:
        render_login(session)

    try:
        render_feed(session)
    except requests.exceptions.RequestException as exc:
        st.error(f"Nem sikerült elérni az Express szervert: {exc}")


if __name__ == "__main__":
    main()
