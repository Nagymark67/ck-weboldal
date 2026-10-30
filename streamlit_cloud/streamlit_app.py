import os
from pathlib import Path
from html.parser import HTMLParser

import requests
import streamlit as st

from streamlit_api import (
    API_BASE_URL,
    attachment_url,
    connection_message,
    get_api_session,
    api_request,
    parse_attachments,
    post_text,
    reset_api_session,
    response_message,
)


ROOT = Path(__file__).resolve().parent.parent
STATUSES = [
    "Szimpatizáns",
    "Tanítvány",
    "Tag",
    "Jegyző",
    "Alapító",
    "Cantus Praeses",
]
VISIBILITY = {
    "Mindenki": "mindenki",
    "Tagok és tanítványok": "tagok_es_tanitvanyok",
    "Csak tagok": "csak_tagok",
}


class MemberSectionParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_members = False
        self.heading = None
        self.capturing_heading = False
        self.current_item = None
        self.sections = {}

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "section" and attributes.get("id") == "all-members":
            self.in_members = True
        elif self.in_members and tag == "h3":
            self.heading = ""
            self.capturing_heading = True
        elif self.in_members and tag == "li":
            self.current_item = ""

    def handle_endtag(self, tag):
        if tag == "section" and self.in_members:
            self.in_members = False
        elif tag == "h3" and self.heading is not None:
            self.heading = self.heading.strip()
            self.sections.setdefault(self.heading, [])
            self.capturing_heading = False
        elif tag == "li" and self.current_item is not None:
            if self.heading:
                self.sections.setdefault(self.heading, []).append(self.current_item.strip())
            self.current_item = None

    def handle_data(self, data):
        if self.capturing_heading:
            self.heading += data
        if self.current_item is not None:
            self.current_item += data


def member_sections():
    source = ROOT / "index.html"
    if not source.exists():
        return {}
    parser = MemberSectionParser()
    parser.feed(source.read_text(encoding="utf-8"))
    return parser.sections


def configure_page():
    st.set_page_config(
        page_title="Cantusok Köre",
        page_icon="🎼",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    st.markdown(
        """
        <style>
        .stApp { background: #f6f7fb; color: #222; font-family: 'Segoe UI', 'Roboto', Arial, sans-serif; }
        [data-testid="stHeader"] { background: transparent; }
        [data-testid="stSidebar"] { display: none; }
        .block-container { max-width: 1200px; padding: 0 1rem 2rem; }
        .ck-header {
            background: linear-gradient(90deg, #8B0000 60%, #a83232 100%);
            border-radius: 0 0 24px 24px; padding: 24px 40px 16px;
            color: white; box-shadow: 0 2px 12px rgba(0,0,0,.08);
        }
        .ck-header img { max-height: 120px; object-fit: contain; }
        .ck-auth {
            display: flex; justify-content: flex-end; gap: 8px; align-items: center;
            margin: 10px 0 18px; color: #8B0000; font-weight: 600;
        }
        .ck-card {
            background: white; border-radius: 18px; padding: 22px 28px;
            margin: 18px 0; box-shadow: 0 4px 24px rgba(139,0,0,.07);
        }
        .ck-toc, .ck-online {
            background: white; border-radius: 18px; padding: 22px 24px;
            box-shadow: 0 4px 24px rgba(139,0,0,.07); margin-top: 18px;
        }
        .ck-toc h3, .ck-online h3 { color: #8B0000; margin-top: 0; }
        .ck-toc a { color: #8B0000; text-decoration: none; line-height: 1.9; }
        .ck-user { color: #8B0000; font-weight: 600; text-align: right; margin-bottom: 8px; }
        h1, h2, h3 { color: #8B0000; }
        .stButton > button { border-radius: 20px; border: 1px solid #eee; }
        div.stButton > button[kind="primary"] {
            background: #8B0000; border-color: #8B0000; color: white;
        }
        @media (max-width: 900px) {
            .ck-header { padding: 16px; }
            .block-container { padding: 0 .5rem 1rem; }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def image_path(filename):
    path = ROOT / filename
    return str(path) if path.exists() else None


def current_user(session):
    try:
        response = api_request(session, "GET", "/me")
    except requests.RequestException as exc:
        st.error(connection_message(exc))
        return None
    if response.status_code == 401:
        return None
    if not response.ok:
        st.error(f"A bejelentkezés ellenőrzése nem sikerült: {response_message(response)}")
        return None
    try:
        payload = response.json()
    except ValueError:
        st.error("A szerver érvénytelen választ adott.")
        return None
    return payload if isinstance(payload, dict) else None


def render_header(user):
    st.markdown('<div class="ck-header">', unsafe_allow_html=True)
    columns = st.columns([1, 3])
    with columns[0]:
        logo = image_path("ck_cimer_szines.png")
        if logo:
            st.image(logo, width=170)
    with columns[1]:
        banner = image_path("vivatselmec.png")
        if banner:
            st.image(banner, width=440)
    st.markdown("</div>", unsafe_allow_html=True)
    if user:
        st.markdown(
            f'<div class="ck-user">Bejelentkezve: {user.get("username", "")}</div>',
            unsafe_allow_html=True,
        )


def render_navigation(user, view):
    columns = st.columns([1, 1, 1, 2.4])
    labels = [("Főoldal", "Főoldal"), ("Bejelentkezés", "Bejelentkezés"), ("Regisztráció", "Regisztráció")]
    for column, (target, label) in zip(columns, labels):
        with column:
            if st.button(label, key=f"nav_{target}", type="primary" if view == target else "secondary"):
                st.session_state.active_view = target
                st.rerun()
    with columns[3]:
        if user:
            st.markdown(
                f'<div class="ck-user">Bejelentkezve: {user.get("username", "")}</div>',
                unsafe_allow_html=True,
            )


def render_online_users(session):
    st.markdown('<div class="ck-online"><h3>Online felhasználók</h3>', unsafe_allow_html=True)
    try:
        response = api_request(session, "GET", "/online-users")
        payload = response.json() if response.ok else {}
    except (requests.RequestException, ValueError):
        st.caption("Az online lista jelenleg nem érhető el.")
        st.markdown("</div>", unsafe_allow_html=True)
        return
    users = payload.get("users", []) if isinstance(payload, dict) else []
    if not users:
        st.caption("Nincs online felhasználó.")
        st.markdown("</div>", unsafe_allow_html=True)
        return
    for user in users:
        if isinstance(user, dict):
            status = f" ({user['status']})" if user.get("status") else ""
            st.write(f"• {user.get('username', 'Ismeretlen')}{status}")
    st.markdown("</div>", unsafe_allow_html=True)


def render_contents():
    st.markdown(
        """
        <div class="ck-toc">
        <h3>Az Oldal Tartalma</h3>
        <a href="
        <a href="#all-members">Tagok listája</a><br>
        &nbsp;&nbsp;<a href="#alapito-tagok">Alapító tagok</a><br>
        &nbsp;&nbsp;<a href="#rendes-tagok">Rendes tagok</a><br>
        &nbsp;&nbsp;<a href="#soproni-tagok">Soproni tagok</a><br>
        &nbsp;&nbsp;<a href="#szekesfehervari-tag">Székesfehérvári tag</a><br>
        &nbsp;&nbsp;<a href="#tiszteletbeli-tagok">Tiszteletbeli tagok</a><br>
        <a href="#kapcsolat">Kapcsolat</a>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_members():
    sections = member_sections()
    st.subheader("Tagok listája")
    for heading, names in sections.items():
        st.markdown(f"
        if names:
            st.markdown("\n".join(f"- {name}" for name in names))


def render_feed(session, can_post):
    st.markdown('<div class="ck-card">', unsafe_allow_html=True)
    st.subheader("Hírek és események")
    if st.button("Frissítés", key="refresh_feed"):
        st.rerun()
    if can_post:
        render_composer(session)
    try:
        response = api_request(session, "GET", "/posts")
    except requests.RequestException as exc:
        st.error(connection_message(exc))
        st.markdown("</div>", unsafe_allow_html=True)
        return
    if not response.ok:
        st.error(f"A hírek betöltése nem sikerült: {response_message(response)}")
        st.markdown("</div>", unsafe_allow_html=True)
        return
    try:
        payload = response.json()
    except ValueError:
        st.error("A szerver érvénytelen választ adott a hírek lekérésekor.")
        st.markdown("</div>", unsafe_allow_html=True)
        return
    posts = payload.get("posts", []) if isinstance(payload, dict) else []
    if not posts:
        st.info("Még nincsenek nyilvános hírek.")
    for post in posts:
        if not isinstance(post, dict):
            continue
        st.markdown(
            f"**{post.get('author_username', 'Ismeretlen szerző')}** · "
            f"{post.get('created_at', '')}"
        )
        text = post_text(post.get("content", ""))
        if text:
            st.write(text)
        for index, value in enumerate(parse_attachments(post.get("attachments")), 1):
            url = attachment_url(value)
            if url:
                st.link_button(f"Csatolmány {index} megnyitása", url)
        st.divider()
    st.markdown("</div>", unsafe_allow_html=True)


def render_composer(session):
    with st.expander("Új poszt"):
        with st.form("post_form", clear_on_submit=True):
            content = st.text_area("Tartalom", height=150)
            files = st.file_uploader(
                "Csatolmányok (legfeljebb 5 fájl, fájlonként 10 MB)",
                accept_multiple_files=True,
                type=["png", "jpg", "jpeg", "gif", "webp", "mp4", "mov", "pdf"],
            )
            visibility_label = st.selectbox("Láthatóság", list(VISIBILITY))
            submitted = st.form_submit_button("Posztolás", type="primary")
        if submitted:
            if not content.strip() and not files:
                st.error("Adj meg szöveget vagy legalább egy csatolmányt.")
                return
            if len(files) > 5 or any(file.size > 10 * 1024 * 1024 for file in files):
                st.error("Legfeljebb 5, egyenként legfeljebb 10 MB méretű fájl tölthető fel.")
                return
            multipart = [
                (
                    "attachments",
                    (file.name, file.getvalue(), file.type or "application/octet-stream"),
                )
                for file in files
            ]
            try:
                response = api_request(
                    session,
                    "POST",
                    "/posts",
                    data={"content": content, "visibility": VISIBILITY[visibility_label]},
                    files=multipart or None,
                )
            except requests.RequestException as exc:
                st.error(connection_message(exc))
                return
            if response.ok:
                st.success("A poszt közzététele sikerült.")
                st.rerun()
            else:
                st.error(response_message(response))


def render_home(session, user):
    left, center, right = st.columns([1, 2.2, 1])
    with left:
        render_contents()
    with center:
        hero = f"{API_BASE_URL}/uploads/hero.jpg"
        if os.path.exists(ROOT / "uploads" / "hero.jpg"):
            st.image(str(ROOT / "uploads" / "hero.jpg"), use_container_width=True)
        else:
            st.image(hero, use_container_width=True)
        st.markdown('<div class="ck-card" id="rolunk">', unsafe_allow_html=True)
        st.subheader("Rólunk")
        st.write("placeholder")
        st.markdown("</div>", unsafe_allow_html=True)
        render_feed(session, bool(user and (
            user.get("isAllTimeAdmin")
            or {"cantus_praeses", "jegyzo"} & set(user.get("roles", []))
        )))
        st.markdown('<div class="ck-card" id="all-members">', unsafe_allow_html=True)
        render_members()
        st.markdown("</div>", unsafe_allow_html=True)
        st.markdown('<div class="ck-card" id="kapcsolat">', unsafe_allow_html=True)
        st.subheader("Kapcsolat")
        st.write("Amennyiben kérdéseid vannak, elérhetsz minket a [Facebook](https://www.facebook.com/CantusokKore/?locale=hu_HU) oldalunkon keresztül, illetve a vezetőséget is nyugodtan keresheted.")
        st.markdown("</div>", unsafe_allow_html=True)
    with right:
        render_online_users(session)


def render_login(session):
    st.header("Bejelentkezés")
    with st.form("login_form"):
        username = st.text_input("Felhasználónév")
        password = st.text_input("Jelszó", type="password")
        submitted = st.form_submit_button("Bejelentkezés", type="primary")
    if submitted:
        if not username.strip() or not password:
            st.error("Add meg a felhasználónevedet és a jelszavadat.")
            return
        try:
            response = api_request(
                session,
                "POST",
                "/login",
                json={"username": username.strip(), "password": password},
            )
        except requests.RequestException as exc:
            st.error(connection_message(exc))
            return
        if response.ok:
            st.session_state.active_view = "Főoldal"
            st.rerun()
        else:
            st.error(response_message(response))


def render_register(session):
    st.header("Regisztráció")
    with st.form("register_form"):
        username = st.text_input("Felhasználónév")
        password = st.text_input("Jelszó", type="password")
        status = st.selectbox("Státusz", STATUSES)
        submitted = st.form_submit_button("Regisztráció", type="primary")
    if submitted:
        if not username.strip() or not password:
            st.error("Add meg a felhasználónevedet és a jelszavadat.")
            return
        try:
            response = api_request(
                session,
                "POST",
                "/register",
                json={"username": username.strip(), "password": password, "status": status},
            )
        except requests.RequestException as exc:
            st.error(connection_message(exc))
            return
        if response.ok:
            st.success("Sikeres regisztráció! Most már bejelentkezhetsz.")
            st.session_state.active_view = "Bejelentkezés"
            st.rerun()
        else:
            st.error(response_message(response))


def main():
    configure_page()
    session = get_api_session()
    view = st.session_state.get("active_view", "Főoldal")
    user = current_user(session) if view in {"Főoldal", "Bejelentkezés"} else None
    if user is None and st.session_state.get("was_authenticated"):
        reset_api_session()
        session = get_api_session()
        st.session_state.was_authenticated = False
    elif user:
        st.session_state.was_authenticated = True
    render_header(user)
    render_header(user)
    render_navigation(user, view)
    if user:
        if st.button("Kijelentkezés", key="logout_top"):
            try:
                response = api_request(session, "POST", "/logout")
                if not response.ok:
                    st.error(response_message(response))
                else:
                    reset_api_session()
                    st.session_state.was_authenticated = False
                    st.rerun()
            except requests.RequestException as exc:
                st.error(connection_message(exc))

    if view == "Főoldal":
        render_home(session, user)
    elif view == "Bejelentkezés":
        render_login(session)
    else:
        render_register(session)


if __name__ == "__main__":
    main()
