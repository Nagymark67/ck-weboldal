import streamlit as st


def main():
    st.set_page_config(page_title="Cantusok Köre", page_icon="🎼", layout="centered")
    navigation = st.navigation(
        [
            st.Page("pages/home.py", title="Főoldal", default=True),
            st.Page("pages/login.py", title="Bejelentkezés"),
            st.Page("pages/register.py", title="Regisztráció"),
        ],
        position="hidden",
    )
    navigation.run()


if __name__ == "__main__":
    main()
