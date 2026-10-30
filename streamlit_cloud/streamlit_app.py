import os
from pathlib import Path

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
        .stApp { background: #f6f7fb; color: #222; }
        [data-testid="stHeader"] { background: transparent; }
        .ck-header {
            background: linear-gradient(90deg, #8B0000 60%, #a83232 100%);
            border-radius: 0 0 24px 24px; padding: 18px 28px;
            color: white; box-shadow: 0 2px 12px rgba(0,0,0,.08);
        }
        .ck-card {
            background: white; border-radius: 18px; padding: 22px 28px;
            margin: 18px 0; box-shadow: 0 4px 24px rgba(139,0,0,.07);
        }
        .ck-user { color: #8B0000; font-weight: 600; text-align: right; }
        h1, h2, h3 { color: #8B0000; }
        div.stButton > button[kind="primary"] {
            background: #8B0000; border-color: #8B0000; color: white;
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


def render_online_users(session):
    st.markdown("### Online felhasználók")
    try:
        response = api_request(session, "GET", "/online-users")
        payload = response.json() if response.ok else {}
    except (requests.RequestException, ValueError):
        st.caption("Az online lista jelenleg nem érhető el.")
        return
    users = payload.get("users", []) if isinstance(payload, dict) else []
    if not users:
        st.caption("Nincs online felhasználó.")
        return
    for user in users:
        if isinstance(user, dict):
            status = f" ({user['status']})" if user.get("status") else ""
            st.write(f"• {user.get('username', 'Ismeretlen')}{status}")


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
    st.markdown('<div class="ck-card">', unsafe_allow_html=True)
    hero = f"{API_BASE_URL}/uploads/hero.jpg"
    if os.path.exists(ROOT / "uploads" / "hero.jpg"):
        st.image(str(ROOT / "uploads" / "hero.jpg"), use_container_width=True)
    else:
        st.image(hero, use_container_width=True)
    st.subheader("Rólunk")
    st.write("A Cantusok Köre közösségének hivatalos oldala.")
    st.markdown("</div>", unsafe_allow_html=True)
    render_feed(session, bool(user and (
        user.get("isAllTimeAdmin")
        or {"cantus_praeses", "jegyzo"} & set(user.get("roles", []))
    )))
    st.markdown('<div class="ck-card">', unsafe_allow_html=True)
    st.subheader("Tagok listája")
    st.write("A tagokkal kapcsolatos információk és közösségi hírek ezen az oldalon érhetők el.")
    st.subheader("Kapcsolat")
    st.write("Kérdés esetén vedd fel velünk a kapcsolatot a közösség hivatalos csatornáin.")
    st.markdown("</div>", unsafe_allow_html=True)


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
    with st.sidebar:
        st.markdown("## Cantusok Köre")
        view = st.radio(
            "Navigáció",
            ["Főoldal", "Bejelentkezés", "Regisztráció"],
            key="active_view",
        )
    user = current_user(session) if view in {"Főoldal", "Bejelentkezés"} else None
    if user is None and st.session_state.get("was_authenticated"):
        reset_api_session()
        session = get_api_session()
        st.session_state.was_authenticated = False
    elif user:
        st.session_state.was_authenticated = True

    render_header(user)
    with st.sidebar:
        if view == "Főoldal":
            render_online_users(session)
        if user and st.button("Kijelentkezés"):
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
