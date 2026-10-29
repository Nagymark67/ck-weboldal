import requests
import streamlit as st

from streamlit_api import (
    api_connection_message,
    api_request,
    get_api_session,
    response_message,
)


STATUSES = [
    "Szimpatizáns",
    "Tanítvány",
    "Tag",
    "Jegyző",
    "Alapító",
    "Cantus Praeses",
]


def main():
    st.title("Regisztráció")
    session = get_api_session()
    with st.form("register_form"):
        username = st.text_input("Felhasználónév")
        password = st.text_input("Jelszó", type="password")
        status = st.selectbox("Státusz", STATUSES)
        submitted = st.form_submit_button("Regisztráció", type="primary")

    if submitted:
        if not username.strip() or not password:
            st.error("Add meg a felhasználónevedet és a jelszavadat.")
        else:
            try:
                response = api_request(
                    session,
                    "POST",
                    "/register",
                    json={
                        "username": username.strip(),
                        "password": password,
                        "status": status,
                    },
                )
            except requests.exceptions.RequestException as exc:
                st.error(api_connection_message(exc))
            else:
                if response.ok:
                    st.success("Sikeres regisztráció! Most már bejelentkezhetsz.")
                    st.page_link("pages/login.py", label="Tovább a bejelentkezéshez")
                else:
                    st.error(response_message(response))

    st.page_link("pages/home.py", label="Vissza a főoldalra")
    st.page_link("pages/login.py", label="Már van fiókod? Bejelentkezés")


main()
