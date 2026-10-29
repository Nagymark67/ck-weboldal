import json
import os
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import requests
import streamlit as st


REQUEST_TIMEOUT = 15
DEFAULT_API_URL = "http://localhost:3000"
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


def configured_api_base_url():
    value = os.getenv("CK_API_BASE_URL")
    if not value:
        try:
            value = st.secrets.get("CK_API_BASE_URL")
        except (FileNotFoundError, KeyError):
            value = None
    return (value or DEFAULT_API_URL).strip().rstrip("/")


API_BASE_URL = configured_api_base_url()


class PostTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip_tags = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.skip_tags.append(tag)
        elif not self.skip_tags and tag in BLOCK_TAGS.union({"br"}):
            self._newline()
        elif not self.skip_tags and tag == "img":
            alt = dict(attrs).get("alt", "").strip()
            if alt:
                self.parts.append(alt)

    def handle_endtag(self, tag):
        if self.skip_tags:
            if tag == self.skip_tags[-1]:
                self.skip_tags.pop()
        elif tag in BLOCK_TAGS:
            self._newline()

    def handle_data(self, data):
        if not self.skip_tags:
            self.parts.append(data)

    def _newline(self):
        if self.parts and not self.parts[-1].endswith("\n"):
            self.parts.append("\n")

    def text(self):
        return "".join(self.parts).strip()


def get_api_session():
    if "ck_cloud_api_session" not in st.session_state:
        st.session_state.ck_cloud_api_session = requests.Session()
    return st.session_state.ck_cloud_api_session


def reset_api_session():
    st.session_state.ck_cloud_api_session = requests.Session()


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
    except (ValueError, requests.RequestException):
        body = {}
    if isinstance(body, dict) and body.get("message"):
        return str(body["message"])
    return f"HTTP {response.status_code}: {response.reason}"


def connection_message(error):
    return (
        f"Az Express API nem érhető el ({API_BASE_URL}): {error}. "
        "A Community Cloud Secrets között állítsd be a CK_API_BASE_URL értékét "
        "a nyilvánosan elérhető HTTPS API címére."
    )


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


def parse_attachments(value):
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return []
        return parsed if isinstance(parsed, list) else []
    return []
