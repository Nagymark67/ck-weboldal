import os

import requests
import streamlit as st

from streamlit_api import (
    api_connection_message,
    api_request,
    attachment_url,
    get_api_session,
    post_text,
    response_message,
)


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


def main():
    st.title("Cantusok Köre")
    logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ck_cimer_szines.png")
    if os.path.exists(logo_path):
        st.image(logo_path, width=120)

    session = get_api_session()
    username = st.session_state.get("username")
    if username:
        try:
            response = api_request(session, "GET", "/me")
        except requests.exceptions.RequestException as exc:
            st.error(api_connection_message(exc))
            return
        if response.status_code == 401:
            st.session_state.pop("username", None)
            st.session_state.api_session = requests.Session()
            username = None
            st.warning("A bejelentkezési munkamenet lejárt. Kérjük, jelentkezz be újra.")
        elif not response.ok:
            st.error(f"A bejelentkezés ellenőrzése nem sikerült: {response_message(response)}")
            return

    if username:
        st.write(f"Bejelentkezve: **{username}**")
        if st.button("Kijelentkezés"):
            try:
                response = api_request(session, "POST", "/logout")
            except requests.exceptions.RequestException as exc:
                st.error(api_connection_message(exc))
                return
            if not response.ok:
                st.error(response_message(response))
                return
            st.session_state.pop("username", None)
            st.session_state.api_session = requests.Session()
            st.rerun()
    else:
        login_column, register_column = st.columns(2)
        with login_column:
            st.page_link("pages/login.py", label="Bejelentkezés")
        with register_column:
            st.page_link("pages/register.py", label="Regisztráció")

    try:
        render_feed(session)
    except requests.exceptions.RequestException as exc:
        st.error(api_connection_message(exc))


main()
