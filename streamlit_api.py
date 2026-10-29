import os
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import requests
import streamlit as st


def configured_api_base_url():
    base_url = os.environ.get("CK_API_BASE_URL")
    if not base_url:
        try:
            base_url = st.secrets.get("CK_API_BASE_URL")
        except FileNotFoundError:
            base_url = None
    return (base_url or "http://localhost:3000").rstrip("/")


API_BASE_URL = configured_api_base_url()
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


def get_api_session():
    if "api_session" not in st.session_state:
        st.session_state.api_session = new_api_session()
    return st.session_state.api_session


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


def api_connection_message(error):
    message = (
        f"Could not connect to the Express API at {API_BASE_URL}: {error}. "
        "For local development, start MySQL and run `npm start` in the "
        "project directory. If Streamlit is hosted remotely, set "
        "`CK_API_BASE_URL` to an Express URL reachable from that host; "
        "`localhost` points to the Streamlit host, not your computer."
    )
    return message


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
