import requests
import streamlit as st

from streamlit_api import (
    api_connection_message,
    api_request,
    get_api_session,
    response_message,
)


def main():
    st.title("Bejelentkezés")
    session = get_api_session()
    with st.form("login_form"):
        username = st.text_input("Felhasználónév")
        password = st.text_input("Jelszó", type="password")
        submitted = st.form_submit_button("Bejelentkezés", type="primary")

    if submitted:
        if not username.strip() or not password:
            st.error("Add meg a felhasználónevedet és a jelszavadat.")
        else:
            try:
                response = api_request(
                    session,
                    "POST",
                    "/login",
                    json={"username": username, "password": password},
                )
            except requests.exceptions.RequestException as exc:
                st.error(api_connection_message(exc))
            else:
                if response.ok:
                    st.session_state.username = username
                    st.switch_page("pages/home.py")
                else:
                    st.error(response_message(response))

    st.page_link("pages/home.py", label="Vissza a főoldalra")
    st.page_link("pages/register.py", label="Még nincs fiókod? Regisztráció")


main()
