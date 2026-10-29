# Streamlit Community Cloud deployment

This folder is a separate Streamlit frontend. It does not replace or modify
the existing Node/Express website. Deploy `streamlit_cloud/streamlit_app.py`
as the Community Cloud app entrypoint.

The Streamlit app still uses the existing Express API for authentication,
registration, posts, uploads, and online users. The API must be deployed
separately at a public HTTPS URL.

In the Community Cloud app settings, add this secret:

```toml
CK_API_BASE_URL = "https://your-express-api.example.com"
```

Install dependencies from `streamlit_cloud/requirements.txt` by selecting
that file in the app's advanced deployment settings, or copy its two
requirements into the deployment environment.

For local testing from the repository root:

```powershell
python -m pip install -r streamlit_cloud\requirements.txt
$env:CK_API_BASE_URL = 'http://localhost:3000'
python -m streamlit run streamlit_cloud\streamlit_app.py
```

The Express API must allow the Streamlit host to reach it, and its session
cookie configuration must support the deployment topology. Do not put
database credentials in this folder or in the repository.
